-- Migration 002: Google OAuth integration
-- Run once:
--   npx wrangler d1 execute artracker-db --remote --file=db/migrations/002_google_auth.sql

ALTER TABLE users ADD COLUMN google_id       TEXT;
ALTER TABLE users ADD COLUMN profile_picture TEXT;
ALTER TABLE users ADD COLUMN last_login_at   TEXT;

-- Unique index allows fast look-up by Google sub; NULLs are excluded (SQLite UNIQUE behaviour)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
