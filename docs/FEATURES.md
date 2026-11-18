# Feature registry

States: **Verified** (exercised in browser and/or tests) · **Implemented** (built, typechecked, not individually exercised) · **Blocked** (needs owner action) · **Planned**.
All features persist through the same `records` table (DB ✓) and sync API (API ✓).

| Feature | Module | Status | Tests | Notes / limitations |
|---|---|---|---|---|
| Auth (email, Google), sessions, CSRF, rate limits | Core | Verified | API | Google verified only on daqeeq.org origin |
| Local-first sync, offline, idempotency | Core | Verified | API + manual | LWW by device clock |
| v4 → v5 migration | Core | Verified | unit + manual | photos >1.1 MB skipped (reported) |
| Overview (5 layers, presets, per-device layout) | Life | Verified | manual | |
| Quick capture + NL parser (AR/EN) | Life | Verified | unit + manual | rule-based, no AI needed |
| Command palette (Ctrl/Cmd+K) | Life | Implemented | — | private records excluded |
| Tasks (views, recurrence, subtasks, deps, bulk, smart lists) | Life | Verified (core flows) | unit | |
| Today, Planner (workload, conflicts, breaks) | Life | Implemented | — | |
| Calendar (day/week/month/agenda, drag, Hijri, prayer, ICS) | Life | Implemented | unit (ICS, prayer) | Google Calendar sync Blocked (OAuth setup) |
| Inbox | Life | Implemented | — | |
| Habits & routines (rest days, heatmap, notes) | Life | Verified | unit | |
| Goals, vision board, projects, milestones | Life | Implemented | — | |
| Notes / Second Brain (Markdown, links, backlinks, graph, history, PARA) | Life | Implemented | — | no WYSIWYG block editor |
| Journal (mood/energy, prompts, templates, lock) | Life | Implemented | — | |
| Finance (wallets, savings, budget, report, SMS/AI) | Life | Verified (balances) | unit | AI path needs key |
| Subscriptions, Library/collections | Life | Implemented | — | built by worker agent, reviewed |
| Reviews (daily/weekly/monthly/annual) | Life | Implemented | — | |
| Journey: XP, levels, skills, achievements, quests, rewards, garden | Life | Verified (XP) | unit | |
| Friends | Life | Verified (API) | API | |
| Study: courses, timetable, lectures, exams, assignments | Study | Implemented | — | |
| Study planner | Study | Implemented | unit | |
| Focus timer (refresh-safe, no double counting) | Study | Implemented | unit | |
| Flashcards (FSRS, cloze, import/export) | Study | Implemented | unit | |
| Question bank (timed, mistakes) | Study | Implemented | — | |
| Dental clinical tracker + OSCE | Study | Implemented | — | template numbers are examples |
| Research, references, resources | Study | Implemented | — | |
| Grades & GPA (+ target simulation) | Study | Implemented | unit | |
| Academic analytics | Study | Implemented | — | |
| Workouts (live session, programs, PRs, muscle map, explorer, videos) | Health | Verified (migrated data) | unit | ExerciseDB needs key |
| Nutrition (+ AI photo analysis, portion rescale) | Health | Implemented | — | AI needs key + consent |
| Water, sleep, weight, measurements, progress photos | Health | Implemented | unit (sleep) | photos inline until R2 |
| Meal planner, recovery, activity, medication, records | Health | Implemented | — | |
| Reminders / notification center | Settings | Implemented | — | push while closed: Planned (VAPID) |
| Export/import (JSON, CSV, MD, ICS), trash, reset, delete account | Settings | Implemented | — | |
| Apple Health / Health Connect | Health | Blocked | — | needs native app (code kept in `legacy/`) |
| AI assistant (plan day, flashcards, summaries, break down) | Cross | Implemented | — | Blocked on `ANTHROPIC_API_KEY` |
| E2E (Playwright) & axe accessibility suite | QA | Planned | — | |
