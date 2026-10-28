CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  class_name TEXT NOT NULL,
  section TEXT NOT NULL,
  UNIQUE(class_name,section)
);
CREATE TABLE teacher_assignments (
  teacher_id TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  PRIMARY KEY(teacher_id,class_id)
);
CREATE TABLE student_enrollments (
  student_id TEXT PRIMARY KEY REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  roll_number TEXT NOT NULL,
  UNIQUE(class_id,roll_number)
);
CREATE TABLE provisioning_requests (
  actor_id TEXT NOT NULL REFERENCES users(id),
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY(actor_id,request_id)
);
