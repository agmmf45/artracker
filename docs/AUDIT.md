# Daqeeq v4.6 → v5 (Life OS) — Repository Audit

Audit of the v4.6 codebase (commit `08a3231`, checkpoint tag `v4.6-pre-lifeos`) before the Life OS transformation.
The original files are preserved unchanged under `legacy/`.

## 1. Architecture found

| Area | v4.6 |
|---|---|
| Frontend | One file `index.html` — 7,933 lines / 432 KB of inline HTML + CSS + vanilla JS; global `myData` object; 283 inline `onclick` handlers; add-on scripts (`themes.js`, `water-tracker.js`, `exercise-explorer.js`, `health-sync/*`) that monkey-patch globals (`showPage`, `saveMyData`, `renderNutrition`, `startApp`, …). |
| Backend | One Cloudflare Worker `worker.js` (if-chain router, no method checks). |
| Database | D1 `artracker-db`. **All user data = one JSON blob per user** (`users.data`), fully rewritten on each save (last-write-wins). Base tables `users`/`sessions` had no migration in the repo. |
| Auth | Email/password (PBKDF2 100k) + Google ID token via `tokeninfo`. Bearer token stored in `localStorage`. |
| Hosting | Workers static assets from repo root; custom domains `daqeeq.org`, `www.daqeeq.org`. Manual `wrangler deploy` from this machine. |
| Tooling | No build, no lint, no type checking, no CI. Only browser-run health-sync tests. |
| PWA | `sw.js` (`artrk-v9`) network-first HTML, stale-while-revalidate assets, cache bust by hand-editing `?v=4.5`. |
| AI | Client calls an external worker `artrk-ai.agmmf45.workers.dev` directly with model + system prompt chosen by the client. |

## 2. Feature inventory and classification

| Feature (v4) | Decision | v5 destination |
|---|---|---|
| Habits (+subtasks, streaks, per-day notes) | **Improve** | Life › Habits — schedules, numeric/time habits, rest days, routines, heatmap |
| To-dos (priority, category, due) | **Replace** (superset) | Life › Tasks — subtasks, recurrence, views, smart lists, dependencies |
| Wallets / expenses / savings transfers (linkId), undo | **Improve** (fix balance bug) | Life › Finance |
| AI expense entry + bank SMS import | **Preserve** behind server proxy + consent | Life › Finance |
| AI habit/todo assistant | **Merge** | Quick capture + Inbox "organize with AI" |
| Stats board | **Replace** | Life › Overview (5-layer dashboard) |
| Daily notes + templates | **Merge** | Life › Journal (+ Notes) |
| Hijri/Gregorian calendar + reminders | **Improve** | Life › Calendar (Intl Umm al-Qura instead of hard-coded 2025–26 tables) |
| Trophies + confetti | **Merge** | Life › Journey (XP ledger, achievements) |
| Friends (codes, requests, compare) | **Refactor** (security) | Life › Friends on `friendships`/`friend_requests` tables |
| Profile, avatar, 13 themes | **Preserve** | Settings › Profile / Appearance (themes as accent overrides) |
| Fitness: programs, live session, PRs, volume, body weight, muscle map, Exercise Explorer | **Preserve + improve** (session survives refresh) | Health › Workouts / Weight |
| Nutrition + AI vision meal analysis (multi-image, macros, confidence, tips) | **Preserve** behind consent | Health › Nutrition |
| Water tracker | **Improve** (UTC date bug) | Health › Water |
| Reminders (foreground poll) | **Improve** | Reminder engine + Settings › Notifications |
| PDF report | **Replace** | Settings › Data exports (JSON/CSV/MD/ICS) |
| Account reset | **Replace** | Trash + account deletion with confirmation |
| 3D cat, inline theme list, `updateTrophyBadge`, hidden todo selects | **Remove** (dead code) | — |
| HealthKit / Health Connect sync (Capacitor) | **Preserve as-is** (inactive on web; native app never built) | `legacy/health-sync`, marked Blocked |

