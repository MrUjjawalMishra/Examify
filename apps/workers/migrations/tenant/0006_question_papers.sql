CREATE TABLE question_papers (
 id TEXT PRIMARY KEY,
 teacher_id TEXT NOT NULL REFERENCES users(id),
 class_id TEXT NOT NULL REFERENCES classes(id),
 subject_id TEXT NOT NULL REFERENCES subjects(id),
 title TEXT NOT NULL,
 questions_json TEXT NOT NULL CHECK(json_valid(questions_json)),
 total_marks REAL NOT NULL CHECK(total_marks>0 AND total_marks<=1000),
 request_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(teacher_id,request_id)
);
CREATE INDEX question_papers_teacher ON question_papers(teacher_id,created_at);
