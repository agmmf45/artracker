# دقيق — Daqeeq v5 (Life OS)

A calm, Arabic-first personal operating system: **Life · Study · Health · Settings** in one PWA.
Tasks, calendar, habits, notes, journal, goals, projects, finance, study (courses, exams, flashcards,
dental clinical tracker, GPA), health (workouts, nutrition, water, sleep), reviews and an optional
XP/achievement journey — all from one local-first data model synced to Cloudflare.

## Stack
- **Frontend**: Vite 7 · React 19 · TypeScript (strict) · Tailwind CSS v4 (design tokens in `src/design/tokens.css`) · React Router 7 · Radix UI + vaul · Dexie (IndexedDB)
- **Backend**: Cloudflare Worker (`worker/`, Hono) · D1 (`migrations/`) · optional R2 for files
- **Shared**: `shared/` — record schemas (zod), XP rules, v4→v5 migration

## Develop
```bash
npm install
npm run db:migrate:local      # create the local D1 schema
npm run dev:api               # Worker + local D1 on :8787
npm run dev                   # Vite on :5173 (proxies /api to :8787)
```
Local-only rate-limit relaxation for tests lives in `.dev.vars` (see `.env.example`).
Thmanyah font files are licensed and not committed — copy them into `public/fonts/`.

## Quality gates
```bash
npm run typecheck   # tsc -b
npm run lint        # eslint
npm test            # vitest (unit)
API_URL=http://127.0.0.1:8787 npx vitest run tests/api.test.ts   # API + two-account isolation (needs dev:api)
npm run build       # production build into dist/
```

## Deploy (owner only)
Nothing is deployed automatically. Before the first v5 deploy:
1. Revoke the leaked Anthropic key (see `docs/SECURITY_REVIEW.md`).
2. `npx wrangler r2 bucket create daqeeq-files` (or remove the `r2_buckets` block — the app works without file storage).
3. Optional secrets: `npx wrangler secret put ANTHROPIC_API_KEY`, `npx wrangler secret put EXERCISEDB_KEY`.
4. `npm run db:migrate:remote` (additive; `users.data` is never modified).
5. `npm run deploy`.
Rollback: `git checkout v4.6-pre-lifeos` and deploy — v5 migrations are additive, so v4 keeps working on the same database.

## Docs
`docs/AUDIT.md` · `docs/ARCHITECTURE.md` · `docs/DATABASE_PLAN.md` · `docs/SECURITY_REVIEW.md` · `docs/DESIGN_SYSTEM.md` · `docs/PRODUCT_SPEC.md` · `docs/FEATURES.md` · `docs/TEST_REPORT.md` · `docs/PROGRESS.md` · `docs/IMPLEMENTATION_PLAN.md` · `CHANGELOG.md`

The original v4 app is preserved untouched in `legacy/`.
