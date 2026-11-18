# Database plan (D1)

Migrations are version-controlled in `migrations/` and applied with `wrangler d1 migrations apply`.
All v5 migrations are **additive**: nothing existing is dropped or rewritten, so v4 can keep running on the same database (rollback-safe).

| Migration | Contents |
|---|---|
| `0001_base.sql` | Baseline of tables that already existed in production (`users`, `sessions`, `health_sync`, `sync_dedup`) — all `IF NOT EXISTS` |
| `0002_life_os.sql` | `records`, `user_rev`, `mutations`, `files`, `friendships`, `friend_requests`, `legacy_snapshots`, `rate_limits`; `sessions.user_agent/last_seen_at`; `users.friend_code/migrated_at`; backfill of friend codes, friendships and pending requests from v4 blobs |

## `records` (one row per item)
`PRIMARY KEY (user_id, id)` · `type` · `data` (JSON, ≤200 KB; `blob` ≤1.2 MB) · `parent_id` · `date` · `status` · `private` · `created_at` · `updated_at` · `deleted_at` (trash) · `rev`.
Indexes: `(user_id, rev)` for sync, `(user_id, type, date)` for ranges, `(user_id, parent_id)` for children.

Conceptual entities → record types (see `shared/records.ts`): tasks (`task`), projects/goals/milestones, events, habits + `habit_log`, routines, notes/folders, journal, captures (inbox), wallets/`txn`/budgets/subscriptions, collections, reviews, semesters/courses/lectures/exams/assignments/grades, study sessions, decks/flashcards/card reviews, questions/attempts, clinical requirements/logs, research/references/resources, workouts/programs/PRs, meals/foods/meal plans, water/sleep/measurements/activity/soreness, medication/med logs/health records, xp/achievements/rewards/redemptions/quests, settings/profile/layout singletons, blobs.

## Integrity rules
- Ownership is structural: every statement is scoped by the session's `user_id`; another user's id simply addresses a different row.
- Deterministic ids where duplication must be impossible: habit logs `hl:<habit>:<date>`, XP `xp:<action>:<n>[:rev]`, achievements `ach:<key>`, ICS imports `ics:<uid>`, migrated items `lg:<kind>:<legacyId>`.
- Soft delete (`deleted_at`) for trash/undo; purge keeps a tombstone so other devices learn about it.
- Account deletion removes all user rows across tables in one batch (+ R2 objects).

## XP ledger
Append-only `xp` records. Balance = Σ amount. Un-completing writes a reversal (`…:rev`); re-completing uses the next cycle number, so net XP per action is 0 or one award. Coins = ⌊lifetime net XP / 10⌋ − Σ redemption cost.

## v4 data
`users.data` (the old JSON blob) is never modified by v5. At first v5 login it is copied to `legacy_snapshots` and converted to records (`POST /api/v2/sync/migrate`, idempotent). Users can download the original blob from Settings › Data.
