# Milestone 4 — Examination system

## 1) Goal

Build the exam engine foundation for Examify.

We are creating the first secure, testable layer for:

- question banks
- exam creation
- document ingestion
- teacher review before publication
- question types and marks
- exam scheduling
- student attempts
- autosave and recovery
- grading and results

The key rule is that AI-generated content remains a suggestion until a teacher approves it. No exam is published without a human review step.

## 2) Prerequisites

Required before we begin this milestone:

- Milestone 3 schema design and role model are approved
- Supabase project is created and accessible
- authentication model is planned around server-side JWT validation
- school, class, subject, and user tables exist
- local web app is running
- synthetic data is allowed for demos and tests

## 3) Cost

Expected cost:

- Supabase free tier is enough for early exam data
- local web app remains free
- Cloudflare Pages/Workers free-tier usage remains free for small prototype testing
- no AI provider should be activated in this milestone
- no paid storage or object upload service should be enabled without approval

Billing risks:

- file uploads can increase storage usage
- AI features can cost quickly if enabled early
- no production-grade exam traffic should be run yet

## 4) Exact steps

1. Define the exam schema in Supabase
   - create tables for question banks, questions, exams, exam_questions, attempts, and results
   - tie every record back to school_id
   - ensure all exam actions are scoped to a school and a teacher role

2. Seed demo exam data
   - create at least one subject, one class, one teacher, one student
   - create a few questions with different types
   - create at least one draft exam and one scheduled exam

3. Build the question bank UI
   - teacher can view questions by subject and class
   - teacher can add new MCQ, true/false, short answer, and long answer questions
   - synthetic demo data is used first

4. Build exam creation flow
   - teacher enters title, instructions, duration, marks, schedule, and class assignment
   - teacher chooses which questions belong to the exam
   - teacher saves as draft before publishing

5. Add document ingestion workflow
   - teacher can upload PDF, DOCX, image, or text
   - system stores the file in secure storage and labels it as a draft source
   - AI can generate question drafts later, but the review step is mandatory

6. Add teacher review and approval
   - AI-suggested questions are shown as draft suggestions only
   - teacher can accept, reject, or edit them
   - exam becomes publishable only after human review

7. Add student attempt flow
   - student sees only assigned exams
   - exam is served from the server with auth and school checks
   - timers and autosave run client-side, with server-side recovery snapshots stored

8. Add autosave and recovery
   - each answer change is saved as a local draft
   - periodic snapshots are sent to the server
   - if a connection drops, the student can restore the last autosaved state

9. Add grading flow
   - auto-grade objective questions
   - short answers and long answers receive teacher review
   - AI suggestions for marks remain draft until teacher approval

10. Add results publishing

- only teacher or admin can publish results
- each result remains associated to the school and student
- no cross-school result leakage is allowed

## 5) Code files

### supabase/migrations/004_exam_engine.sql

```sql
create type question_type as enum (
  'mcq',
  'true_false',
  'short_answer',
  'long_answer',
  'fill_blank',
  'matching'
);

create type exam_publish_state as enum (
  'draft',
  'under_review',
  'published',
  'closed'
);

create table question_banks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table exam_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  question_bank_id uuid references question_banks(id) on delete cascade,
  created_by uuid not null references users(id),
  question_type question_type not null,
  prompt text not null,
  options jsonb default '[]',
  answer_key jsonb default '{}',
  marks integer not null default 1,
  explanation text,
  difficulty text not null default 'medium',
  created_at timestamptz not null default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  created_by uuid not null references users(id),
  title text not null,
  instructions text,
  subject_id uuid references subjects(id),
  publish_state exam_publish_state not null default 'draft',
  duration_minutes integer not null default 60,
  total_marks integer not null default 0,
  start_time timestamptz,
  end_time timestamptz,
  randomize_questions boolean not null default false,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exam_question_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  question_id uuid not null references exam_questions(id) on delete cascade,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique (school_id, exam_id, question_id)
);

create table exam_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  section text,
  created_at timestamptz not null default now(),
  unique (school_id, exam_id, class_id, section)
);

create table exam_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  started_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'not_started',
  answers jsonb default '{}',
  autosave_snapshot jsonb default '{}',
  monitoring_events jsonb default '[]',
  score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, exam_id, student_id)
);

create index idx_exam_questions_school on exam_questions(school_id);
create index idx_exams_status_school on exams(school_id, publish_state);
create index idx_exam_attempts_school_status on exam_attempts(school_id, status);

create trigger exams_updated_at
before update on exams
for each row execute procedure set_updated_at();

create trigger exam_attempts_updated_at
before update on exam_attempts
for each row execute procedure set_updated_at();
```

### apps/web/src/features/exams/types.ts

