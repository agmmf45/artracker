# دقيق — وثيقة الفكرة الكاملة

> ارجع لهذا الملف في أي وقت تحتاج تتذكر ما بُني وأين أنت.

---

## الفكرة

**دقيق** تطبيق ويب عربي (PWA) شامل لتتبع الحياة اليومية — عادات، مصاريف، تمارين، سعرات، وماء — في مكان واحد، بواجهة gamified وخط ثمانية.

الهدف: بديل عربي لتطبيقات مثل MyFitnessPal + Habitica + YNAB في تطبيق واحد بسيط يعمل من المتصفح مباشرة.

---

## الميزات الموجودة الآن

### ✅ العادات اليومية
- تتبع يومي مع streaks
- إضافة عادات مخصصة بالاسم والأيقونة
- مهام فرعية لكل عادة
- نظام إنجازات (trophies)
- مساعد ذكاء اصطناعي يقترح عادات

### ✅ قائمة المهام (To-Do)
- أولويات: عالية / عادية / منخفضة
- فئات: شغل، دراسة، تسوق، صحة، شخصي
- تاريخ استحقاق
- فلترة حسب الحالة

### ✅ المصاريف والميزانية
- محافظ متعددة
- فئات المصاريف
- تتبع الإيداع والسحب والادخار
- مساعد AI يحلل رسائل البنك
- تقرير PDF

### ✅ التمارين (Fitness)
- تسجيل جلسات تمرين مع وقت حقيقي
- قوالب: Push / Pull / Legs / كارديو
- برامج مخصصة متعددة الأيام
- تتبع الوزن الكلي (Volume)
- خريطة العضلات
- سجل الرقم القياسي (PRs)
- تتبع الوزن الجسمي

### ✅ السعرات والتغذية
- هدف سعرات يومي
- وجبات: فطور، غداء، عشاء، وجبة خفيفة
- تتبع الماكرو (بروتين، كارب، دهون)
- **🔬 محلل الرؤية الغذائية بالذكاء الاصطناعي** (تحليل صورة/وصف الوجبة):
  - تعرّف على كل عنصر (رئيسي/جانبي/صلصة/مشروب/إضافة) + نوع المطبخ ونوع الوجبة
  - تقدير الوزن بالجرام بثلاث قيم: الأقل/الأرجح/الأعلى
  - استنتاج طريقة الطهي (مشوي/مقلي/مخبوز/مسلوق/نيء/قلي هوائي)
  - قيم غذائية كاملة لكل صنف: سعرات + بروتين/كارب/دهون/ألياف/سكر/صوديوم
  - درجة ثقة لكل صنف وللوجبة كاملة (مع تنبيه عند انخفاضها)
  - نسبة مساهمة كل صنف من إجمالي سعرات الوجبة
  - حفظ صورة الوجبة (نسخة مصغّرة مشتركة) + كل التفاصيل ضمن السجل
  - **صفحة تفاصيل الوجبة**: تفتح بالنقر على أي صنف محلَّل بالذكاء الاصطناعي — تعرض الصورة، الثقة، الوزن، التصنيف، طريقة الطهي، كل القيم الغذائية، وزر "عدّل الكمية" (يعيد حساب كل القيم تناسبياً) وزر حذف
- **متتبع الماء** (أزرار سريعة + هدف + سجل 7 أيام)

### ✅ الملف الشخصي والأصدقاء
- صورة وأيقونة وألوان مخصصة
- كود صديق للتواصل
- طلبات الصداقة
- مقارنة العادات مع الأصدقاء
- نوت يومية

### ✅ مزايا أخرى
- تقويم هجري وميلادي مع أحداث وتذكيرات
- ثيمات متعددة (داكن، وردي، بحري، بنفسجي، أخضر)
- PWA قابل للتثبيت على الجوال
- يعمل أوف لاين (بيانات محلية)

---

## البنية التقنية

### الواجهة
```
index.html          ← التطبيق كاملاً (7000+ سطر، vanilla JS)
water-tracker.js    ← متتبع الماء (مستقل)
```

