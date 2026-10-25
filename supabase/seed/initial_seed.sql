insert into schools (id, name, slug, domain, settings)
values
  ('11111111-1111-4111-8111-111111111111', 'Green Valley School', 'green-valley', 'greenvalley.example', '{"region":"north"}'),
  ('22222222-2222-4222-8222-222222222222', 'Blue Horizon Academy', 'blue-horizon', 'bluehorizon.example', '{"region":"south"}');

insert into users (id, school_id, email, full_name, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner@greenvalley.example', 'Platform Owner', 'platform_owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'admin@greenvalley.example', 'School Admin', 'school_admin'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', 'teacher@greenvalley.example', 'Teacher One', 'teacher'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'student@greenvalley.example', 'Student One', 'student'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', 'admin@bluehorizon.example', 'Admin Two', 'school_admin');

insert into classes (id, school_id, name, section, grade_level)
values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Class 9', 'A', '9'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Class 10', 'B', '10');

insert into subjects (id, school_id, name, code)
values
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Mathematics', 'MATH'),
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'Biology', 'BIO');
