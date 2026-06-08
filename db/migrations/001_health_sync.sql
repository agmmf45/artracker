-- Migration 001: Health Platform Integration
-- Run: wrangler d1 execute artracker-db --file=db/migrations/001_health_sync.sql

-- Per-user, per-platform sync state
CREATE TABLE IF NOT EXISTS health_sync (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  platform         TEXT NOT NULL CHECK(platform IN ('healthkit','health_connect')),
  last_sync_at     TEXT,
  last_pull_cursor TEXT,        -- ISO timestamp: fetch records AFTER this point
  status           TEXT NOT NULL DEFAULT 'idle'
                   CHECK(status IN ('idle','syncing','error','disabled')),
  error_msg        TEXT,
  records_pushed   INTEGER NOT NULL DEFAULT 0,
  records_pulled   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE(user_id, platform)
);

-- Deduplication registry: prevents writing the same record twice
-- hash = SHA256-like fingerprint built from (userId|dataType|sourceId|date|value)
CREATE TABLE IF NOT EXISTS sync_dedup (
  record_hash TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  data_type   TEXT NOT NULL,   -- 'workout'|'nutrition'|'bodyweight'|'steps'|'water'
  source      TEXT NOT NULL,   -- 'app'|'healthkit'|'health_connect'
  synced_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_sync_user    ON health_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_dedup_user     ON sync_dedup(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_sync_dedup_synced   ON sync_dedup(synced_at);
