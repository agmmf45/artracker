# Architecture

```
Browser (PWA)                                        Cloudflare
┌─────────────────────────────┐                     ┌───────────────────────────────┐
│ React UI (src/modules/*)    │                     │ Worker (worker/index.ts, Hono) │
│   ↓ hooks (useRecords…)     │                     │  /api/auth/*   cookie sessions │
│ repo.ts — the only writer   │  push (outbox)  ──▶ │  /api/v2/sync  pull / push     │
│ Dexie: records · outbox     │  ◀── pull (rev)     │  /api/v2/friends, account,     │
│ sync.ts — local-first       │                     │  files, /api/ai/*, /exercises  │
└─────────────────────────────┘                     │ D1: users, sessions, records,  │
                                                    │     mutations, friendships…    │
                                                    │ R2 (optional): private files   │
                                                    └───────────────────────────────┘
```

## Principles
- **One record per item, one source of truth.** An exam is one `exam` record; Study, Calendar and Overview all read it. Calendar items, dashboard metrics and reviews are *derived views*, never copies.
- **Local-first.** Every write goes to IndexedDB + outbox in one transaction (`src/core/repo.ts`), so the UI is instant and works offline; `src/core/sync.ts` pushes/pulls in the background.
- **Modular monolith.** Domains live in `src/modules/{life,study,health,settings}` with their own `model.ts` (pure logic, unit-tested) and pages. Shared building blocks: `src/core/*` (data, dates, recurrence, XP, i18n, capture parser), `src/design/*` (tokens, UI primitives, charts, overlays).
- **Pages are discovered, not hard-coded.** `src/app/registry.ts` lists all pages; only files that exist are routed. Modules can be hidden in Settings without touching data.

## Sync protocol
- `GET /api/v2/sync/pull?since=<rev>` → records with `rev > since` (paged).
- `POST /api/v2/sync/push` `{ mutations: [{ mid, record }] }` → idempotent (`mutations` table), last-writer-wins on `updated_at`, append-only types (`xp`, `redemption`) never overwritten, returns conflicts so the client adopts the server copy.
- Pull runs before push; a pulled record never overwrites a newer un-pushed local edit.
- Revisions come from a per-user counter (`user_rev`) incremented inside the same D1 batch.

## Key flows
- **Recurrence** (`src/core/recurrence.ts`, rrule): tasks stay one record (due moves forward, history logged); events are expanded only for the visible range; per-occurrence skip via `exceptions`.
- **XP** (`shared/xp.ts`, `src/core/xp.ts`): append-only ledger with deterministic ids → no double awards across devices or toggles.
- **v4 migration** (`shared/legacy/migrate.ts`): pure, deterministic; executed server-side once at first v5 login after snapshotting the blob.
- **AI** (`worker/routes/ai.ts`): server-owned prompts per task, auth + rate limits, consent flag for health/finance/journal, JSON output always previewed before any write.

## Notable decisions
| Decision | Why |
|---|---|
| React + TS instead of extending the 7,900-line HTML | dozens of modules, type safety, auto-escaping (fixes stored XSS) |
| Generic `records` table instead of ~50 tables | single sync path, structural ownership via PK `(user_id, id)`, per-type validation in zod; indexed `type/date/parent_id/rev` cover all queries |
| HttpOnly cookie sessions | tokens not readable by scripts; `X-Daqeeq` header blocks CSRF |
| Markdown editor (sanitized) instead of a block editor | small, fast, portable (export = the source), offline-safe |
| Inline base64 photos (`blob` records) until R2 exists | no dependency on owner-side infrastructure; capped per record |