**مهم جداً:**
- `myData` مُعلَّن بـ `let` — لا يظهر على `window`
- للوصول للبيانات من ملفات خارجية: استخدم `window.getNutri()`, `window.getFitData()`, `window.saveMyData()`
- **لا تستخدم `window.myData`** — لن يعمل

### الباك اند
```
worker.js           ← Cloudflare Worker (API)
wrangler.jsonc      ← إعداد Cloudflare
```

**Endpoints:**
- `POST /api/signup` — تسجيل مستخدم جديد
- `POST /api/login` — تسجيل الدخول
- `POST /api/session` — التحقق من الجلسة
- `POST /api/load` — تحميل بيانات المستخدم
- `POST /api/save` — حفظ بيانات المستخدم
- `POST /api/users` — كل المستخدمين (للأصدقاء)
- `POST /api/health/sync-log` — تسجيل حدث مزامنة صحية
- `POST /api/health/status` — حالة المزامنة
- `POST /api/health/check-dedup` — التحقق من التكرار

### قاعدة البيانات (Cloudflare D1)
```sql
users (id, email, password_hash, name, data, updated_at)
sessions (token, user_id, created_at, expires_at)
health_sync (id, user_id, platform, last_sync_at, ...)   ← جديد
sync_dedup (record_hash, user_id, data_type, source, ...) ← جديد
```

كل بيانات المستخدم تُخزَّن كـ JSON blob في حقل `data` في جدول `users`.

### CACHE_KEY
```js
const CACHE_KEY = 'artrk_data_v1';
// localStorage: artrk_data_v1_{userId}
```

---

## بنية البيانات (myData)

```js
myData = {
  // هوية المستخدم
  display_name, avatar_emoji, avatar_color, avatar_photo,
  friend_code, friends[], sent_requests[], incoming_requests[],
  theme,

  // العادات
  habits_list: [{ id, name, icon, subtasks[] }],
  done: { 'YYYY-MM-DD': { habitId: true } },

  // المهام
  todos: [{ id, text, priority, cat, done, due }],

  // المصاريف
  expenses: [],
  budget: 0,
  wallets: [],
  transactions: [],

  // التمارين
  fitness: {
    workouts: [{
      id, name, date, duration, startTime,
      calories, distance, exercises: [],
      source?,      // 'healthkit' | 'health_connect' | undefined
      sourceId?,
    }],
    bodyweight: [{ date, w, source?, sourceId? }],
    programs: [],
    prs: {}
  },

  // التغذية
  nutrition: {
    goal: 2000,           // هدف السعرات
    log: {                // وجبات بالتاريخ — الحقول الأساسية: id, type, name, cal, p, c, f
      'YYYY-MM-DD': [{
        id, type, name, cal, p, c, f,
        // ── حقول إضافية عند الإضافة عبر "محلل الرؤية الغذائية" (source === 'ai_vision') ──
        source,          // 'ai_vision'
        analysisId,      // يربط الصنف بصورة الوجبة المشتركة في nutrition.mealPhotos (أو null)
        mealName,        // اسم الوجبة العام كما حدده التحليل
        cuisine,         // نوع المطبخ أو null
        category,        // 'main' | 'side' | 'sauce' | 'drink' | 'extra'
        cookingMethod,   // طريقة الطهي أو null
        confidence,      // 0-100 — درجة ثقة هذا الصنف
        weightG,         // {low, likely, high} بالجرام
        fiber, sugar, sodium,  // جرام/جرام/ملغم
        analyzedAt       // timestamp تحليل/إضافة الوجبة
      }]
    },
    // صور الوجبات المحلَّلة بالذكاء الاصطناعي — صورة واحدة لكل تحليل (نسخة مصغّرة base64)
    // مرتبطة بعدّة أصناف عبر analysisId لتقليل حجم البيانات المُزامنة عبر D1.
    // تُحذف تلقائياً عند حذف آخر صنف يشير إليها (انظر nutriDeleteMeal).
    mealPhotos: {
      'analysisId': 'data:image/jpeg;base64,...'
    },
    water: {              // إجمالي الماء بالتاريخ (ml)
      'YYYY-MM-DD': totalMl
    },
    waterLog: {           // سجل كل إدخال ماء
      'YYYY-MM-DD': [{ time, ml }]
    },
    waterGoal: 2000,      // هدف الماء اليومي (ml)
  },

  // ملاحظات
  daily_notes: {},
  cal_reminders: {},
  _trophies: {},
}
```

