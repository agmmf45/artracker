/**
 * health-sync.js — دقيق Health Sync Engine v1.0
 * Supports: Apple HealthKit (iOS) + Google Health Connect (Android)
 * Requires: Capacitor native shell (graceful no-op on web)
 *
 * Load order: must come AFTER index.html's main JS is fully parsed.
 * Add at bottom of <body>: <script src="health-sync/health-sync.js"></script>
 */
(function (window) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  //  CONSTANTS
  // ─────────────────────────────────────────────────────────
  var QUEUE_STORAGE_KEY  = 'daqeeq_sync_queue';
  var DEDUP_STORAGE_KEY  = 'daqeeq_sync_dedup';
  var PREFS_STORAGE_KEY  = 'daqeeq_health_prefs';
  var CURSOR_STORAGE_KEY = 'daqeeq_sync_cursor';
  var PULL_WINDOW_DAYS   = 30;   // how many days back on first pull
  var AUTO_SYNC_MS       = 30 * 60 * 1000;  // 30 minutes
  var DEDUP_MAX_ENTRIES  = 3000;
  var QUEUE_MAX_ENTRIES  = 100;

  var DATA_TYPE = {
    WORKOUT:    'workout',
    NUTRITION:  'nutrition',
    BODYWEIGHT: 'bodyweight',
    WATER:      'water',
  };

  // ─────────────────────────────────────────────────────────
  //  PLATFORM BRIDGE
  //  Wraps Capacitor plugin access — no import() needed.
  //  Capacitor injects plugins into window.Capacitor.Plugins
  //  when the WebView is hosted inside a native Capacitor app.
  // ─────────────────────────────────────────────────────────
  var PlatformBridge = (function () {

    function isCapacitor() {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                window.Capacitor.isNativePlatform());
    }

    function getPlatform() {
      if (!isCapacitor()) return 'web';
      return window.Capacitor.getPlatform(); // 'ios' | 'android'
    }

    function getPlugin(name) {
      if (!isCapacitor()) return null;
      return (window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
    }

    // iOS: @capacitor-community/health-kit  → plugin name "HealthKit"
    function healthKit() { return getPlugin('HealthKit'); }

    // Android: capacitor-health-connect → plugin name "HealthConnect"
    function healthConnect() { return getPlugin('HealthConnect'); }

    function getHealthPlugin() {
      var p = getPlatform();
      if (p === 'ios')     return healthKit();
      if (p === 'android') return healthConnect();
      return null;
    }

    return {
      isCapacitor: isCapacitor,
      getPlatform: getPlatform,
      isIOS:       function () { return getPlatform() === 'ios'; },
      isAndroid:   function () { return getPlatform() === 'android'; },
      isWeb:       function () { return getPlatform() === 'web'; },
      getHealthPlugin: getHealthPlugin,
      healthKit:   healthKit,
      healthConnect: healthConnect,
    };
  })();

  // ─────────────────────────────────────────────────────────
  //  SYNC QUEUE  (offline operation buffer)
  // ─────────────────────────────────────────────────────────
  var SyncQueue = (function () {
    var _q = [];

    function _persist() {
      try { localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(_q)); } catch (_) {}
    }

    function load() {
      try { _q = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]'); }
      catch (_) { _q = []; }
      // Guard against unbounded growth (edge: app crashed mid-sync)
      if (_q.length > QUEUE_MAX_ENTRIES) {
        _q = _q.slice(-QUEUE_MAX_ENTRIES);
        _persist();
      }
    }

    function push(type, action, data) {
      _q.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2),
                type: type, action: action, data: data,
                createdAt: new Date().toISOString(), retries: 0 });
      _persist();
    }

    function size()  { return _q.length; }
    function empty() { return _q.length === 0; }

    // Returns false if queue is now empty, throws on persistent failure
    async function flushOne(handler) {
      if (empty()) return false;
      var op = _q[0];
      try {
        await handler(op);
        _q.shift();
        _persist();
        return !empty();
      } catch (err) {
        op.retries = (op.retries || 0) + 1;
        if (op.retries >= 3) {
          // Give up on this item — don't block the queue forever
          _q.shift();
          _persist();
          console.warn('[HealthSync] Queue item abandoned after 3 retries:', op);
        } else {
          _persist();
        }
        throw err;
      }
    }

    async function flushAll(handler) {
      var flushed = 0;
      while (!empty()) {
        try {
          await flushOne(handler);
          flushed++;
        } catch (_) {
          break; // Network still down — stop trying
        }
      }
      return flushed;
    }

    return { load, push, size, empty, flushOne, flushAll };
  })();

  // ─────────────────────────────────────────────────────────
  //  DEDUP GUARD  (prevents writing the same record twice)
  // ─────────────────────────────────────────────────────────
  var DedupGuard = (function () {
    var _cache = {};      // hash → { source, synced_at }
    var _dirty = false;

    function load() {
      try {
        var raw = localStorage.getItem(DEDUP_STORAGE_KEY);
        _cache = raw ? JSON.parse(raw) : {};
      } catch (_) { _cache = {}; }
    }

    function _persist() {
      if (!_dirty) return;
      var keys = Object.keys(_cache);
      if (keys.length > DEDUP_MAX_ENTRIES) {
        // Evict oldest entries
        var sorted = keys.sort(function (a, b) {
          return (_cache[a].t || 0) - (_cache[b].t || 0);
        });
        sorted.slice(0, keys.length - DEDUP_MAX_ENTRIES).forEach(function (k) {
          delete _cache[k];
        });
      }
      try { localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(_cache)); } catch (_) {}
      _dirty = false;
    }

    // Build a stable fingerprint for a health record
    function buildHash(userId, dataType, sourceId, date, value) {
      // Simple but collision-resistant fingerprint without crypto
      var raw = [userId, dataType, sourceId || '', date || '', String(value || '')].join('|');
      var h = 0;
      for (var i = 0; i < raw.length; i++) {
        h = Math.imul(31, h) + raw.charCodeAt(i) | 0;
      }
      return (h >>> 0).toString(36) + '_' + raw.length.toString(36);
    }

    function isSeen(hash) { return !!_cache[hash]; }

    function markSeen(hash, source, dataType) {
      _cache[hash] = { source: source, t: Date.now(), type: dataType };
      _dirty = true;
      // Debounce persistence
      clearTimeout(DedupGuard._persistTimer);
      DedupGuard._persistTimer = setTimeout(_persist, 2000);
    }

    // Returns array of { hash, type, source } for server upload
    function exportBatch(limit) {
      return Object.entries(_cache).slice(0, limit || 200).map(function (e) {
        return { hash: e[0], type: e[1].type, source: e[1].source };
      });
    }

    return {
      load, buildHash, isSeen, markSeen, exportBatch,
      _persistTimer: null,
    };
  })();

  // ─────────────────────────────────────────────────────────
  //  CONFLICT RESOLVER
  // ─────────────────────────────────────────────────────────
  var ConflictResolver = (function () {

    function resolveWorkout(appRecord, healthRecord) {
      // sourceId match → definitive duplicate (record came from this platform originally)
      if (appRecord.sourceId && appRecord.sourceId === (
            healthRecord.uuid ||
            (healthRecord.metadata && healthRecord.metadata.id))) {
        return 'duplicate';
      }
      // Same date + similar duration (±5 min) → likely the same session.
      // We intentionally omit a name check: names differ across sources
      // (e.g. app "Push" vs HealthKit "Traditional Strength Training").
      if (appRecord.date === healthRecord.date &&
          Math.abs((appRecord.duration || 0) - (healthRecord.duration || 0)) <= 5) {
        return 'duplicate';
      }
      // Different records — keep both
      return 'keep_both';
    }

    function resolveBodyWeight(appEntry, healthEntry) {
      // Same date — keep whichever was recorded later
      if (appEntry.date === healthEntry.date) {
        var appTs   = new Date(appEntry.recordedAt || appEntry.date + 'T12:00:00').getTime();
        var healthTs = new Date(healthEntry.recordedAt || healthEntry.date + 'T08:00:00').getTime();
        return healthTs > appTs ? 'take_health' : 'keep_app';
      }
      return 'keep_both';
    }

    function resolveNutrition() {
      // Nutrition records from different sources represent different meals → always add
      return 'keep_both';
    }

    return { resolveWorkout, resolveBodyWeight, resolveNutrition };
  })();

  // ─────────────────────────────────────────────────────────
  //  HEALTH MAPPER  (bidirectional data translation)
  // ─────────────────────────────────────────────────────────
  var HealthMapper = (function () {

    // ── Exercise type lookup tables ───────────────────────
    var IOS_WORKOUT_TYPES = {
      'كارديو':   'HKWorkoutActivityTypeRunning',
      'جري':      'HKWorkoutActivityTypeRunning',
      'مشي':      'HKWorkoutActivityTypeWalking',
      'سباحة':    'HKWorkoutActivityTypeSwimming',
      'دراجة':    'HKWorkoutActivityTypeCycling',
      'يوغا':     'HKWorkoutActivityTypeYoga',
      'push':     'HKWorkoutActivityTypeTraditionalStrengthTraining',
      'pull':     'HKWorkoutActivityTypeTraditionalStrengthTraining',
      'legs':     'HKWorkoutActivityTypeTraditionalStrengthTraining',
      'قوة':      'HKWorkoutActivityTypeTraditionalStrengthTraining',
      'هايت':     'HKWorkoutActivityTypeHighIntensityIntervalTraining',
    };

    var IOS_TYPE_TO_NAME = {
      'HKWorkoutActivityTypeRunning':                       'كارديو',
      'HKWorkoutActivityTypeWalking':                       'مشي',
      'HKWorkoutActivityTypeSwimming':                      'سباحة',
      'HKWorkoutActivityTypeCycling':                       'دراجة',
      'HKWorkoutActivityTypeYoga':                          'يوغا',
      'HKWorkoutActivityTypeHighIntensityIntervalTraining': 'هايت',
      'HKWorkoutActivityTypeTraditionalStrengthTraining':   'قوة',
    };

    // Health Connect exercise type IDs (from Android SDK)
    var ANDROID_EXERCISE_TYPES = {
      'كارديو': 37, 'جري': 37,
      'مشي':    56,
      'سباحة':  46,
      'دراجة':   8,
      'يوغا':   61,
      'push':    1, 'pull': 1, 'legs': 1, 'قوة': 1,
      'هايت':   55,
    };

    var ANDROID_TYPE_TO_NAME = {
      37: 'كارديو', 56: 'مشي', 46: 'سباحة',
       8: 'دراجة',  61: 'يوغا',  1: 'قوة', 55: 'هايت',
    };

    function _iosWorkoutType(name) {
      var n = (name || '').toLowerCase();
      for (var key in IOS_WORKOUT_TYPES) {
        if (n.includes(key)) return IOS_WORKOUT_TYPES[key];
      }
      return 'HKWorkoutActivityTypeTraditionalStrengthTraining';
    }

    function _androidExerciseType(name) {
      var n = (name || '').toLowerCase();
      for (var key in ANDROID_EXERCISE_TYPES) {
        if (n.includes(key)) return ANDROID_EXERCISE_TYPES[key];
      }
      return 1; // strength training default
    }

    function _workoutStartISO(wo) {
      // Use actual startTime if available, else assume 08:00 on the workout date
      if (wo.startTime) return new Date(wo.startTime).toISOString();
      return (wo.date || _todayKey()) + 'T08:00:00.000Z';
    }

    function _todayKey() {
      return new Date().toISOString().split('T')[0];
    }

    // ── PUSH: App → HealthKit ─────────────────────────────
    function workoutToHealthKit(wo) {
      var startISO = _workoutStartISO(wo);
      var endISO   = new Date(new Date(startISO).getTime() + (wo.duration || 0) * 60000).toISOString();
      return {
        startDate:          startISO,
        endDate:            endISO,
        activityType:       _iosWorkoutType(wo.name),
        energyBurned:       wo.calories || 0,
        energyBurnedUnit:   'kilocalorie',
        distance:           wo.distance || 0,
        distanceUnit:       'meter',
      };
    }

    function weightToHealthKit(entry) {
      return {
        type:  'HKQuantityTypeIdentifierBodyMass',
        value: entry.w,
        unit:  'kilogram',
        date:  (entry.date || _todayKey()) + 'T08:00:00.000Z',
      };
    }

    function mealToHealthKitSamples(meal, date) {
      var ts = (date || _todayKey()) + 'T12:00:00.000Z';
      var samples = [];
      if (meal.cal > 0) samples.push({ type: 'HKQuantityTypeIdentifierDietaryEnergyConsumed', value: meal.cal, unit: 'kilocalorie', date: ts });
      if (meal.p   > 0) samples.push({ type: 'HKQuantityTypeIdentifierDietaryProtein',        value: meal.p,   unit: 'gram',        date: ts });
      if (meal.c   > 0) samples.push({ type: 'HKQuantityTypeIdentifierDietaryCarbohydrates',  value: meal.c,   unit: 'gram',        date: ts });
      if (meal.f   > 0) samples.push({ type: 'HKQuantityTypeIdentifierDietaryFatTotal',       value: meal.f,   unit: 'gram',        date: ts });
      return samples;
    }

    // ── PUSH: App → Health Connect ────────────────────────
    function workoutToHealthConnect(wo) {
      var startISO = _workoutStartISO(wo);
      var endISO   = new Date(new Date(startISO).getTime() + (wo.duration || 0) * 60000).toISOString();
      return {
        type:         'ExerciseSession',
        startTime:    startISO,
        endTime:      endISO,
        exerciseType: _androidExerciseType(wo.name),
        title:        wo.name || 'تمرين',
        notes:        wo.notes || '',
      };
    }

    function weightToHealthConnect(entry) {
      return {
        type:   'Weight',
        time:   (entry.date || _todayKey()) + 'T08:00:00.000Z',
        weight: { value: entry.w, unit: 'kilograms' },
      };
    }

    function mealToHealthConnect(meal, date) {
      var startISO = (date || _todayKey()) + 'T12:00:00.000Z';
      var endISO   = (date || _todayKey()) + 'T12:01:00.000Z';
      var record   = { type: 'Nutrition', startTime: startISO, endTime: endISO, name: meal.name || '' };
      if (meal.cal > 0) record.energy             = { value: meal.cal, unit: 'kilocalories' };
      if (meal.p   > 0) record.protein            = { value: meal.p,   unit: 'grams' };
      if (meal.c   > 0) record.totalCarbohydrate  = { value: meal.c,   unit: 'grams' };
      if (meal.f   > 0) record.totalFat           = { value: meal.f,   unit: 'grams' };
      return record;
    }

    // ── PULL: HealthKit → App ─────────────────────────────
    function healthKitWorkoutToApp(rec) {
      var start = new Date(rec.startDate);
      return {
        id:         'hk_' + (rec.uuid || Date.now()),
        name:       IOS_TYPE_TO_NAME[rec.activityType] || 'تمرين',
        date:       start.toISOString().split('T')[0],
        duration:   Math.max(1, Math.round((new Date(rec.endDate) - start) / 60000)),
        calories:   Math.round(rec.totalEnergyBurned || rec.energyBurned || 0),
        distance:   Math.round((rec.totalDistance || 0) * 10) / 10,
        exercises:  [],
        source:     'healthkit',
        sourceId:   rec.uuid || null,
        startTime:  rec.startDate,
      };
    }

    function healthKitWeightToApp(rec) {
      return {
        date:       new Date(rec.endDate || rec.date).toISOString().split('T')[0],
        w:          Math.round((rec.quantity || rec.value || 0) * 10) / 10,
        recordedAt: rec.endDate || rec.date,
        source:     'healthkit',
        sourceId:   rec.uuid || null,
      };
    }

    // ── PULL: Health Connect → App ────────────────────────
    function healthConnectWorkoutToApp(rec) {
      var start = new Date(rec.startTime);
      return {
        id:        'hc_' + ((rec.metadata && rec.metadata.id) || Date.now()),
        name:      ANDROID_TYPE_TO_NAME[rec.exerciseType] || rec.title || 'تمرين',
        date:      start.toISOString().split('T')[0],
        duration:  Math.max(1, Math.round((new Date(rec.endTime) - start) / 60000)),
        calories:  Math.round((rec.totalEnergyBurned && rec.totalEnergyBurned.inKilocalories) || 0),
        exercises: [],
        source:    'health_connect',
        sourceId:  (rec.metadata && rec.metadata.id) || null,
        startTime: rec.startTime,
      };
    }

    function healthConnectWeightToApp(rec) {
      return {
        date:       new Date(rec.time).toISOString().split('T')[0],
        w:          Math.round(((rec.weight && (rec.weight.inKilograms || rec.weight.value)) || 0) * 10) / 10,
        recordedAt: rec.time,
        source:     'health_connect',
        sourceId:   (rec.metadata && rec.metadata.id) || null,
      };
    }

    return {
      workoutToHealthKit, weightToHealthKit, mealToHealthKitSamples,
      workoutToHealthConnect, weightToHealthConnect, mealToHealthConnect,
      healthKitWorkoutToApp, healthKitWeightToApp,
      healthConnectWorkoutToApp, healthConnectWeightToApp,
    };
  })();

  // ─────────────────────────────────────────────────────────
  //  PERMISSION MANAGER
  // ─────────────────────────────────────────────────────────
  var PermissionManager = (function () {

    var IOS_READ_TYPES = [
      'HKWorkoutTypeIdentifier',
      'HKQuantityTypeIdentifierBodyMass',
      'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      'HKQuantityTypeIdentifierDietaryProtein',
      'HKQuantityTypeIdentifierDietaryCarbohydrates',
      'HKQuantityTypeIdentifierDietaryFatTotal',
      'HKQuantityTypeIdentifierDietaryWater',
      'HKQuantityTypeIdentifierStepCount',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKQuantityTypeIdentifierDistanceWalkingRunning',
    ];

    var IOS_WRITE_TYPES = [
      'HKWorkoutTypeIdentifier',
      'HKQuantityTypeIdentifierBodyMass',
      'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      'HKQuantityTypeIdentifierDietaryProtein',
      'HKQuantityTypeIdentifierDietaryCarbohydrates',
      'HKQuantityTypeIdentifierDietaryFatTotal',
      'HKQuantityTypeIdentifierDietaryWater',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
    ];

    var ANDROID_READ_PERMS = [
      'android.permission.health.READ_EXERCISE',
      'android.permission.health.READ_NUTRITION',
      'android.permission.health.READ_WEIGHT',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_HYDRATION',
    ];

    var ANDROID_WRITE_PERMS = [
      'android.permission.health.WRITE_EXERCISE',
      'android.permission.health.WRITE_NUTRITION',
      'android.permission.health.WRITE_WEIGHT',
      'android.permission.health.WRITE_ACTIVE_CALORIES_BURNED',
      'android.permission.health.WRITE_HYDRATION',
    ];

    async function request() {
      if (PlatformBridge.isWeb()) {
        return { granted: false, reason: 'web_not_supported' };
      }

      if (PlatformBridge.isIOS()) {
        var hk = PlatformBridge.healthKit();
        if (!hk) return { granted: false, reason: 'plugin_not_loaded' };
        try {
          var result = await hk.requestAuthorization({ read: IOS_READ_TYPES, write: IOS_WRITE_TYPES });
          return { granted: true, result: result };
        } catch (err) {
          return { granted: false, reason: err.message };
        }
      }

      if (PlatformBridge.isAndroid()) {
        var hc = PlatformBridge.healthConnect();
        if (!hc) return { granted: false, reason: 'plugin_not_loaded' };
        try {
          // Check Health Connect is installed on device
          var avail = await hc.checkAvailability();
          if (!avail || avail.availability !== 'Available') {
            return { granted: false, reason: 'health_connect_not_installed' };
          }
          var res = await hc.requestHealthPermissions({
            read:  ANDROID_READ_PERMS,
            write: ANDROID_WRITE_PERMS,
          });
          var anyGranted = res && res.grantedPermissions && res.grantedPermissions.length > 0;
          return { granted: anyGranted, result: res };
        } catch (err) {
          return { granted: false, reason: err.message };
        }
      }

      return { granted: false, reason: 'unknown_platform' };
    }

    async function isGranted() {
      if (!PlatformBridge.isCapacitor()) return false;
      try {
        if (PlatformBridge.isIOS()) {
          var hk = PlatformBridge.healthKit();
          if (!hk) return false;
          var r = await hk.checkAuthorizationStatus({
            sampleType: 'HKWorkoutTypeIdentifier'
          });
          return r && r.status === 'authorized';
        }
        if (PlatformBridge.isAndroid()) {
          var hc = PlatformBridge.healthConnect();
          if (!hc) return false;
          var avail = await hc.checkAvailability();
          return avail && avail.availability === 'Available';
        }
      } catch (_) { return false; }
      return false;
    }

    return { request, isGranted };
  })();

  // ─────────────────────────────────────────────────────────
  //  SYNC ENGINE  (main coordinator)
  // ─────────────────────────────────────────────────────────
  var SyncEngine = (function () {

    var _state = {
      running:      false,
      initialized:  false,
      platform:     'web',
      prefs:        {
        enabled:       false,
        autoSync:      true,
        syncWorkout:   true,
        syncNutrition: true,
        syncWeight:    true,
        syncWater:     true,
      },
      lastSyncAt:   null,
      lastError:    null,
      pendingHashes: [],  // collected during session for server upload
    };

    var _autoSyncTimer = null;

    // ── Init ─────────────────────────────────────────────
    function init() {
      SyncQueue.load();
      DedupGuard.load();
      _loadPrefs();

      _state.platform = PlatformBridge.getPlatform();
      _state.initialized = true;

      if (PlatformBridge.isCapacitor()) {
        _scheduleAutoSync();
        window.addEventListener('online', function () {
          SyncQueue.flushAll(_executeQueuedOp).catch(function () {});
        });
      }

      console.info('[HealthSync] Initialized. Platform:', _state.platform,
                   '| Enabled:', _state.prefs.enabled);
    }

    // ── Preferences ──────────────────────────────────────
    function _loadPrefs() {
      try {
        var stored = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || '{}');
        Object.assign(_state.prefs, stored);
      } catch (_) {}
    }

    function savePrefs(patch) {
      Object.assign(_state.prefs, patch);
      try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(_state.prefs)); } catch (_) {}
      if (patch.autoSync === true) _scheduleAutoSync();
      if (patch.autoSync === false && _autoSyncTimer) {
        clearInterval(_autoSyncTimer);
        _autoSyncTimer = null;
      }
    }

    function getPrefs() { return Object.assign({}, _state.prefs); }

    // ── Sync cursor (incremental pull) ────────────────────
    function _getCursor() {
      try { return localStorage.getItem(CURSOR_STORAGE_KEY); } catch (_) { return null; }
    }

    function _saveCursor(isoTs) {
      try { localStorage.setItem(CURSOR_STORAGE_KEY, isoTs); } catch (_) {}
    }

    function _windowStart() {
      var cursor = _getCursor();
      if (cursor) return cursor;
      // First sync — pull PULL_WINDOW_DAYS back
      return new Date(Date.now() - PULL_WINDOW_DAYS * 86400000).toISOString();
    }

    // ── Auto sync ─────────────────────────────────────────
    function _scheduleAutoSync() {
      if (_autoSyncTimer) clearInterval(_autoSyncTimer);
      if (!_state.prefs.autoSync || !_state.prefs.enabled) return;
      _autoSyncTimer = setInterval(function () {
        syncAll('auto').catch(function () {});
      }, AUTO_SYNC_MS);
    }

    // ── Push: App → Health Platform ───────────────────────
    async function _pushWorkouts(workouts) {
      if (!_state.prefs.syncWorkout || !workouts || !workouts.length) return { pushed: 0, skipped: 0, errors: 0 };
      var plugin  = PlatformBridge.getHealthPlugin();
      var plat    = _state.platform;
      var results = { pushed: 0, skipped: 0, errors: 0 };

      for (var i = 0; i < workouts.length; i++) {
        var wo = workouts[i];
        if (!wo.date || !wo.duration) { results.skipped++; continue; }
        // Skip records that came FROM health (avoid echo)
        if (wo.source === 'healthkit' || wo.source === 'health_connect') { results.skipped++; continue; }

        var hash = DedupGuard.buildHash('push', DATA_TYPE.WORKOUT, wo.id, wo.date, wo.duration);
        if (DedupGuard.isSeen(hash)) { results.skipped++; continue; }

        try {
          if (plat === 'ios') {
            await plugin.saveWorkout(HealthMapper.workoutToHealthKit(wo));
          } else {
            await plugin.insertRecords({ records: [HealthMapper.workoutToHealthConnect(wo)] });
          }
          DedupGuard.markSeen(hash, plat, DATA_TYPE.WORKOUT);
          _state.pendingHashes.push({ hash: hash, type: DATA_TYPE.WORKOUT, source: plat });
          results.pushed++;
        } catch (err) {
          results.errors++;
          SyncQueue.push(DATA_TYPE.WORKOUT, 'push', wo);
          console.warn('[HealthSync] pushWorkout error:', err.message);
        }
      }
      return results;
    }

    async function _pushBodyWeight(entries) {
      if (!_state.prefs.syncWeight || !entries || !entries.length) return { pushed: 0, skipped: 0, errors: 0 };
      var plugin  = PlatformBridge.getHealthPlugin();
      var plat    = _state.platform;
      var results = { pushed: 0, skipped: 0, errors: 0 };

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.date || !entry.w) { results.skipped++; continue; }
        if (entry.source === 'healthkit' || entry.source === 'health_connect') { results.skipped++; continue; }

        var hash = DedupGuard.buildHash('push', DATA_TYPE.BODYWEIGHT, null, entry.date, entry.w);
        if (DedupGuard.isSeen(hash)) { results.skipped++; continue; }

        try {
          if (plat === 'ios') {
            await plugin.saveQuantitySample(HealthMapper.weightToHealthKit(entry));
          } else {
            await plugin.insertRecords({ records: [HealthMapper.weightToHealthConnect(entry)] });
          }
          DedupGuard.markSeen(hash, plat, DATA_TYPE.BODYWEIGHT);
          _state.pendingHashes.push({ hash: hash, type: DATA_TYPE.BODYWEIGHT, source: plat });
          results.pushed++;
        } catch (err) {
          results.errors++;
          SyncQueue.push(DATA_TYPE.BODYWEIGHT, 'push', entry);
          console.warn('[HealthSync] pushWeight error:', err.message);
        }
      }
      return results;
    }

    async function _pushNutrition(nutritionLog) {
      if (!_state.prefs.syncNutrition || !nutritionLog) return { pushed: 0, skipped: 0, errors: 0 };
      var plugin  = PlatformBridge.getHealthPlugin();
      var plat    = _state.platform;
      var results = { pushed: 0, skipped: 0, errors: 0 };

      var dates = Object.keys(nutritionLog);
      for (var di = 0; di < dates.length; di++) {
        var date  = dates[di];
        var meals = nutritionLog[date] || [];
        for (var mi = 0; mi < meals.length; mi++) {
          var meal = meals[mi];
          if (!meal.cal) { results.skipped++; continue; }
          if (meal.source === 'healthkit' || meal.source === 'health_connect') { results.skipped++; continue; }

          var hash = DedupGuard.buildHash('push', DATA_TYPE.NUTRITION, meal.id, date, meal.cal);
          if (DedupGuard.isSeen(hash)) { results.skipped++; continue; }

          try {
            if (plat === 'ios') {
              var samples = HealthMapper.mealToHealthKitSamples(meal, date);
              for (var si = 0; si < samples.length; si++) {
                await plugin.saveQuantitySample(samples[si]);
              }
            } else {
              await plugin.insertRecords({ records: [HealthMapper.mealToHealthConnect(meal, date)] });
            }
            DedupGuard.markSeen(hash, plat, DATA_TYPE.NUTRITION);
            _state.pendingHashes.push({ hash: hash, type: DATA_TYPE.NUTRITION, source: plat });
            results.pushed++;
          } catch (err) {
            results.errors++;
            SyncQueue.push(DATA_TYPE.NUTRITION, 'push', { meal: meal, date: date });
            console.warn('[HealthSync] pushNutrition error:', err.message);
          }
        }
      }
      return results;
    }

    // ── Pull: Health Platform → App ───────────────────────
    async function _pullWorkouts(since, until) {
      var plugin  = PlatformBridge.getHealthPlugin();
      var plat    = _state.platform;
      var records = [];

      try {
        if (plat === 'ios') {
          var r = await plugin.queryWorkouts({ startDate: since, endDate: until, limit: 100, ascending: false });
          records = r && r.workouts ? r.workouts : [];
        } else {
          var r2 = await plugin.readRecords({
            type: 'ExerciseSession',
            timeRangeFilter: { type: 'between', startTime: since, endTime: until }
          });
          records = r2 && r2.records ? r2.records : [];
        }
      } catch (err) {
        console.warn('[HealthSync] pullWorkouts error:', err.message);
      }

      var added = 0;
      var fd    = window.getFitData ? window.getFitData() : { workouts: [], bodyweight: [], programs: [], prs: {} };

      records.forEach(function (rec) {
        var wo    = plat === 'ios'
          ? HealthMapper.healthKitWorkoutToApp(rec)
          : HealthMapper.healthConnectWorkoutToApp(rec);
        var hash  = DedupGuard.buildHash('pull', DATA_TYPE.WORKOUT, wo.sourceId, wo.date, wo.duration);
        if (DedupGuard.isSeen(hash)) return;

        var existing = (fd.workouts || []).find(function (w) {
          return ConflictResolver.resolveWorkout(w, wo) === 'duplicate';
        });
        if (existing) { DedupGuard.markSeen(hash, 'pull', DATA_TYPE.WORKOUT); return; }

        fd.workouts = fd.workouts || [];
        fd.workouts.push(wo);
        DedupGuard.markSeen(hash, 'pull', DATA_TYPE.WORKOUT);
        _state.pendingHashes.push({ hash: hash, type: DATA_TYPE.WORKOUT, source: plat });
        added++;
      });

      return added;
    }

    async function _pullBodyWeight(since, until) {
      var plugin  = PlatformBridge.getHealthPlugin();
      var plat    = _state.platform;
      var records = [];

      try {
        if (plat === 'ios') {
          var r = await plugin.querySampleType({
            sampleType: 'HKQuantityTypeIdentifierBodyMass',
            startDate: since, endDate: until, limit: 60, ascending: false
          });
          records = r && r.samples ? r.samples : [];
        } else {
          var r2 = await plugin.readRecords({
            type: 'Weight',
            timeRangeFilter: { type: 'between', startTime: since, endTime: until }
          });
          records = r2 && r2.records ? r2.records : [];
        }
      } catch (err) {
        console.warn('[HealthSync] pullWeight error:', err.message);
      }

      var added = 0;
      var fd    = window.getFitData ? window.getFitData() : { workouts: [], bodyweight: [], programs: [], prs: {} };

      records.forEach(function (rec) {
        var entry = plat === 'ios'
          ? HealthMapper.healthKitWeightToApp(rec)
          : HealthMapper.healthConnectWeightToApp(rec);
        if (!entry.w || entry.w < 20 || entry.w > 500) return;

        var hash = DedupGuard.buildHash('pull', DATA_TYPE.BODYWEIGHT, entry.sourceId, entry.date, entry.w);
        if (DedupGuard.isSeen(hash)) return;

        var existing = (fd.bodyweight || []).find(function (e) { return e.date === entry.date; });
        if (existing) {
          if (ConflictResolver.resolveBodyWeight(existing, entry) === 'take_health') {
            existing.w = entry.w;
            existing.recordedAt = entry.recordedAt;
          }
          DedupGuard.markSeen(hash, 'pull', DATA_TYPE.BODYWEIGHT);
          return;
        }

        fd.bodyweight = fd.bodyweight || [];
        fd.bodyweight.push(entry);
        DedupGuard.markSeen(hash, 'pull', DATA_TYPE.BODYWEIGHT);
        _state.pendingHashes.push({ hash: hash, type: DATA_TYPE.BODYWEIGHT, source: plat });
        added++;
      });

      return added;
    }

    // ── Push: Water intake → Health Platform ─────────────
    // waterLog = myData.nutrition.water  e.g. { '2025-06-01': 1750 }
    async function _pushWater(waterLog) {
      if (!_state.prefs.syncWater || !waterLog) return { pushed: 0 };
      var plugin = PlatformBridge.getHealthPlugin();
      var plat   = _state.platform;
      var pushed = 0;

      var dates = Object.keys(waterLog);
      for (var di = 0; di < dates.length; di++) {
        var date    = dates[di];
        var waterMl = waterLog[date] || 0;
        if (waterMl <= 0) continue;

        var hash = DedupGuard.buildHash('push', DATA_TYPE.WATER, null, date, waterMl);
        if (DedupGuard.isSeen(hash)) continue;

        try {
          var ts = date + 'T12:00:00.000Z';
          if (plat === 'ios') {
            await plugin.saveQuantitySample({
              type:  'HKQuantityTypeIdentifierDietaryWater',
              value: waterMl / 1000,
              unit:  'liter',
              date:  ts,
            });
          } else {
            await plugin.insertRecords({ records: [{
              type:      'Hydration',
              startTime: ts,
              endTime:   new Date(new Date(ts).getTime() + 60000).toISOString(),
              volume:    { value: waterMl, unit: 'milliliters' },
            }] });
          }
          DedupGuard.markSeen(hash, plat, DATA_TYPE.WATER);
          _state.pendingHashes.push({ hash: hash, type: DATA_TYPE.WATER, source: plat });
          pushed++;
        } catch (err) {
          console.warn('[HealthSync] pushWater error:', err.message);
          SyncQueue.push(DATA_TYPE.WATER, 'push', { date: date, waterMl: waterMl });
        }
      }
      return { pushed };
    }

    // ── Queue handler ─────────────────────────────────────
    async function _executeQueuedOp(op) {
      if (op.type === DATA_TYPE.WORKOUT)    return _pushWorkouts([op.data]);
      if (op.type === DATA_TYPE.BODYWEIGHT) return _pushBodyWeight([op.data]);
      if (op.type === DATA_TYPE.WATER) {
        var wLog = {};
        wLog[op.data.date] = op.data.waterMl;
        return _pushWater(wLog);
      }
      if (op.type === DATA_TYPE.NUTRITION)  {
        var log = {};
        log[op.data.date] = [op.data.meal];
        return _pushNutrition(log);
      }
    }

    // ── Log sync event to server ──────────────────────────
    async function _logToServer(trigger, pushed, pulled, pullCursor, error) {
      if (typeof window.api !== 'function' || !window.currentUser) return;
      var platform = PlatformBridge.isIOS() ? 'healthkit' : 'health_connect';
      var hashes   = _state.pendingHashes.splice(0, 200);
      try {
        await window.api('health/sync-log', {
          platform:     platform,
          trigger:      trigger,
          pushed:       pushed,
          pulled:       pulled,
          pull_cursor:  pullCursor,
          status:       error ? 'error' : 'idle',
          error:        error || null,
          synced_at:    new Date().toISOString(),
          dedup_hashes: hashes,
        });
      } catch (_) {
        // Put hashes back if log failed
        _state.pendingHashes = hashes.concat(_state.pendingHashes);
      }
    }

    // ── Full sync orchestration ───────────────────────────
    async function syncAll(trigger) {
      trigger = trigger || 'manual';

      if (!_state.prefs.enabled)       return { skipped: 'disabled' };
      if (_state.running)              return { skipped: 'already_running' };
      if (!PlatformBridge.isCapacitor()) return { skipped: 'web_mode' };
      if (typeof window.getFitData !== 'function') return { skipped: 'no_data' };

      _state.running = true;
      HealthSyncUI.setSyncStatus('syncing');

      var totalPushed = 0, totalPulled = 0, errorMsg = null;
      var since = _windowStart();
      var until = new Date().toISOString();

      try {
        // ── 1. Flush offline queue first ─────────────────
        await SyncQueue.flushAll(_executeQueuedOp).catch(function () {});

        // ── 2. Push app data → health platform ───────────
        var fd    = window.getFitData();
        var nutri = window.getNutri ? window.getNutri() : {};

        var woRes  = await _pushWorkouts(fd.workouts    || []);
        var bwRes  = await _pushBodyWeight(fd.bodyweight || []);
        var nuRes  = await _pushNutrition(nutri.log     || {});
        var waRes  = await _pushWater(nutri.water       || {});
        totalPushed = woRes.pushed + bwRes.pushed + nuRes.pushed + waRes.pushed;

        // ── 3. Pull health platform → app ────────────────
        var woAdded = await _pullWorkouts(since, until);
        var bwAdded = await _pullBodyWeight(since, until);
        totalPulled = woAdded + bwAdded;

        // ── 4. Persist merged data ────────────────────────
        if (totalPulled > 0) {
          if (typeof window.saveMyData === 'function') {
            await window.saveMyData();
          }
          // Refresh UI
          try { window.renderFitDashboard && window.renderFitDashboard(); } catch (_) {}
          try { window.renderNutrition    && window.renderNutrition();    } catch (_) {}
        }

        _saveCursor(until);

      } catch (err) {
        errorMsg = err.message;
        console.error('[HealthSync] syncAll error:', err);
      }

      _state.running    = false;
      _state.lastSyncAt = new Date().toISOString();
      _state.lastError  = errorMsg;

      await _logToServer(trigger, totalPushed, totalPulled, until, errorMsg);

      if (errorMsg) {
        HealthSyncUI.setSyncStatus('error', { message: errorMsg });
      } else {
        HealthSyncUI.setSyncStatus('success', { pushed: totalPushed, pulled: totalPulled });
      }

      return { pushed: totalPushed, pulled: totalPulled, error: errorMsg };
    }

    // ── Consume BackgroundRunner payload (iOS) ────────────
    // runner.js stores a payload in CapacitorKV while in the background.
    // We read it on foreground and merge it into myData without a full sync.
    async function consumeRunnerPayload() {
      var KV = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorKV;
      if (!KV) return 0;
      try {
        var stored = await KV.get({ key: 'daqeeq_bg_payload' });
        if (!stored || !stored.value) return 0;
        var payload = JSON.parse(stored.value);
        await KV.remove({ key: 'daqeeq_bg_payload' });

        if (typeof window.getFitData !== 'function') return 0;
        var added = 0;
        var fd = window.getFitData();

        // Merge workouts
        (payload.workouts || []).forEach(function (rec) {
          var wo = HealthMapper.healthKitWorkoutToApp(rec);
          var hash = DedupGuard.buildHash('runner', DATA_TYPE.WORKOUT, wo.sourceId, wo.date, wo.duration);
          if (DedupGuard.isSeen(hash)) return;
          var dup = (fd.workouts || []).some(function (w) {
            return ConflictResolver.resolveWorkout(w, wo) === 'duplicate';
          });
          if (!dup) {
            fd.workouts = fd.workouts || [];
            fd.workouts.push(wo);
            DedupGuard.markSeen(hash, 'runner', DATA_TYPE.WORKOUT);
            added++;
          }
        });

        // Merge weights
        (payload.weights || []).forEach(function (rec) {
          var entry = HealthMapper.healthKitWeightToApp(rec);
          if (!entry.w || entry.w < 20 || entry.w > 500) return;
          var hash = DedupGuard.buildHash('runner', DATA_TYPE.BODYWEIGHT, entry.sourceId, entry.date, entry.w);
          if (DedupGuard.isSeen(hash)) return;
          var exists = (fd.bodyweight || []).some(function (e) { return e.date === entry.date; });
          if (!exists) {
            fd.bodyweight = fd.bodyweight || [];
            fd.bodyweight.push(entry);
            DedupGuard.markSeen(hash, 'runner', DATA_TYPE.BODYWEIGHT);
            added++;
          }
        });

        if (added > 0 && typeof window.saveMyData === 'function') {
          await window.saveMyData();
          try { window.renderFitDashboard && window.renderFitDashboard(); } catch (_) {}
        }
        console.info('[HealthSync] Runner payload merged:', added, 'records');
        return added;
      } catch (err) {
        console.warn('[HealthSync] consumeRunnerPayload error:', err.message);
        return 0;
      }
    }

    // ── Called once after login / app start ───────────────
    async function onAppStart() {
      if (!_state.prefs.enabled) return;
      if (!PlatformBridge.isCapacitor()) return;

      var granted = await PermissionManager.isGranted();
      if (!granted) return;

      // 1. Instantly consume any payload the background runner collected
      consumeRunnerPayload().catch(function () {});

      // 2. Full sync after a short delay (UI renders first)
      setTimeout(function () {
        syncAll('startup').catch(function () {});
      }, 3000);
    }

    return {
      consumeRunnerPayload,
      init,
      syncAll,
      onAppStart,
      savePrefs,
      getPrefs,
      getState: function () { return Object.assign({}, _state); },
      isAvailable: function () { return PlatformBridge.isCapacitor() && _state.prefs.enabled; },
    };
  })();

  // ─────────────────────────────────────────────────────────
  //  UI HELPERS  (sync status indicator)
  // ─────────────────────────────────────────────────────────
  var HealthSyncUI = (function () {
    var _toastTimer = null;

    function setSyncStatus(status, data) {
      data = data || {};
      var dot = document.getElementById('health-sync-dot');
      if (!dot) return;

      var icons   = { syncing: '🔄', success: '✅', error: '❌', idle: '💚' };
      var colors  = { syncing: '#3B82F6', success: '#16A34A', error: '#DC2626', idle: '#16A34A' };
      var title   = {
        syncing: 'جاري المزامنة...',
        success: 'آخر مزامنة: الآن' + (data.pulled ? ' (+' + data.pulled + ')' : ''),
        error:   'خطأ في المزامنة: ' + (data.message || ''),
        idle:    'Apple Health / Google Health متصل',
      };

      dot.textContent  = icons[status] || '💚';
      dot.style.color  = colors[status] || '#16A34A';
      dot.title        = title[status] || '';
      dot.style.display = 'inline';

      // Auto-hide non-critical states after 4s
      clearTimeout(_toastTimer);
      if (status === 'success' || status === 'syncing') {
        _toastTimer = setTimeout(function () {
          if (dot) {
            dot.textContent = '💚';
            dot.style.color = '#16A34A';
            dot.title = 'Apple Health / Google Health متصل';
          }
        }, 4000);
      }
    }

    function setStatusText(elId, text) {
      var el = document.getElementById(elId);
      if (el) el.textContent = text;
    }

    return { setSyncStatus, setStatusText };
  })();

  // ─────────────────────────────────────────────────────────
  //  HOOKS into existing app functions
  // ─────────────────────────────────────────────────────────
  function _hookSaveMyData() {
    var _orig = window.saveMyData;
    if (typeof _orig !== 'function') return;

    window.saveMyData = async function () {
      var result = await _orig.apply(this, arguments);
      // Async push — doesn't block the save response
      if (SyncEngine.isAvailable()) {
        setTimeout(function () {
          SyncEngine.syncAll('on_save').catch(function () {});
        }, 1500);
      }
      return result;
    };
  }

  function _hookStartApp() {
    var _orig = window.startApp;
    if (typeof _orig !== 'function') return;

    window.startApp = async function (user) {
      var result = await _orig.apply(this, arguments);
      SyncEngine.onAppStart().catch(function () {});
      return result;
    };
  }

  // ─────────────────────────────────────────────────────────
  //  PUBLIC API  (window.HealthSync)
  // ─────────────────────────────────────────────────────────
  var HealthSync = {
    // Core
    init:          function () { SyncEngine.init(); _hookSaveMyData(); _hookStartApp(); },
    sync:          function (trigger) { return SyncEngine.syncAll(trigger || 'manual'); },
    connect:       async function () {
      var result = await PermissionManager.request();
      if (result.granted) {
        SyncEngine.savePrefs({ enabled: true });
        HealthSyncUI.setSyncStatus('idle');
        var r = await SyncEngine.syncAll('first_connect');
        if (window.showToast) {
          window.showToast(r.error
            ? '❌ فشل الاتصال: ' + r.error
            : '✅ تم الربط: ' + (r.pulled || 0) + ' سجل مزامن');
        }
        return result;
      }
      if (result.reason === 'health_connect_not_installed' && window.showToast) {
        window.showToast('⚠️ يرجى تثبيت Google Health Connect من المتصفح');
      } else if (result.reason === 'web_not_supported' && window.showToast) {
        window.showToast('ℹ️ المزامنة تتطلب تطبيق دقيق على الجهاز');
      }
      return result;
    },
    disconnect:    function () {
      SyncEngine.savePrefs({ enabled: false });
      HealthSyncUI.setSyncStatus('idle');
      var dot = document.getElementById('health-sync-dot');
      if (dot) dot.style.display = 'none';
    },
    savePrefs:     function (p) { return SyncEngine.savePrefs(p); },
    getPrefs:      function ()  { return SyncEngine.getPrefs(); },
    getState:      function ()  { return SyncEngine.getState(); },
    isAvailable:   function ()  { return SyncEngine.isAvailable(); },
    isCapacitor:   function ()  { return PlatformBridge.isCapacitor(); },
    isIOS:         function ()  { return PlatformBridge.isIOS(); },
    isAndroid:     function ()  { return PlatformBridge.isAndroid(); },
    UI:            HealthSyncUI,

    // Exposed for testing
    _mapper:       HealthMapper,
    _resolver:     ConflictResolver,
    _dedup:        DedupGuard,
    _queue:        SyncQueue,
  };

  window.HealthSync = HealthSync;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { HealthSync.init(); });
  } else {
    HealthSync.init();
  }

})(window);