```ts
export type QuestionType =
  | "mcq"
  | "true_false"
  | "short_answer"
  | "long_answer"
  | "fill_blank"
  | "matching";

export type PublishState = "draft" | "under_review" | "published" | "closed";

export type Question = {
  id: string;
  schoolId: string;
  questionBankId?: string;
  questionType: QuestionType;
  prompt: string;
  options?: string[];
  answerKey?: Record<string, unknown>;
  marks: number;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
};

export type Exam = {
  id: string;
  schoolId: string;
  title: string;
  instructions?: string;
  subjectId?: string;
  publishState: PublishState;
  durationMinutes: number;
  totalMarks: number;
  startTime?: string;
  endTime?: string;
  randomizeQuestions: boolean;
  createdBy: string;
};

export type ExamAttempt = {
  id: string;
  examId: string;
  studentId: string;
  status: "not_started" | "in_progress" | "submitted" | "locked";
  answers: Record<string, unknown>;
  autosaveSnapshot?: Record<string, unknown>;
  score?: number;
};
```

### apps/web/src/features/exams/ExamBuilder.tsx

```tsx
import { useMemo, useState } from "react";

const sampleQuestions = [
  {
    id: "q1",
    prompt: "Which planet is known as the Red Planet?",
    type: "mcq",
    marks: 2,
    options: ["Earth", "Mars", "Venus", "Jupiter"],
  },
  {
    id: "q2",
    prompt: "Write one difference between plant and animal cells.",
    type: "short_answer",
    marks: 5,
  },
];

export function ExamBuilder() {
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(["q1"]);
  const totalMarks = useMemo(
    () =>
      sampleQuestions
        .filter((q) => selectedQuestions.includes(q.id))
        .reduce((sum, q) => sum + q.marks, 0),
    [selectedQuestions],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Exam Builder
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Create assessment
          </h2>
        </div>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Save draft
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-0 focus:border-indigo-400"
            defaultValue="Unit Test - Biology"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Duration (minutes)
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
            defaultValue="45"
          />
        </label>
      </div>

      <div className="mt-6 space-y-3">
        {sampleQuestions.map((question) => (
          <label
            key={question.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
          >
            <div>
              <p className="font-medium text-slate-900">{question.prompt}</p>
              <p className="text-sm text-slate-500">
                {question.type} • {question.marks} marks
              </p>
            </div>
            <input
              type="checkbox"
              checked={selectedQuestions.includes(question.id)}
              onChange={() => {
                setSelectedQuestions((current) =>
                  current.includes(question.id)
                    ? current.filter((id) => id !== question.id)
                    : [...current, question.id],
                );
              }}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
        <span>Selected questions</span>
        <span>
          {selectedQuestions.length} • {totalMarks} marks
        </span>
      </div>
    </div>
  );
}
```

## 6) Configuration

Exact variables for this milestone:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_API_BASE_URL`
- `APP_ENV`

Where to set them:

- local machine: `.env` file in the app root or worker root
- Cloudflare Worker environment: dashboard settings
- GitHub repo: never store these values in source control
- this milestone should not use real production secrets

## 7) Commands

Run from the repo root:

```bash
cd /workspaces/Examify
git status
```

Run local web app checks:

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

If you later add the worker API for exam routes:

```bash
cd /workspaces/Examify/apps/workers
npm install
npm run build
```

## 8) Verification

Expected results:

- exam schema runs without SQL errors
- question bank records are created successfully
- exam builder UI loads with sample question data
- one exam can be saved as draft and display total marks
- no cross-school records are visible in the app or SQL queries
- AI suggestion flow is clearly labeled as review-only

## 9) Troubleshooting

Problem: exam schema fails because tables are missing

- likely cause: required base tables were not created first
- fix: run Milestone 3 schema before exam schema

Problem: question type enum errors

- likely cause: enum type name conflict or old migration state
- fix: check migration order and run only the new migration file after the base schema

Problem: teacher sees unauthorized classes

- likely cause: role checks are missing or not enforced server-side
- fix: add school_id and teacher_id validation in API routes

Problem: exam marks do not calculate correctly

- likely cause: selected questions are counted incorrectly or marks field is blank
- fix: validate marks and total calculation on save

Problem: autosave fails silently

- likely cause: local storage or API endpoint not handling the payload correctly
- fix: first test the autosave payload format and verify the endpoint accepts JSON data

## 10) Security check

Important checks before moving to the next milestone:

- all exam records are scoped to school_id
- teachers can only see exam records for their own school
- no student can access another school’s exam or result data
- AI-generated marks remain suggestions until teacher approval
- all publish action must be server-side and role-checked
- no student may modify exam data or marks through the browser
- no real student data or production answers are stored yet

## 11) GitHub checkpoint

Before continuing:

```bash
cd /workspaces/Examify
git add .
git commit -m "feat: add exam engine schema and builder foundation"
git push origin main
```

Then confirm:

```bash
git status
git log -1
```

## 12) Completion checklist

- [ ] exam schema created
- [ ] question types supported in design
- [ ] question bank flow planned and tested
- [ ] exam builder created with draft save flow
- [ ] teacher review workflow defined
- [ ] autosave/recovery flow planned
- [ ] grading review path designed
- [ ] tenant isolation tested for exams
- [ ] GitHub checkpoint completed

## 13) Next step

The next step is Milestone 5: Queries and communities.

That milestone will build on the exam foundation by adding:

- query and ticket system
- assignment rules by teacher and subject
- escalation and deadlines
- group-based communities
- announcements and moderation
- notification flows

We will not move to that milestone until the exam engine foundation and security checks above are verified.
