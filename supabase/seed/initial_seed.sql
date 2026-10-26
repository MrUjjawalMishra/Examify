-- ============================================================================
-- SYNTHETIC PILOT SEED DATA (NO REAL STUDENT DATA)
-- ============================================================================
INSERT INTO schools (id, code, name, city, state, status, plan_tier, query_min_sla_hours, query_max_sla_hours, max_tab_violations)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'GREENVALLEY-VNS', 'Green Valley Public School (Demo)', 'Varanasi', 'Uttar Pradesh', 'pilot', 'pilot', 48, 168, 3),
  ('22222222-2222-4222-8222-222222222222', 'SUNRISE-LKO', 'Sunrise Academy (Demo)', 'Lucknow', 'Uttar Pradesh', 'active', 'standard', 48, 120, 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO classes (id, school_id, name, academic_year)
VALUES
  ('c9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Class 9', '2026-27'),
  ('c1100000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Class 11', '2026-27')
ON CONFLICT DO NOTHING;

INSERT INTO sections (id, school_id, class_id, name)
VALUES
  ('5ec00000-0000-4000-8000-00000000009a', '11111111-1111-4111-8111-111111111111', 'c9000000-0000-4000-8000-000000000001', 'A'),
  ('5ec00000-0000-4000-8000-00000000009c', '11111111-1111-4111-8111-111111111111', 'c9000000-0000-4000-8000-000000000001', 'C'),
  ('5ec00000-0000-4000-8000-00000000011a', '11111111-1111-4111-8111-111111111111', 'c1100000-0000-4000-8000-000000000002', 'A')
ON CONFLICT DO NOTHING;

INSERT INTO subjects (id, school_id, code, name)
VALUES
  ('50b00000-0000-4000-8000-000000000165', '11111111-1111-4111-8111-111111111111', 'CA-165', 'Computer Applications'),
  ('50b00000-0000-4000-8000-000000000083', '11111111-1111-4111-8111-111111111111', 'CS-083', 'Computer Science'),
  ('50b00000-0000-4000-8000-000000000041', '11111111-1111-4111-8111-111111111111', 'MATH-041', 'Mathematics')
ON CONFLICT DO NOTHING;