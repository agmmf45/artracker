-- 0001 — Baseline schema (documents what already exists on production).
-- Every statement is IF NOT EXISTS so it is safe on the live D1 where these
-- tables were created by hand (legacy/db-migrations/001, 002).

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,
  name            TEXT,
  data            TEXT NOT NULL DEFAULT '{}',   -- legacy v4 JSON blob (kept read-only from v5)
  updated_at      TEXT,
  google_id       TEXT,
  profile_picture TEXT,
  last_login_at   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_sync (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  platform         TEXT NOT NULL CHECK(platform IN ('healthkit','health_connect')),
  last_sync_at     TEXT,
  last_pull_cursor TEXT,
  status           TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','syncing','error','disabled')),
  error_msg        TEXT,
  records_pushed   INTEGER NOT NULL DEFAULT 0,
  records_pulled   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE(user_id, platform)
);

CREATE TABLE IF NOT EXISTS sync_dedup (
  record_hash TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  data_type   TEXT NOT NULL,
  source      TEXT NOT NULL,
  synced_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_sync_user  ON health_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_dedup_user   ON sync_dedup(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_sync_dedup_synced ON sync_dedup(synced_at);
