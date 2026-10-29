CREATE TABLE subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE teacher_subjects(teacher_id TEXT NOT NULL REFERENCES users(id),class_id TEXT NOT NULL REFERENCES classes(id),subject_id TEXT NOT NULL REFERENCES subjects(id),PRIMARY KEY(teacher_id,class_id,subject_id));
CREATE TABLE media(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),object_key TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL);
