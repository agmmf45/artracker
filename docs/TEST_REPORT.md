# Test report

Only results that were actually executed are listed. Date of run: 2026-11-18, local Windows 11, Node 24, wrangler 4.164 (local D1).

## Automated
| Suite | Command | Result |
|---|---|---|
| Unit (capture parser AR/EN, recurrence, XP ledger & levels, habits/streaks/rest days, ICS round-trip, prayer times, study grades/GPA/plan, FSRS, focus overlap, finance balances & SMS parser, workout math, sleep, v4 migration) | `npx vitest run` | **60 passed** |
| API integration incl. two-account isolation, CSRF, idempotent push, LWW conflicts, append-only XP, friend accept guard, removed `/users` | `API_URL=http://127.0.0.1:8787 npx vitest run` | **69 passed** (60 + 9 API) |
| Type check (app, worker, tests) | `npx tsc -b --noEmit` | clean |
| Lint | `npx eslint .` | clean |
| Production build | `npx vite build` | success; main chunk 113 kB, vendors split; PWA SW generated |

## Manual browser verification (built-in browser, local)
- Sign-up → onboarding → Overview renders all 5 layers with empty states. ✅
- Quick capture "ذاكر باثولوجي اليوم الساعة 9 مساءً لمدة ساعة !" → preview (today 9:00 PM, 60 min, study) → appears in Overview glance, timeline and next step. ✅
- Completing that task → +20 XP once; un-completing → reversal, net 0 (inspected IndexedDB). ✅
- All 58 routes opened with no error boundary triggered (Life 18, Study 15, Health 12, Settings 13). ✅
- v4 account (fixture `tests/fixtures/legacy-blob.json`) → 27 items migrated; wallet 2,185 SAR + savings 300 SAR (6% of 5,000) — transfer counted once; habits with sub-steps; PR 75 kg×6; weight 77.6; v4 "ocean" theme applied; display name kept (bug found and fixed during this test). ✅
- Production build served by the Worker: SPA fallback 200, `/sw.js` 200, CSP + X-Frame-Options present, no console errors, SW controlling the page. ✅

## Not yet verified
- Playwright E2E suite (not written yet) and automated accessibility (axe).
- Google sign-in on localhost (OAuth origin is only authorized for daqeeq.org).
- AI endpoints with a real key (no key configured locally) — consent and "unavailable" paths only.
- R2 uploads in production (bucket not created).
- Physical iOS/Android devices.
