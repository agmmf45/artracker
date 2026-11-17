/**
 * background-sync.js — Background Health Sync for دقيق
 *
 * Strategy per platform:
 *  iOS:     @capacitor/background-task  (30-sec expiring task on app background)
 *           + BackgroundRunner plugin   (true background execution via BGProcessingTask)
 *  Android: Health Connect background reads work from foreground; WorkManager
 *           is handled via the capacitor-health-connect plugin internally.
 *           We use @capacitor/background-task as the universal bridge.
 *
 * This file is loaded AFTER health-sync.js and health-settings.js.
 * Add to index.html: <script src="health-sync/background-sync.js"></script>
 *
 * Capacitor packages required:
 *   npm install @capacitor/background-task
 *   npm install @capacitor/background-runner   (iOS only, optional — deeper background)
 */
(function (window) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  //  CONSTANTS
  // ─────────────────────────────────────────────────────────
  var BG_TASK_ID           = 'com.daqeeq.app.healthsync';
  var BG_MIN_INTERVAL_MS   = 15 * 60 * 1000;   // minimum 15 min between bg syncs
  var BG_LAST_RUN_KEY      = 'daqeeq_bg_last_run';
  var BG_RUNNER_LABEL      = 'com.daqeeq.healthsync.runner';

  // ─────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────
  function _getPlugin(name) {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]
      ? window.Capacitor.Plugins[name]
      : null;
  }

  function _isCapacitor() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform &&
              window.Capacitor.isNativePlatform());
  }

  function _platform() {
    return _isCapacitor() ? window.Capacitor.getPlatform() : 'web';
  }

  function _lastRunAt() {
    try { return parseInt(localStorage.getItem(BG_LAST_RUN_KEY) || '0', 10); }
    catch (_) { return 0; }
  }

  function _markRan() {
    try { localStorage.setItem(BG_LAST_RUN_KEY, String(Date.now())); } catch (_) {}
  }

  function _shouldRun() {
    return Date.now() - _lastRunAt() >= BG_MIN_INTERVAL_MS;
  }

  // ─────────────────────────────────────────────────────────
  //  CORE BACKGROUND TASK RUNNER
  //  Called both from the foreground-→-background event and
  //  from the native BackgroundRunner (iOS BGProcessingTask).
  // ─────────────────────────────────────────────────────────
  async function _runBackgroundSync(taskFinishedFn) {
    taskFinishedFn = taskFinishedFn || function () {};

    if (!_shouldRun()) {
      taskFinishedFn({ success: true, skipped: 'too_soon' });
      return;
    }

    if (!window.HealthSync || !window.HealthSync.isAvailable()) {
      taskFinishedFn({ success: true, skipped: 'not_available' });
      return;
    }

    console.info('[BgSync] Starting background health sync');

    try {
      var result = await window.HealthSync.sync('background');
      _markRan();
      console.info('[BgSync] Done:', JSON.stringify(result));
      taskFinishedFn({ success: true });
    } catch (err) {
      console.error('[BgSync] Error:', err.message);
      taskFinishedFn({ success: false });
    }
  }

  // ─────────────────────────────────────────────────────────
  //  @capacitor/background-task  (foreground → background)
  //  iOS: ~30 seconds of CPU time after app backgrounds.
  //  Android: Deferred processing (best-effort).
  // ─────────────────────────────────────────────────────────
  function _registerBackgroundTask() {
    var BackgroundTask = _getPlugin('BackgroundTask');
    if (!BackgroundTask) return;

    // Called by the native side when the app moves to background
    BackgroundTask.beforeExit(async function () {
      var taskId = await BackgroundTask.beforeExit(async function () {});
      await _runBackgroundSync(function () {
        BackgroundTask.finish({ taskId: taskId });
      });
    });

    console.info('[BgSync] BackgroundTask registered');
  }

  // ─────────────────────────────────────────────────────────
  //  @capacitor/background-runner  (iOS — true background)
  //  Registers a BGProcessingTask that iOS can schedule while
  //  the app is fully in the background (e.g. charging at night).
  //
  //  Requires in capacitor.config.json:
  //    "BackgroundRunner": {
  //      "label": "com.daqeeq.healthsync.runner",
  //      "src":   "health-sync/runner.js",
  //      "event": "healthSync",
  //      "repeat": true,
  //      "interval": 30,               // minutes
  //      "autoStart": true
  //    }
  // ─────────────────────────────────────────────────────────
  function _registerBackgroundRunner() {
    var BackgroundRunner = _getPlugin('BackgroundRunner');
    if (!BackgroundRunner || _platform() !== 'ios') return;

    BackgroundRunner.requestPermissions().then(function (result) {
      if (result && result.notifications === 'granted') {
        console.info('[BgSync] BackgroundRunner permissions granted');
      }
    }).catch(function () {});

    // Dispatch event to the runner when foregrounding
    // (runner.js handles the actual sync logic via its own isolated context)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) return;   // app foregrounded — skip
      BackgroundRunner.dispatchEvent({
        label: BG_RUNNER_LABEL,
        event: 'healthSync',
        details: {
          userId:    window.currentUser ? window.currentUser.id : null,
          authToken: window.authToken   || null,
        },
      }).catch(function () {});
    });

    console.info('[BgSync] BackgroundRunner registered');
  }

  // ─────────────────────────────────────────────────────────
  //  ANDROID — app resume sync
  //  Health Connect doesn't support true background reads from
  //  WebView context. Best practice: sync on app resume.
  // ─────────────────────────────────────────────────────────
  function _registerAndroidResume() {
    if (_platform() !== 'android') return;

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;   // app backgrounded — skip
      // App came to foreground — run sync if enough time has passed
      setTimeout(function () {
        if (_shouldRun() && window.HealthSync && window.HealthSync.isAvailable()) {
          window.HealthSync.sync('app_resume').catch(function () {});
          _markRan();
        }
      }, 2000);   // 2s delay so UI settles first
    });

    console.info('[BgSync] Android resume sync registered');
  }

  // ─────────────────────────────────────────────────────────
  //  PERIODIC HEARTBEAT  (foreground, all platforms)
  //  Catches the case where the app stays open for a long time.
  //  The engine's own AUTO_SYNC_MS (30 min) handles this, but
  //  we register a Page Visibility-aware timer here so paused
  //  tabs don't run sync wastefully.
  // ─────────────────────────────────────────────────────────
  var _heartbeatTimer = null;

  function _startHeartbeat() {
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);

    _heartbeatTimer = setInterval(function () {
      if (document.hidden) return;   // skip when tab/app not visible
      if (!_shouldRun())   return;
      if (!window.HealthSync || !window.HealthSync.isAvailable()) return;
      window.HealthSync.sync('heartbeat').catch(function () {});
      _markRan();
    }, 5 * 60 * 1000);   // check every 5 min; actual sync gated by BG_MIN_INTERVAL_MS
  }

  // ─────────────────────────────────────────────────────────
  //  PUBLIC API  (window.HealthBgSync)
  // ─────────────────────────────────────────────────────────
  var HealthBgSync = {

    init: function () {
      if (!_isCapacitor()) {
        console.info('[BgSync] Web mode — background sync not registered');
        return;
      }

      _registerBackgroundTask();
      _registerBackgroundRunner();
      _registerAndroidResume();
      _startHeartbeat();

      console.info('[BgSync] Initialized. Platform:', _platform());
    },

    // Force-run a sync cycle from the native side (called by runner.js)
    runSync: _runBackgroundSync,

    // Status helpers
    lastRunAt:  function () { return new Date(_lastRunAt()); },
    shouldRun:  _shouldRun,
  };

  window.HealthBgSync = HealthBgSync;

  // Auto-init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { HealthBgSync.init(); });
  } else {
    HealthBgSync.init();
  }

})(window);
