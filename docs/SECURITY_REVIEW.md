# Security review (v5)

## Fixed (v4 findings → v5)
| v4 issue | v5 status | Evidence |
|---|---|---|
| Stored XSS via `innerHTML` (friends, AI output, notes) | Fixed — React escaping; Markdown is sanitized with DOMPurify | `src/modules/shared/markdown.tsx` |
| `/api/users` exposed every account | Fixed — returns `[]`; friends get a minimal opt-out card | `tests/api.test.ts` |
| Force-friending via `friend/accept` | Fixed — requires a pending request | `tests/api.test.ts` |
| Sessions never expired | Fixed — enforced expiry, sliding renewal, hashed storage, list/revoke | `worker/lib/session.ts` |
| Token in localStorage | Fixed — HttpOnly Secure SameSite=Lax cookie; legacy token adopted then removed | `tests/api.test.ts` (cookie) |
| No CSRF protection | Fixed — `X-Daqeeq` header required for cookie writes | `tests/api.test.ts` (403) |
| No rate limiting | Fixed — auth, push, AI, uploads, exercises, friends, export, delete | `worker/lib/ratelimit.ts` |
| Open AI relay (client-chosen model/prompt, no auth) | Fixed in this repo — `/api/ai/:task` with auth, fixed prompts, consent for sensitive data, caps. **The old `artrk-ai` worker still exists on the owner's account and should be deleted.** | `worker/routes/ai.ts` |
| Change password without current password | Fixed — current required; Google-only needs fresh session; other sessions revoked | `worker/routes/auth.ts` |
| Google linking without `email_verified` | Fixed — plus `iss`/`exp` checks | `worker/routes/auth.ts` |
| Login reveals registered emails | Fixed — generic error, constant-time compare, PBKDF2 always run | `tests/api.test.ts` |
| No security headers | Fixed — CSP, frame-ancestors none, nosniff, referrer policy, COOP | `public/_headers` |
| Error messages leaked | Fixed — generic 500 | `worker/index.ts` |
| Lost updates (blob last-write-wins) | Fixed — per-record LWW + idempotent pushes | `worker/routes/sync.ts` |

## Verified with two accounts
Account B pushing a record with account A's id lands in B's namespace; A's record is unchanged and B's pull never contains A's data (`tests/api.test.ts › isolation`).

## Privacy defaults
Journal, health, medication, measurements, wallets and transactions are `private` records: excluded from global search and calendar previews, never sent to AI without per-category consent (Settings › Privacy). Sign-out deletes the local IndexedDB copy. No third-party analytics.

## Open items (need the owner)
1. **Revoke the Anthropic API key** found in git history on remote branch `origin/claude/explore-capabilities-6snBD` and in the local, gitignored `index.original.backup.html`. Then (with approval) delete that branch.
2. Delete or lock down the external `artrk-ai.agmmf45.workers.dev` worker.
3. Create the R2 bucket (or drop the binding) before deploying.
4. `sync_dedup.record_hash` is still globally unique (legacy table, unused by the web app).