## 3. Security findings

| # | Finding | Severity | Fix in v5 |
|---|---|---|---|
| S1 | No HTML escaping anywhere; friends' names/notes/photos and AI output inserted with `innerHTML` → stored XSS between accounts | Critical | React rendering (auto-escaped); no `dangerouslySetInnerHTML` with user content |
| S2 | `/api/users` returned every account's profile, habits, photo and friend code to any user | High | Endpoint removed (returns `[]`); friends see a minimal card only |
| S3 | `friend/accept` did not check a pending request exists → force-friend anyone | High | Requires a row in `friend_requests` (tested) |
| S4 | Sessions never expired (`expires_at` unchecked) | High | Expiry enforced + sliding renewal; tokens stored as SHA-256 hashes |
| S5 | AI proxy unauthenticated; client picks model + system prompt (open relay at owner's cost) | High | `/api/ai/:task` in this Worker: auth, rate limits, server-owned prompts, consent for sensitive data |
| S6 | Anthropic key present in git history of remote branch `origin/claude/explore-capabilities-6snBD` and in local `index.original.backup.html` | High | **Owner action**: revoke the key; branch deletion needs approval |
| S7 | No rate limiting (login brute force, signup spam, paid ExerciseDB proxy) | Medium | D1 fixed-window limiter on auth, push, AI, uploads, exercises |
| S8 | `change-password` without current password | Medium | Current password required (or fresh session for Google-only accounts); other sessions revoked |
| S9 | Google login linked to an existing account by email without `email_verified` | Medium | Linking requires `email_verified=true`; `iss`/`exp` checked |
| S10 | Login revealed whether an email is registered; non-constant-time hash compare | Low | Generic error, constant-time compare, PBKDF2 always executed |
| S11 | Bearer token in `localStorage` (readable by any XSS) | Medium | HttpOnly `Secure` `SameSite=Lax` cookie + `X-Daqeeq` header CSRF guard; legacy token adopted once then removed |
| S12 | No security headers / CSP | Medium | `public/_headers`: CSP, frame-ancestors none, nosniff, referrer policy |
| S13 | Internal error messages returned to clients | Low | Generic 500 message; details only in logs |
| S14 | XSS from third-party ExerciseDB fields in `exercise-explorer.js` | Medium | Rendered through React in v5 |
| S15 | `sync_dedup.record_hash` primary key is global, not per user | Low | Documented; table unused by the web app |

## 4. Data integrity / logic bugs found

- Lost friend requests: server wrote into the other user's blob; that user's next full save overwrote it.
- Wallet totals subtracted savings twice (savings wallet showed negative after a transfer).
- Deleting a wallet left orphaned transactions and legacy `expenses` rows still counted in stats.
- Water used UTC day keys (entries before 03:00 KSA landed on the previous day).
- Islamic events table hard-coded for 2025–2026 only.
- Active workout lived only in memory (lost on refresh); PR checks triggered full-blob saves mid-workout.
- `DEFAULT_HABITS` assigned by reference and mutated by AI suggestions.
- Scroll lock missed 7 modals; `confirmDate` didn't refresh the expense date label.
- 2 MB D1 row ceiling with base64 meal photos inside the blob.

## 5. Performance / accessibility / mobile

- 432 KB single HTML parsed on every load; ~27 KB inline base64 icons; ~34 KB dead code.
- Every toggle sent the entire blob (including photos) with no debounce.
- One breakpoint (680 px); hover-only edit buttons on wallets.
- 21 ARIA attributes total; clickable `div`s without roles; no dialog semantics, focus trap or Esc; 7–9 px text.

## 6. Decisions

See `docs/ARCHITECTURE.md`. Summary: Vite + React 19 + TypeScript strict; Tailwind v4 with design tokens; Dexie (IndexedDB) local-first store with an outbox/rev-cursor sync engine; Hono Worker; per-record D1 table with PK `(user_id, id)`; append-only XP ledger; additive migrations; v4 blob preserved and snapshotted.
