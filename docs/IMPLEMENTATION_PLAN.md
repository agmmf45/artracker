# دقيق v5 — تحويل الموقع إلى Life OS

## السياق
الموقع الحالي "دقيق" (daqeeq.org) هو ملف `index.html` واحد (7,933 سطر، 432KB، JS عادي بدون build) + Cloudflare Worker (`worker.js`) + قاعدة D1 تحفظ **كل بيانات المستخدم في JSON واحد بصف واحد**. المطلوب: تحويله إلى نظام تشغيل شخصي كامل (Life / Study / Health / Settings) حسب البرومت، مع الحفاظ على كل الميزات الشغالة وبيانات المستخدمين، والاسم يبقى **دقيق**.

قرارات المستخدم:
- التقنية: "استعمل كل اللي تحتاج وقوي" → أختار stack حديث متكامل (أدناه).
- التخزين: سجلات منفصلة في D1 + هجرة تلقائية للبيانات الحالية.
- الهوية: دمج — نظام ألوان Life OS كافتراضي (فاتح/داكن) + خط ثمانية + بقاء الثيمات القديمة اختيارية.
- النطاق: أكبر قدر ممكن، مرحلة بعد مرحلة، commit لكل مرحلة.

## نتائج التدقيق (ملخص — التفاصيل تُكتب في `docs/AUDIT.md`)
**ميزات موجودة تُحفظ وتُنقل:** العادات (+subtasks، streaks، ملاحظات)، المهام، المحافظ/المصاريف/الادخار (+تحويل مرتبط linkId، undo)، إدخال مصاريف بالـ AI + استيراد SMS، مساعد AI للعادات، لوحة الإحصاءات، الملاحظات اليومية + القوالب، التقويم الهجري/الميلادي + تذكيرات، الإنجازات/trophies + confetti، الأصدقاء، الملف الشخصي + 13 ثيم، التمارين (برامج، جلسة حيّة، PRs، وزن الجسم، خريطة العضلات + Exercise Explorer)، التغذية + تحليل الوجبات بالصور (AI vision)، الماء، التذكيرات، تصدير PDF، تسجيل دخول Google/إيميل.

**مشاكل حرجة يجب إصلاحها:**
- أمان: لا يوجد escape → Stored XSS بين المستخدمين (أسماء/ملاحظات الأصدقاء في innerHTML)، `/api/users` يرجّع بيانات **كل** المستخدمين لأي مستخدم، `friend/accept` بدون تحقق من وجود طلب، الجلسات **لا تنتهي أبداً** (`expires_at` غير مفحوص)، لا rate limiting، `change-password` بدون كلمة المرور الحالية، ربط Google بدون `email_verified`، كشف وجود الإيميل في login، XSS في exercise-explorer من API خارجي.
- **AI proxy (`artrk-ai.agmmf45.workers.dev`) بدون أي مصادقة** = relay مفتوح على حسابك.
- **مفتاح Anthropic (`sk-ant-api03…`) موجود في تاريخ git على فرع `origin/claude/explore-capabilities-6snBD` في GitHub** + في `index.original.backup.html` محلياً.
- بيانات: آخر حفظ يمسح ما قبله (طلبات الصداقة تضيع)، حد ~2MB للصف، الصور base64 داخل الـ blob، رصيد المحافظ خاطئ مع الادخار (يُطرح مرتين)، حذف محفظة يترك سجلات يتيمة، الماء يستخدم تاريخ UTC، أحداث هجرية مكتوبة يدوياً تنتهي 2026، الجلسة النشطة للتمرين تضيع عند refresh.
- بنية: CSS مكرر (`:root` 3 مرات)، كود ميت (~34KB)، 283 onclick inline، breakpoint واحد، accessibility ضعيفة، لا اختبارات/lint/CI، الـ SW يكاش ردود الأخطاء ويحتاج `?v=` يدوي، لا migrations أساسية لجدول users/sessions.

