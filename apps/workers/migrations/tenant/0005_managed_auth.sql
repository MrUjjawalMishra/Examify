CREATE TABLE credential_operations(user_id TEXT PRIMARY KEY REFERENCES users(id),fingerprint TEXT NOT NULL,version INTEGER NOT NULL,created_at INTEGER NOT NULL);

ALTER TABLE users ADD COLUMN managed_fingerprint TEXT;
