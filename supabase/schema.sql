-- ============================================================================
-- EXAMIFY MULTI-TENANT SAAS RELATIONAL SCHEMA & ROW-LEVEL SECURITY (RLS)
-- Database: Supabase PostgreSQL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('platform_owner', 'school_admin', 'teacher', 'student', 'parent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE exam_status AS ENUM ('draft', 'scheduled', 'published', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'fill_blank', 'matching', 'short_answer', 'long_answer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('in_progress', 'paused_violation', 'submitted', 'graded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE query_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'reopened', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. CORE TENANT & IDENTITY TABLES
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(24) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pilot')),
  plan_tier VARCHAR(20) NOT NULL DEFAULT 'pilot',
  query_min_sla_hours INT NOT NULL DEFAULT 48 CHECK (query_min_sla_hours >= 24),
  query_max_sla_hours INT NOT NULL DEFAULT 168 CHECK (query_max_sla_hours <= 336),
  max_tab_violations INT NOT NULL DEFAULT 3 CHECK (max_tab_violations >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(64) UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_school_required CHECK (
    (role = 'platform_owner' AND school_id IS NULL) OR
    (role <> 'platform_owner' AND school_id IS NOT NULL)
  ),
  UNIQUE (user_id, school_id, role)
);

CREATE TABLE IF NOT EXISTS parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, parent_user_id, student_user_id)
);

-- 3. ACADEMIC STRUCTURE
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(32) NOT NULL, -- e.g., 'Class 9', 'Class 11'
  academic_year VARCHAR(16) NOT NULL DEFAULT '2026-27',
  UNIQUE (school_id, name, academic_year)
);

CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name VARCHAR(16) NOT NULL, -- e.g., 'A', 'B', 'C'
  UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  roll_number VARCHAR(24),
  UNIQUE (school_id, student_id, class_id)
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (school_id, teacher_id, section_id, subject_id)
);

-- 4. EXAMINATIONS, QUESTIONS, ATTEMPTS & GRADING
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  instructions TEXT,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 300),
  total_marks NUMERIC(6,2) NOT NULL CHECK (total_marks > 0),
  scheduled_start TIMESTAMPTZ,
  deadline_end TIMESTAMPTZ,
  status exam_status NOT NULL DEFAULT 'draft',
  results_published BOOLEAN NOT NULL DEFAULT FALSE,
  require_fullscreen BOOLEAN NOT NULL DEFAULT TRUE,
  max_violations INT NOT NULL DEFAULT 3,
  source_document_r2_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  q_type question_type NOT NULL,
  prompt TEXT NOT NULL,
  topic VARCHAR(120),
  marks NUMERIC(5,2) NOT NULL CHECK (marks > 0),
  options JSONB,             -- Array of choices for MCQ / Matching pairs
  correct_answer JSONB,      -- Server-protected answer key / keywords
  source_reference TEXT,     -- Preserved document page/section reference
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_approved BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status attempt_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_autosaved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  tab_violation_count INT NOT NULL DEFAULT 0,
  violation_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  response_value JSONB,
  attachment_r2_key TEXT,
  ai_suggested_marks NUMERIC(5,2),
  ai_feedback_draft TEXT,
  awarded_marks NUMERIC(5,2),
  teacher_feedback TEXT,
  teacher_approved_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  attempt_id UUID UNIQUE NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  obtained_marks NUMERIC(6,2) NOT NULL,
  max_marks NUMERIC(6,2) NOT NULL,
  percentage NUMERIC(5,2) GENERATED ALWAYS AS (ROUND((obtained_marks / NULLIF(max_marks, 0)) * 100, 2)) STORED,
  overall_feedback TEXT,
  approved_by UUID NOT NULL REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. STUDENT QUERY MANAGEMENT SYSTEM
CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_teacher_id UUID REFERENCES users(id),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status query_status NOT NULL DEFAULT 'open',
  deadline_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  student_helpful_vote BOOLEAN,
  admin_warning_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS query_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  is_clarification_request BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TEACHER COMMUNITIES, ANNOUNCEMENTS, NOTIFICATIONS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, -- e.g. 'Class 9C — Computer Science'
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, section_id, subject_id, name)
);

CREATE TABLE IF NOT EXISTS group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (member_role IN ('moderator', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  resource_r2_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_memberships_user_school ON memberships(user_id, school_id);
CREATE INDEX IF NOT EXISTS idx_exams_school_class ON exams(school_id, class_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_school_exam ON attempts(school_id, exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_queries_school_status_deadline ON queries(school_id, status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_memberships(school_id, group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- 8. HELPER FUNCTIONS & ROW LEVEL SECURITY (RLS)
CREATE OR REPLACE FUNCTION public.user_belongs_to_school(target_school UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.school_id = target_school
      AND m.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_school_role(target_school UUID, allowed_roles user_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.school_id = target_school
      AND m.role = ANY(allowed_roles)
      AND m.is_active = TRUE
  );
$$;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Strict Cross-School Isolation Policies
CREATE POLICY tenant_isolation_classes ON classes
  FOR ALL USING (public.user_belongs_to_school(school_id));

CREATE POLICY tenant_isolation_sections ON sections
  FOR ALL USING (public.user_belongs_to_school(school_id));

CREATE POLICY tenant_isolation_subjects ON subjects
  FOR ALL USING (public.user_belongs_to_school(school_id));

CREATE POLICY tenant_isolation_exams_read ON exams
  FOR SELECT USING (
    public.user_has_school_role(school_id, ARRAY['school_admin','teacher']::user_role[])
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM student_enrollments se
        WHERE se.student_id = auth.uid()
          AND se.school_id = exams.school_id
          AND se.class_id = exams.class_id
          AND (exams.section_id IS NULL OR se.section_id = exams.section_id)
      )
    )
  );

CREATE POLICY tenant_isolation_attempts ON attempts
  FOR ALL USING (
    public.user_belongs_to_school(school_id)
    AND (
      student_id = auth.uid()
      OR public.user_has_school_role(school_id, ARRAY['school_admin','teacher']::user_role[])
    )
  );

CREATE POLICY tenant_isolation_queries ON queries
  FOR SELECT USING (
    public.user_belongs_to_school(school_id)
    AND (
      student_id = auth.uid()
      OR assigned_teacher_id = auth.uid()
      OR public.user_has_school_role(school_id, ARRAY['school_admin']::user_role[])
    )
  );

CREATE POLICY private_group_access ON announcements
  FOR SELECT USING (
    public.user_belongs_to_school(school_id)
    AND (
      public.user_has_school_role(school_id, ARRAY['school_admin']::user_role[])
      OR EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = announcements.group_id
          AND gm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY own_notifications_only ON notifications
  FOR SELECT USING (recipient_id = auth.uid());