## التقنية المختارة
| الطبقة | الاختيار | السبب |
|---|---|---|
| Frontend | **Vite + React 19 + TypeScript (strict)** | مشروع بعشرات الوحدات يحتاج مكوّنات + أنواع؛ React يعمل escape تلقائياً (يحل XSS) |
| Routing | React Router v7 (lazy routes لكل قسم) | code-splitting لكل Life/Study/Health |
| Styling | Tailwind CSS v4 + CSS variables tokens + logical properties (`ms-/me-/ps-`) | RTL/LTR تلقائي، tokens موحدة، ثيمات عبر variables |
| مكوّنات أساسية | Radix UI primitives (Dialog, Popover, Dropdown, Tabs, Toast) + `vaul` (bottom sheets) | accessibility جاهزة (focus trap, Esc, ARIA) |
| أيقونات | lucide-react (+ الإبقاء على pixel icons كثيم اختياري) | |
| بيانات محلية | **Dexie (IndexedDB)** + `dexie-react-hooks` (liveQuery) | local-first: فوري، يعمل offline، كل الشاشات تتحدث من نفس السجلات |
| Sync | محرك sync خاص: outbox + pull بـ cursor (rev) | لا مسح متبادل، مزامنة بين الأجهزة |
| Validation | **zod** schemas في `shared/` يستخدمها العميل والـ Worker | |
| Backend | Worker بـ TypeScript + **Hono** router | فصل routes/validation/data |
| DB | D1 + `wrangler d1 migrations` | migrations مرقّمة قابلة للتراجع |
| ملفات | **R2** bucket خاص (صور الوجبات، الأفاتار، المرفقات، صور التقدم) | إخراج base64 من الـ blob |
| تواريخ | date-fns + `Intl` (`islamic-umalqura`) للهجري | هجري صحيح لكل السنوات بدل الجداول اليدوية |
| تكرار | `rrule` | تكرار المهام/الأحداث بدون نسخ لا نهائية |
| محرر الملاحظات | TipTap (ProseMirror) + markdown + KaTeX + tables + task items + `[[backlinks]]` | |
| Flashcards | `ts-fsrs` (خوارزمية FSRS موثقة ومختبرة) | |
| Command palette | `cmdk` | Ctrl/Cmd+K |
| Drag & drop | `@dnd-kit` | bento grid، kanban، calendar، ترتيب |
| PWA | `vite-plugin-pwa` (Workbox) بنفس المسار `/sw.js` | يستبدل SW القديم `artrk-v9` بأمان، hashed assets تلغي `?v=` اليدوي |
| i18n | قاموس ar/en خفيف + `dir` ديناميكي | العربية افتراضي، الإنجليزي مدعوم |
| اختبارات | Vitest (منطق) + Playwright (E2E، حسابين) + axe (accessibility) | |
| جودة | ESLint + Prettier + `tsc --noEmit` | |

## هيكل المستودع الجديد
```
/legacy/            ← index.html الحالي + themes.js + water-tracker.js + exercise-explorer.js + health-sync/ (مرجع ونسخة rollback، لا تُحذف)
/src/               ← تطبيق React
  app/ (shell, router, providers)   design/ (tokens, theme, ui primitives)
  core/ (db Dexie, sync, auth, i18n, dates, recurrence, xp, search, notify)
  modules/life/*  modules/study/*  modules/health/*  modules/settings/*
/worker/            ← Hono API (routes/, services/, middleware/ auth+ratelimit+validation)
/shared/            ← zod schemas + منطق مشترك (legacy migration mapper, xp rules, recurrence)
/migrations/        ← 0000_base.sql (users, sessions الموجودة) 0001_health_sync … 000N_records …
/public/            ← fonts/, icons, og-image, manifest
/tests/  e2e/
/docs/              ← AUDIT, PRODUCT_SPEC, ARCHITECTURE, DESIGN_SYSTEM, IMPLEMENTATION_PLAN, DATABASE_PLAN, SECURITY_REVIEW, TEST_REPORT, PROGRESS, FEATURES (registry)
README.md CHANGELOG.md .env.example
```
`wrangler.jsonc`: `assets.directory → ./dist`، `not_found_handling: single-page-application`، `run_worker_first: ["/api/*"]`، إضافة R2 binding، `compatibility_date` حديث، `_headers` (CSP, X-Frame-Options, Referrer-Policy).

