CREATE TABLE auth_limits (
  key TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  hits INTEGER NOT NULL CHECK (hits > 0)
);
