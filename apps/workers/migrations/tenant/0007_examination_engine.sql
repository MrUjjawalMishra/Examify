CREATE TABLE examinations (
 id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES question_papers(id),
 teacher_id TEXT NOT NULL REFERENCES users(id), class_id TEXT NOT NULL REFERENCES classes(id),
 subject_id TEXT NOT NULL REFERENCES subjects(id), title TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), total_units INTEGER NOT NULL CHECK(total_units>0),
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
 duration_ms INTEGER NOT NULL CHECK(duration_ms BETWEEN 60000 AND 14400000),
 state TEXT NOT NULL CHECK(state IN ('scheduled','ended','published')),
 shuffle_questions INTEGER NOT NULL CHECK(shuffle_questions IN (0,1)),
 shuffle_options INTEGER NOT NULL CHECK(shuffle_options IN (0,1)),
 negative_percent INTEGER NOT NULL CHECK(negative_percent IN (0,25,50,100)),
 show_answers INTEGER NOT NULL CHECK(show_answers IN (0,1)),
 integrity_mode TEXT NOT NULL CHECK(integrity_mode IN ('off','standard','strict')),
 request_id TEXT NOT NULL, created_at INTEGER NOT NULL, published_at INTEGER, request_digest TEXT NOT NULL,
 UNIQUE(teacher_id,request_id)
);
CREATE INDEX examinations_class_window ON examinations(class_id,starts_at,ends_at);
CREATE TRIGGER exam_snapshot_immutable BEFORE UPDATE OF paper_id,teacher_id,class_id,subject_id,title,snapshot_json,total_units,starts_at,duration_ms,shuffle_questions,shuffle_options,negative_percent,show_answers,integrity_mode ON examinations BEGIN
 SELECT RAISE(ABORT,'exam snapshot is immutable');
END;
CREATE TABLE exam_attempts (
 id TEXT PRIMARY KEY, exam_id TEXT NOT NULL REFERENCES examinations(id), student_id TEXT NOT NULL REFERENCES users(id),
 started_at INTEGER NOT NULL, deadline INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('in_progress','submitted','finalized')),
 order_json TEXT NOT NULL CHECK(json_valid(order_json)), submitted_at INTEGER, reason TEXT,
 UNIQUE(exam_id,student_id)
);
CREATE INDEX attempts_deadline ON exam_attempts(state,deadline);
CREATE TABLE exam_answers (
 attempt_id TEXT NOT NULL REFERENCES exam_attempts(id), question_index INTEGER NOT NULL,
 value_json TEXT NOT NULL CHECK(json_valid(value_json)), revision INTEGER NOT NULL CHECK(revision>0),
 operation_id TEXT NOT NULL, marked INTEGER NOT NULL CHECK(marked IN (0,1)), saved_at INTEGER NOT NULL,
 PRIMARY KEY(attempt_id,question_index)
);
CREATE TABLE exam_grades (
 attempt_id TEXT NOT NULL REFERENCES exam_attempts(id), question_index INTEGER NOT NULL,
 units INTEGER NOT NULL, max_units INTEGER NOT NULL CHECK(max_units>0),
 confirmed INTEGER NOT NULL CHECK(confirmed IN (0,1)), comment TEXT NOT NULL DEFAULT '',
 flagged INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0,1)), revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(attempt_id,question_index), CHECK(units>=-max_units AND units<=max_units)
);
CREATE TABLE exam_grade_history (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, question_index INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), units INTEGER NOT NULL, comment TEXT NOT NULL,
 confirmed INTEGER NOT NULL, revision INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE exam_integrity_events (
 attempt_id TEXT NOT NULL REFERENCES exam_attempts(id), event_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('hidden','blur','fullscreen_exit','disconnect')),
 created_at INTEGER NOT NULL, PRIMARY KEY(attempt_id,event_id)
);

CREATE TRIGGER grade_history_no_update BEFORE UPDATE ON exam_grade_history BEGIN
 SELECT RAISE(ABORT,'grade history is append-only');
END;
CREATE TRIGGER grade_history_no_delete BEFORE DELETE ON exam_grade_history BEGIN
 SELECT RAISE(ABORT,'grade history is append-only');
END;