## نموذج البيانات (D1)
- يبقى: `users`, `sessions` (+ `expires_at` مفحوص فعلاً)، `health_sync`, `sync_dedup` (+ user_id في المفتاح).
- **`records`** — سجل لكل عنصر: `id TEXT PK (uuid v7)`, `user_id FK`, `type` (task, project, goal, milestone, event, habit, habit_log, routine, note, note_link, journal, txn, wallet, budget, subscription, collection_item, course, lecture, exam, assignment, grade, study_session, flashcard, card_review, question, clinical_req, clinical_log, research, reference, workout, program, exercise_log, meal, food, water_log, sleep_log, measurement, health_record, reminder, reward, achievement…), `data JSON`, أعمدة مفهرسة: `parent_id`, `date`, `due_at`, `status`, `archived`, `private`, `created_at`, `updated_at`, `deleted_at` (soft delete/trash), `rev INTEGER` (عدّاد متزايد لكل مستخدم من جدول `user_rev`).
  - المبرر: سجل واحد لكل شيء = **مصدر حقيقة واحد** (الاختبار يظهر في Study + Calendar + Overview من نفس السجل)، مزامنة دلتا سهلة، والتحقق من الشكل عبر zod لكل type. الفهارس: `(user_id, rev)`, `(user_id, type, date)`, `(user_id, parent_id)`.
- **`xp_ledger`** append-only: `UNIQUE(user_id, event_key)`؛ event_key حتمي (`task:{id}:complete:{n}`) → لا تكرار عبر الأجهزة/الإعادات. إلغاء الإنجاز = قيد عكسي؛ إعادة الإنجاز لا تعطي أكثر من منحة صافية واحدة. الرصيد = SUM.
- **`mutations`** (idempotency): `UNIQUE(user_id, mutation_id)` لمنع تكرار الطلبات.
- **`friendships`**, **`friend_requests`** — بدل الحقول داخل الـ blob.
- **`files`** — metadata لـ R2 (owner, key, mime, size).
- **`legacy_snapshots`** — نسخة من `users.data` قبل الهجرة. **`users.data` لا يُمسح ولا يُعدّل.**

**الهجرة:** `shared/legacy/migrate.ts` يحوّل الـ blob القديم إلى records بـ IDs حتمية (مشتقة من legacy IDs) → التشغيل مرتين لا يكرر شيء. يُنفّذ في الـ Worker (`POST /api/v2/migrate`) عند أول دخول للنسخة الجديدة، داخل batch، مع معاينة وعدادات. الصور base64 تُرفع إلى R2. Rollback: `legacy/` + tag git + `users.data` سليم.

## API (Worker v2)
`/api/auth/*` (signup, login, google, logout, session, sessions list/revoke, change-password بكلمة حالية)، `/api/v2/sync/pull?since=rev`، `/api/v2/sync/push` (mutations batch، idempotent، ownership check على كل سجل)، `/api/v2/files` (upload موقّع إلى R2 + تحقق MIME/حجم)، `/api/v2/friends/*`، `/api/v2/export` (JSON/CSV/MD/ICS)، `/api/v2/import` (معاينة + تحقق + بدون overwrite)، `/api/v2/account/delete`، `/api/ai/*` (proxy داخل هذا الـ Worker بمصادقة + rate limit + موافقة صريحة لبيانات الصحة/المال/اليوميات)، `/api/exercises` (+ rate limit + validation). المسارات القديمة (`load/save/users/friend/*`) تبقى مؤقتاً للنسخة القديمة لكن مُصلحة أمنياً.

