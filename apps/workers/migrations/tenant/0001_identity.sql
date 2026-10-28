PRAGMA foreign_keys = ON;

-- Each school runs this schema in its own D1 database.
CREATE TABLE tenant_identity (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  school_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('provisioning','active','suspended','expired','archived'))
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('school_admin','teacher','student')),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  credential_version INTEGER NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  credential_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;