---

## ملفات الصحة (مستقبلية — تحتاج Capacitor)

```
health-sync/
  health-sync.js        ← محرك المزامنة مع Apple Health / Google Health
  health-settings.js    ← واجهة الإعدادات في صفحة الملف الشخصي
  background-sync.js    ← مزامنة خلفية
  runner.js             ← iOS BackgroundRunner
  health-sync.test.js   ← 79 اختبار
  water-tracker.test.js ← 50 اختبار
  test.html             ← مشغّل الاختبارات (129/129 ✅)

setup/
  ios/                  ← Info.plist, entitlements, PrivacyInfo.xcprivacy
  android/              ← AndroidManifest, PrivacyPolicyActivity, strings

capacitor.config.json   ← إعداد Capacitor
package.json            ← npm dependencies
```

### ما يُزامن مع المنصة الصحية
| البيانات | iOS (HealthKit) | Android (Health Connect) |
|----------|----------------|--------------------------|
| التمارين | ✅ Push + Pull | ✅ Push + Pull |
| الوزن | ✅ Push + Pull | ✅ Push + Pull |
| السعرات | ✅ Push | ✅ Push |
| الماء | ✅ Push | ✅ Push |

### ما لا يُزامن (قرار تصميمي)
- الخطوات → حسّاسة (تحتاج wearable)
- النبضات → حسّاسة (تحتاج wearable)

---

## النشر

```bash
# نشر Worker + Assets
npx wrangler deploy

# تشغيل Migration على D1 (مرة واحدة)
npx wrangler d1 execute artracker-db --remote --file=db/migrations/001_health_sync.sql

# تشغيل محلي
py -m http.server 4321
```

---

## خارطة الطريق

### المرحلة الحالية — الويب ✅
الموقع يعمل كاملاً بدون أي تثبيت.

### المرحلة القادمة — Capacitor (عند الحاجة)
لتفعيل مزامنة Apple Health / Google Health Connect:

```bash
npm install
npx cap add ios && npx cap add android
npx cap sync
bash setup/ios/apply-ios-config.sh   # ثم افتح Xcode وفعّل HealthKit
bash setup/android/apply-android-config.sh
```

ثم:
- **iOS:** Xcode → Signing & Capabilities → HealthKit → Build
- **Android:** Android Studio → Build → Run

### ميزات مقترحة للمستقبل
- [ ] نظام نقاط وتحديات بين الأصدقاء
- [ ] تقارير أسبوعية / شهرية بالرسوم البيانية
- [ ] تذكيرات push notifications
- [ ] استيراد بيانات من MyFitnessPal
- [ ] وضع التقشف (حساب الميزانية اليومية)
- [ ] متتبع النوم (يدوي)
- [ ] ربط Garmin / Google Fit عبر OAuth

---

## معلومات تقنية مهمة للمطور

### 1. إضافة ميزة جديدة في الواجهة
لا تعدّل `index.html` مباشرة — صعب. بدلاً من ذلك:
- أنشئ ملف `.js` مستقل
- احقن الـ HTML عبر JavaScript بعد `DOMContentLoaded`
- استخدم hook على الدوال الموجودة مثل `renderNutrition`

مثال نجح: `water-tracker.js` — لا يعدّل index.html ولا سطراً واحداً.

### 2. الوصول للبيانات من ملف خارجي
```js
// ✅ صح
var nutri = window.getNutri();     // myData.nutrition
var fit   = window.getFitData();   // myData.fitness
window.saveMyData();               // حفظ كل شيء

// ❌ غلط — let لا تظهر على window
var x = window.myData;
```

### 3. إضافة API endpoint
في `worker.js` — أضف `if (path === 'my-endpoint') { ... }` قبل:
```js
return json({ error: 'not found: ' + path }, 404);
```

### 4. تشغيل الاختبارات
```
http://localhost:4321/health-sync/test.html
```
129 اختبار: 79 health-sync + 50 water-tracker

---

*آخر تحديث: يونيو 2026*