## الواجهة والتنقل
- 4 أقسام رئيسية فقط: **Life (افتراضي) / Study / Health / Settings** — sidebar على الديسكتوب، bottom nav + زر إضافة عائم على الجوال، الصفحات الفرعية قابلة للإخفاء من Settings › Modules (الإخفاء لا يحذف البيانات).
- Design tokens في `src/design/tokens.css`: ألوان Life OS (فاتح دافئ + داكن #101113…)، accent لكل قسم (Life #A69BCB، Study #799FCB، Health #83B89C، Reward #D5B178)، spacing 8pt، radius، elevation، motion (مع `prefers-reduced-motion`)، breakpoints. الخط: ثمانية (عربي)، Geist/Inter (إنجليزي). الثيمات الـ13 القديمة تتحول لـ token overrides اختيارية.
- Onboarding أول دخول: اختيار الوحدات + preset للوحة (Minimal/Student/Productivity/Health/Complete).

## المراحل (كل مرحلة = commit مستقل + تحقق + تحديث PROGRESS.md)
**0 — Checkpoint والتدقيق:** فرع `life-os` + tag `v4.6-pre-lifeos`؛ نقل الملفات القديمة إلى `legacy/`؛ كتابة `docs/AUDIT.md` (كل ميزة مصنفة Preserve/Improve/Refactor/Merge/Replace) + بقية الوثائق كهياكل.

**1 — الأساس:** Vite+React+TS+Tailwind، الـ shell والتنقل، design system + primitives، i18n/RTL، Dexie + sync engine، Worker بـ Hono + migrations (base + records + xp + mutations + friends + files)، إصلاحات الأمان كلها، auth (Google + إيميل) في التطبيق الجديد، Settings (Profile, General, Appearance, Modules, Data, Security/sessions)، الهجرة من الـ blob، PWA. → يجب أن يعمل تسجيل الدخول وتظهر بياناتك القديمة مهاجرة.

**2 — قلب Life:** Overview (bento بـ 5 طبقات، widgets قابلة للترتيب/الحجم/الإخفاء، Today/Week/Month، presets)، Quick Capture عالمي (FAB + `N`/Ctrl+K، parser عربي/إنجليزي "ذاكر باثولوجي بكرة 7 مساءً ساعة" مع معاينة وحفظ النص الأصلي)، Inbox، Tasks كاملة (subtasks، recurrence بـ rrule، views: list/kanban/calendar/timeline/Eisenhower، smart lists، bulk، undo)، Planner يومي (workload، تعارضات)، Calendar (يوم/أسبوع/شهر/agenda، time-blocking بالسحب، هجري، أوقات صلاة اختيارية، ICS)، Habits + Routines (أنواع yes/no/رقمي/وقت، أيام راحة، heatmap)، نقل العادات/المهام/التذكيرات/التقويم القديم.

**3 — المعرفة:** Notes/Second Brain (TipTap، مجلدات، tags، backlinks، graph حقيقي، history، trash، autosave آمن، تصدير MD، PARA اختياري)، Journal (مزاج/طاقة، قفل المعاينة، نقل الملاحظات اليومية القديمة)، Goals/Projects/Milestones (Vision→Area→Goal→Project→Milestone→Task، vision board)، Command palette + بحث شامل.

**4 — Study OS:** سنة→فصل→مقرر→فصل→محاضرة، Lectures بحالات، Exam center (يظهر تلقائياً في التقويم)، Assignments، Study planner (لا يكتب فوق جدول بدون تأكيد)، Focus sessions (Pomodoro، state محفوظ عبر refresh، حساب بالـ timestamps، منع تداخل)، Flashcards (FSRS، cloze، صور، استيراد/تصدير CSV/Anki-text)، Question bank + اختبارات موقوتة، GPA بمقياس مخصص + محاكاة، Dental clinical tracker (بدون بيانات مرضى — مراجع مجهولة)، Research (DOI/PMID بدون اختلاق)، Academic analytics.

**5 — Health OS:** نقل التمارين كاملة (برامج، جلسة حيّة **محفوظة عبر refresh**، rest timer، PRs، volume، خريطة العضلات + Explorer مع escape)، التغذية + AI vision (صور إلى R2)، Meal planner + grocery، الماء (إصلاح UTC)، النوم (يعبر منتصف الليل)، الوزن والقياسات + صور تقدم خاصة، Activity، Recovery، Medication + Health records خاصة. **بعد هذه المرحلة: تكافؤ كامل مع النسخة القديمة.**

**6 — التحفيز:** XP ledger + مستويات (منحنى حتمي موثق) + skill trees + achievements (نقل الـ trophies القديمة) + daily quests + reward shop + garden/constellation اختياري + Daily/Weekly/Monthly/Annual reviews. ضمانات: لا عقاب، vacation mode، إمكانية تعطيل كامل، منع farming.

**7 — المنظومة:** Finance (نقل المحافظ + إصلاح الرصيد + budgets + subscriptions + تقارير + SAR)، Collections (تسوق، قراءة، أفلام، سفر، هدايا…) بمكوّن واحد قابل لإعادة الاستخدام، Personal library، Friends (مُصلح)، Notification center (quiet hours، snooze، deep links)، Import/Export كامل، Templates.

**8 — متقدم:** AI assistant (plan my day/week، flashcards من ملاحظات، تقسيم مشاريع…) عبر `/api/ai` مع معاينة وتأكيد قبل أي تعديل وموافقة لكل نوع بيانات حساسة؛ Google Calendar sync (يحتاج OAuth credentials منك → Blocked حتى توفرها)، offline drafts + reconnection، push notifications (Web Push بمفاتيح VAPID).

**9 — الجاهزية:** أداء (Core Web Vitals، virtualization)، مراجعة أمنية بحسابين، accessibility (axe)، regression للـ 20 سيناريو في البرومت، الوثائق النهائية، تجهيز النشر.

## قواعد التنفيذ
- لا نشر على daqeeq.org، ولا `wrangler d1 … --remote`، ولا إنشاء R2/secrets على حسابك، ولا حذف فروع GitHub **بدون إذنك الصريح** — كل التطوير على `wrangler dev` + D1 محلي.
- المرحلة لا تُعلن "مكتملة" إلا بعد: `tsc` + lint + Vitest + build + تحقق فعلي في المتصفح (preview). حالات الـ feature registry: Verified / Implemented-not-verified / In progress / Blocked / Planned.
- أي شيء يحتاج شيء منك (مفاتيح، OAuth، نشر) يُسجَّل Blocked وأكمل الباقي.
- لا بيانات وهمية، لا أزرار بلا وظيفة، لا مؤشرات مخترعة — كل رقم في Overview له حساب موثق من سجلات حقيقية.

## إجراءات مطلوبة منك (خارج الكود)
1. **إلغاء مفتاح Anthropic المسرّب** من console.anthropic.com وإنشاء جديد (موجود في تاريخ فرع على GitHub). بعدها أقدر أحذف الفرع إذا وافقت.
2. لاحقاً عند النشر: إنشاء R2 bucket + `wrangler secret put ANTHROPIC_API_KEY` + تشغيل migrations على D1 البعيد (بإذنك).

## التحقق
- **Unit (Vitest):** recurrence، parser الإدخال السريع (عربي/إنجليزي)، XP ledger (مرة واحدة، idempotent، reversal)، FSRS، streaks مع أيام الراحة، النوم عبر منتصف الليل، GPA، رصيد المحافظ، الهجرة القديمة (fixture من بياناتك الحقيقية المحلية بدون رفعها) + تشغيلها مرتين بدون تكرار، timezone.
- **Worker:** اختبارات على `wrangler dev` + D1 محلي: auth، انتهاء الجلسات، rate limit، **حسابين: A لا يقرأ/يعدّل/يحذف سجلات B**، idempotency.
- **E2E (Playwright):** إنشاء مهمة → تظهر في Today/Calendar/Overview؛ إنجاز → XP مرة واحدة؛ اختبار → Study + Calendar؛ جلسة مذاكرة → analytics؛ عادة → consistency؛ صحة → widgets؛ autosave الملاحظات؛ حفظ تخصيص اللوحة؛ تعطيل وحدة بدون فقدان بيانات؛ RTL/LTR؛ جوال 375px.
- **بصري:** preview عبر `.claude/launch.json` (vite + wrangler dev) + screenshots فاتح/داكن/جوال لكل مرحلة.
- `docs/TEST_REPORT.md` يسجل فقط ما تم تشغيله فعلاً ونتيجته.
