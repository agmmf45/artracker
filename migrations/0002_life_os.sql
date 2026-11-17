-- 0002 — Life OS v5: per-record storage, sync revisions, idempotency, files, social, rate limits.
-- Additive only: nothing existing is dropped or rewritten. users.data stays untouched.

-- Session hardening / management
ALTER TABLE sessions ADD COLUMN user_agent   TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Public friend code moves out of the JSON blob into an indexed column
ALTER TABLE users ADD COLUMN friend_code TEXT;
ALTER TABLE users ADD COLUMN migrated_at TEXT;   -- when the v4 blob was converted to records

-- Per-user monotonic revision counter (sync cursor)
CREATE TABLE IF NOT EXISTS user_rev (
  user_id TEXT PRIMARY KEY,
  rev     INTEGER NOT NULL DEFAULT 0
);

-- One row per item (task, note, habit, exam, workout, xp event, ...).
-- PRIMARY KEY (user_id, id) makes cross-account access structurally impossible:
-- every statement is scoped by user_id taken from the verified session.
CREATE TABLE IF NOT EXISTS records (
  user_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  parent_id  TEXT,
  date       TEXT,              -- primary calendar date / timestamp used for range queries
  status     TEXT,
  private    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,              -- soft delete (trash); hard delete only via explicit purge
  rev        INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_records_rev    ON records(user_id, rev);
CREATE INDEX IF NOT EXISTS idx_records_type   ON records(user_id, type, date);
CREATE INDEX IF NOT EXISTS idx_records_parent ON records(user_id, parent_id);

-- Idempotency: a retried push with the same mutation id is applied once
CREATE TABLE IF NOT EXISTS mutations (
  user_id     TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  applied_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, mutation_id)
);

-- R2 object metadata (objects are private; served only to their owner)
CREATE TABLE IF NOT EXISTS files (
  user_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  r2_key     TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  kind       TEXT NOT NULL,     -- avatar | meal | attachment | progress
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

-- Social graph (replaces friends/sent_requests/incoming_requests inside the blob)
CREATE TABLE IF NOT EXISTS friendships (
  user_id    TEXT NOT NULL,
  friend_id  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE TABLE IF NOT EXISTS friend_requests (
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_id);

-- Copy of the v4 blob taken right before conversion (rollback / audit)
CREATE TABLE IF NOT EXISTS legacy_snapshots (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Fixed-window rate limiter
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

-- ── Backfill: friend codes (first owner of a duplicated code wins) ──
UPDATE users
SET friend_code = upper(json_extract(data, '$.friend_code'))
WHERE json_valid(data)
  AND json_extract(data, '$.friend_code') IS NOT NULL
  AND rowid = (
    SELECT MIN(u2.rowid) FROM users u2
    WHERE json_valid(u2.data)
      AND upper(json_extract(u2.data, '$.friend_code')) = upper(json_extract(users.data, '$.friend_code'))
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);

-- ── Backfill: friendships (stored in both directions) ──
INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at)
SELECT u.id, f.id, datetime('now')
FROM users u
JOIN json_each(CASE WHEN json_valid(u.data) THEN u.data ELSE '{}' END, '$.friends') j
JOIN users f ON f.friend_code = upper(j.value)
WHERE f.id <> u.id;

INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at)
SELECT friend_id, user_id, created_at FROM friendships;

-- ── Backfill: pending incoming requests ──
INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at)
SELECT f.id, u.id, datetime('now')
FROM users u
JOIN json_each(CASE WHEN json_valid(u.data) THEN u.data ELSE '{}' END, '$.incoming_requests') j
JOIN users f ON f.friend_code = upper(j.value)
WHERE f.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM friendships x WHERE x.user_id = u.id AND x.friend_id = f.id);
