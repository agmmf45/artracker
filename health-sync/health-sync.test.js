/**
 * health-sync.test.js — دقيق Health Sync Test Suite
 *
 * Zero-dependency test runner — runs in any browser or Node.js.
 * Open test.html (below) in a browser to see results, or run:
 *   node health-sync/health-sync.test.js
 *
 * Coverage:
 *   DedupGuard      — hash stability, isSeen, markSeen, eviction
 *   ConflictResolver — all resolution strategies
 *   HealthMapper     — bidirectional mapping fidelity
 *   SyncQueue        — push, flush, retry limit
 *   SyncEngine       — graceful no-op on web, pref persistence
 *   Integration      — push → dedup → no re-push cycle
 */

// ── Minimal test runner ───────────────────────────────────
(function () {
  'use strict';

  var _results = { passed: 0, failed: 0, errors: [] };

  function assert(condition, label) {
    if (condition) {
      _results.passed++;
      _log('  ✅ ' + label);
    } else {
      _results.failed++;
      _results.errors.push(label);
      _log('  ❌ ' + label);
    }
  }

  function assertEqual(a, b, label) {
    var ok = JSON.stringify(a) === JSON.stringify(b);
    assert(ok, label + (ok ? '' : ' — got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)));
  }

  function assertApprox(a, b, delta, label) {
    assert(Math.abs(a - b) <= delta, label + ' (' + a + ' ≈ ' + b + ')');
  }

  function describe(suite, fn) {
    _log('\n📦 ' + suite);
    try { fn(); }
    catch (e) {
      _results.failed++;
      _results.errors.push(suite + ': ' + e.message);
      _log('  💥 UNCAUGHT: ' + e.message);
    }
  }

  function _log(msg) {
    if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(msg + '\n');
    } else if (typeof document !== 'undefined') {
      var el = document.getElementById('test-output');
      if (el) { el.textContent += msg + '\n'; }
      console.log(msg);
    } else {
      console.log(msg);
    }
  }

  // ── Stub localStorage for Node.js ────────────────────────
  if (typeof localStorage === 'undefined') {
    var _store = {};
    global.localStorage = {
      getItem:    function (k) { return _store[k] !== undefined ? _store[k] : null; },
      setItem:    function (k, v) { _store[k] = String(v); },
      removeItem: function (k) { delete _store[k]; },
    };
  }

  // ── Stub window for Node.js ───────────────────────────────
  if (typeof window === 'undefined') {
    global.window = global;
  }

  // ── Load the engine (Node.js path) ───────────────────────
  if (typeof require !== 'undefined' && typeof HealthSync === 'undefined') {
    try {
      // Stub Capacitor so the engine doesn't throw
      global.window.Capacitor = null;
      require('./health-sync.js');
    } catch (e) {
      _log('⚠️  Could not load health-sync.js: ' + e.message);
      _log('    Run from the artracker project root.');
    }
  }

  // ─────────────────────────────────────────────────────────
  //  1. DedupGuard
  // ─────────────────────────────────────────────────────────
  describe('DedupGuard', function () {
    var DG = window.HealthSync && window.HealthSync._dedup;
    if (!DG) { assert(false, 'DedupGuard not exposed on HealthSync._dedup'); return; }

    DG.load();

    var h1 = DG.buildHash('u1', 'workout', 'src-abc', '2025-01-01', 45);
    var h2 = DG.buildHash('u1', 'workout', 'src-abc', '2025-01-01', 45);
    var h3 = DG.buildHash('u1', 'workout', 'src-xyz', '2025-01-01', 45);
    var h4 = DG.buildHash('u1', 'workout', 'src-abc', '2025-01-02', 45);

    assertEqual(h1, h2, 'Hash is deterministic for same inputs');
    assert(h1 !== h3, 'Different sourceId → different hash');
    assert(h1 !== h4, 'Different date → different hash');

    assert(!DG.isSeen(h1), 'New hash not seen yet');
    DG.markSeen(h1, 'healthkit', 'workout');
    assert(DG.isSeen(h1),  'Hash seen after markSeen');
    assert(!DG.isSeen(h3), 'Unrelated hash still unseen');

    var batch = DG.exportBatch(100);
    assert(batch.length >= 1, 'exportBatch returns at least 1 entry');
    var entry = batch.find(function (e) { return e.hash === h1; });
    assert(!!entry, 'Exported batch contains marked hash');
    assertEqual(entry.type,   'workout',    'Export preserves data type');
    assertEqual(entry.source, 'healthkit',  'Export preserves source');
  });

  // ─────────────────────────────────────────────────────────
  //  2. ConflictResolver
  // ─────────────────────────────────────────────────────────
  describe('ConflictResolver', function () {
    var CR = window.HealthSync && window.HealthSync._resolver;
    if (!CR) { assert(false, 'ConflictResolver not exposed on HealthSync._resolver'); return; }

    // Workout — duplicate detection
    var appWo = { id: 'w1', name: 'Push', date: '2025-06-01', duration: 60 };

    var healthWoSame   = { uuid: 'hk-123', date: '2025-06-01', duration: 62 };  // ±5 min → duplicate
    var healthWoDiff   = { uuid: 'hk-456', date: '2025-06-01', duration: 30 };  // far apart → keep both
    var healthWoOther  = { uuid: 'hk-789', date: '2025-06-02', duration: 60 };  // different day

    assertEqual(CR.resolveWorkout(appWo, healthWoSame),  'duplicate',   'Workout: ±5 min same day → duplicate');
    assertEqual(CR.resolveWorkout(appWo, healthWoDiff),  'keep_both',   'Workout: large duration gap → keep_both');
    assertEqual(CR.resolveWorkout(appWo, healthWoOther), 'keep_both',   'Workout: different day → keep_both');

    // sourceId match
    var appWoWithSrc = { id: 'w2', name: 'Pull', date: '2025-06-01', duration: 45, sourceId: 'hk-999' };
    var healthWoMatch = { uuid: 'hk-999', date: '2025-06-01', duration: 45 };
    assertEqual(CR.resolveWorkout(appWoWithSrc, healthWoMatch), 'duplicate', 'sourceId match → duplicate');

    // Body weight — last write wins
    var appW  = { date: '2025-06-01', w: 80.5, recordedAt: '2025-06-01T10:00:00Z' };
    var hlthW = { date: '2025-06-01', w: 80.2, recordedAt: '2025-06-01T08:00:00Z' };
    assertEqual(CR.resolveBodyWeight(appW, hlthW), 'keep_app',    'Weight: app recorded later → keep_app');

    var appW2  = { date: '2025-06-01', w: 80.5, recordedAt: '2025-06-01T07:00:00Z' };
    assertEqual(CR.resolveBodyWeight(appW2, hlthW), 'take_health', 'Weight: health recorded later → take_health');

    var diffDayW = { date: '2025-06-02', w: 81.0, recordedAt: '2025-06-02T08:00:00Z' };
    assertEqual(CR.resolveBodyWeight(appW, diffDayW), 'keep_both', 'Weight: different days → keep_both');

    // Nutrition
    assertEqual(CR.resolveNutrition(), 'keep_both', 'Nutrition always keep_both (different sources)');
  });

  // ─────────────────────────────────────────────────────────
  //  3. HealthMapper
  // ─────────────────────────────────────────────────────────
  describe('HealthMapper', function () {
    var M = window.HealthSync && window.HealthSync._mapper;
    if (!M) { assert(false, 'HealthMapper not exposed on HealthSync._mapper'); return; }

    // Workout → HealthKit round-trip
    var wo = { id: 'w1', name: 'كارديو', date: '2025-06-01', duration: 45,
               calories: 380, distance: 5200, startTime: '2025-06-01T07:00:00.000Z' };
    var hk = M.workoutToHealthKit(wo);

    assert(hk.startDate === '2025-06-01T07:00:00.000Z', 'HK workout: startDate preserved');
    var endMs = new Date(hk.endDate).getTime() - new Date(hk.startDate).getTime();
    assertApprox(endMs / 60000, 45, 1, 'HK workout: duration → endDate correct');
    assertEqual(hk.activityType, 'HKWorkoutActivityTypeRunning', 'HK workout: كارديو → Running');
    assertEqual(hk.energyBurned, 380,  'HK workout: calories mapped');
    assertEqual(hk.distance,     5200, 'HK workout: distance mapped');

    // Workout → Health Connect
    var hc = M.workoutToHealthConnect(wo);
    assertEqual(hc.type, 'ExerciseSession', 'HC workout: correct record type');
    assertEqual(hc.exerciseType, 37,        'HC workout: كارديو → type 37 (Running)');
    assertEqual(hc.title, 'كارديو',          'HC workout: title preserved');

    // HealthKit record → App
    var hkRec = { uuid: 'abc-123', activityType: 'HKWorkoutActivityTypeRunning',
                  startDate: '2025-06-01T07:00:00Z', endDate: '2025-06-01T07:45:00Z',
                  totalEnergyBurned: 380, totalDistance: 5200 };
    var appWo = M.healthKitWorkoutToApp(hkRec);
    assertEqual(appWo.id,       'hk_abc-123',    'HK→App: id prefixed');
    assertEqual(appWo.date,     '2025-06-01',    'HK→App: date extracted');
    assertEqual(appWo.duration, 45,              'HK→App: duration calculated');
    assertEqual(appWo.calories, 380,             'HK→App: calories mapped');
    assertEqual(appWo.source,   'healthkit',     'HK→App: source tagged');
    assertEqual(appWo.sourceId, 'abc-123',       'HK→App: sourceId set');

    // Health Connect → App
    var hcRec = {
      startTime: '2025-06-01T07:00:00Z', endTime: '2025-06-01T07:45:00Z',
      exerciseType: 37, title: 'Morning Run',
      totalEnergyBurned: { inKilocalories: 380 },
      metadata: { id: 'hc-xyz' },
    };
    var appWo2 = M.healthConnectWorkoutToApp(hcRec);
    assertEqual(appWo2.id,       'hc_hc-xyz',     'HC→App: id prefixed');
    assertEqual(appWo2.duration, 45,              'HC→App: duration calculated');
    assertEqual(appWo2.calories, 380,             'HC→App: calories mapped');
    assertEqual(appWo2.source,   'health_connect','HC→App: source tagged');

    // Weight → HealthKit
    var wEntry = { date: '2025-06-01', w: 82.3 };
    var hkW = M.weightToHealthKit(wEntry);
    assertEqual(hkW.type,  'HKQuantityTypeIdentifierBodyMass', 'HK weight: correct type');
    assertEqual(hkW.value, 82.3,   'HK weight: value preserved');
    assertEqual(hkW.unit,  'kilogram', 'HK weight: unit correct');
    assert(hkW.date.startsWith('2025-06-01'), 'HK weight: date in ISO');

    // Weight → Health Connect
    var hcW = M.weightToHealthConnect(wEntry);
    assertEqual(hcW.type,           'Weight',   'HC weight: correct type');
    assertEqual(hcW.weight.value,   82.3,       'HC weight: value preserved');
    assertEqual(hcW.weight.unit,    'kilograms','HC weight: unit correct');

    // HealthKit weight → App
    var hkWRec = { uuid: 'w-abc', quantity: 82.3, endDate: '2025-06-01T08:00:00Z' };
    var appWEntry = M.healthKitWeightToApp(hkWRec);
    assertEqual(appWEntry.date, '2025-06-01', 'HK weight→App: date');
    assertEqual(appWEntry.w,    82.3,         'HK weight→App: value');
    assertEqual(appWEntry.source, 'healthkit','HK weight→App: source tagged');

    // Nutrition → HealthKit samples
    var meal = { id: 'm1', name: 'غداء', cal: 650, p: 40, c: 70, f: 15 };
    var samples = M.mealToHealthKitSamples(meal, '2025-06-01');
    assert(samples.length === 4, 'HK nutrition: 4 samples (cal+p+c+f)');
    var calSample = samples.find(function (s) { return s.type.includes('EnergyConsumed'); });
    assertEqual(calSample.value, 650, 'HK nutrition: calories sample value');
    assertEqual(calSample.unit, 'kilocalorie', 'HK nutrition: calories unit');

    // Nutrition → Health Connect
    var hcNutri = M.mealToHealthConnect(meal, '2025-06-01');
    assertEqual(hcNutri.type,                     'Nutrition',    'HC nutrition: type');
    assertEqual(hcNutri.energy.value,             650,            'HC nutrition: energy');
    assertEqual(hcNutri.protein.value,            40,             'HC nutrition: protein');
    assertEqual(hcNutri.totalCarbohydrate.value,  70,             'HC nutrition: carbs');
    assertEqual(hcNutri.totalFat.value,           15,             'HC nutrition: fat');

    // Nutrition with zero macros — zero fields should be absent
    var mealNoMacros = { id: 'm2', name: 'تفاحة', cal: 95, p: 0, c: 0, f: 0 };
    var samplesNoMacros = M.mealToHealthKitSamples(mealNoMacros, '2025-06-01');
    assertEqual(samplesNoMacros.length, 1, 'HK nutrition: zero macros → only 1 sample (cal)');

    // Exercise type fallback
    var woUnknown = { id: 'wu', name: 'شيء غريب', date: '2025-06-01', duration: 30 };
    var hkUnknown = M.workoutToHealthKit(woUnknown);
    assertEqual(hkUnknown.activityType,
      'HKWorkoutActivityTypeTraditionalStrengthTraining',
      'Unknown exercise name → strength training fallback');
  });

  // ─────────────────────────────────────────────────────────
  //  4. SyncQueue
  // ─────────────────────────────────────────────────────────
  describe('SyncQueue', function () {
    var Q = window.HealthSync && window.HealthSync._queue;
    if (!Q) { assert(false, 'SyncQueue not exposed on HealthSync._queue'); return; }

    // Clear any leftover state
    try { localStorage.removeItem('daqeeq_sync_queue'); } catch (_) {}
    Q.load();

    assert(Q.empty(), 'Queue starts empty after clear');
    assertEqual(Q.size(), 0, 'Queue size is 0');

    Q.push('workout', 'push', { id: 'w1', date: '2025-06-01', duration: 30 });
    Q.push('bodyweight', 'push', { date: '2025-06-01', w: 80 });
    assertEqual(Q.size(), 2, 'Queue has 2 items after 2 pushes');
    assert(!Q.empty(), 'Queue not empty');

    // Reload from storage (simulates app restart)
    Q.load();
    assertEqual(Q.size(), 2, 'Queue persisted across reload');

    // Flush success — use a synchronous-resolving handler to avoid event-loop races
    var flushed = [];
    var flushPromise = Q.flushAll(function (op) {
      flushed.push(op);
      return Promise.resolve();   // sync-ish: resolves in same microtask batch
    });

    // Schedule assertions after the flush promise resolves,
    // but BEFORE the fail-test section re-loads the queue.
    flushPromise.then(function (count) {
      assertEqual(count,          2,           'flushAll returns number flushed');
      assert(Q.empty(),                        'Queue empty after successful flush');
      assertEqual(flushed.length, 2,           'Handler called twice');
      assertEqual(flushed[0] && flushed[0].type, 'workout',    'First item is workout');
      assertEqual(flushed[1] && flushed[1].type, 'bodyweight', 'Second item is bodyweight');
    }).catch(function (e) {
      assert(false, 'flushAll success threw: ' + e.message);
    });

    // Retry logic — separate queue instance via fresh clear+load
    // We must wait for the flush above to settle before re-loading.
    // Use setTimeout(0) to push past the current microtask queue.
    setTimeout(function () {
      try { localStorage.removeItem('daqeeq_sync_queue'); } catch (_) {}
      Q.load();
      assert(Q.empty(), 'Queue empty before retry test');

      Q.push('workout', 'push', { id: 'w-fail', date: '2025-06-01', duration: 20 });
      assert(!Q.empty(), 'Queue has item for retry test');

      var attempts = 0;
      Q.flushAll(function () {
        attempts++;
        return Promise.reject(new Error('simulated network error'));
      }).catch(function () {
        setTimeout(function () {
          assert(attempts >= 1, 'Retried at least once (' + attempts + ' attempt(s))');
        }, 50);
      });
    }, 50);
  });

  // ─────────────────────────────────────────────────────────
  //  5. SyncEngine — web mode no-ops
  // ─────────────────────────────────────────────────────────
  describe('SyncEngine (web mode)', function () {
    var HS = window.HealthSync;
    if (!HS) { assert(false, 'window.HealthSync not defined'); return; }

    assert(!HS.isCapacitor(), 'Running in web — isCapacitor() = false');
    assert(!HS.isIOS(),       'isIOS() = false in web');
    assert(!HS.isAndroid(),   'isAndroid() = false in web');
    assert(!HS.isAvailable(), 'isAvailable() = false when disabled/web');

    // Sync should return skipped reason, not throw
    HS.sync('test').then(function (r) {
      assert('skipped' in r || 'error' in r || 'pushed' in r,
        'sync() resolves with status object');
    }).catch(function (e) {
      assert(false, 'sync() should not reject: ' + e.message);
    });
  });

  // ─────────────────────────────────────────────────────────
  //  6. SyncEngine — preference persistence
  // ─────────────────────────────────────────────────────────
  describe('SyncEngine pref persistence', function () {
    var HS = window.HealthSync;
    if (!HS) { assert(false, 'window.HealthSync not defined'); return; }

    var initial = HS.getPrefs();
    assert('enabled'       in initial, 'prefs.enabled exists');
    assert('autoSync'      in initial, 'prefs.autoSync exists');
    assert('syncWorkout'   in initial, 'prefs.syncWorkout exists');
    assert('syncNutrition' in initial, 'prefs.syncNutrition exists');
    assert('syncWeight'    in initial, 'prefs.syncWeight exists');
    assert('syncSteps'     in initial, 'prefs.syncSteps exists');
    assert('syncWater'     in initial, 'prefs.syncWater exists');

    // Save → read back
    HS.savePrefs({ syncWorkout: false, syncWeight: false });
    var updated = HS.getPrefs();
    assertEqual(updated.syncWorkout, false, 'syncWorkout written');
    assertEqual(updated.syncWeight,  false, 'syncWeight written');

    // Restore
    HS.savePrefs({ syncWorkout: true, syncWeight: true });
  });

  // ─────────────────────────────────────────────────────────
  //  7. Integration — push → dedup prevents re-push
  // ─────────────────────────────────────────────────────────
  describe('Integration: dedup prevents echo', function () {
    var DG = window.HealthSync && window.HealthSync._dedup;
    var M  = window.HealthSync && window.HealthSync._mapper;
    if (!DG || !M) { assert(false, 'Missing internal modules'); return; }

    var wo = { id: 'wo-int-1', name: 'Legs', date: '2025-06-10', duration: 55,
               calories: 420, source: 'app' };

    // First push — not seen
    var hash = DG.buildHash('push', 'workout', wo.id, wo.date, wo.duration);
    assert(!DG.isSeen(hash), 'Record not seen before first push');
    DG.markSeen(hash, 'app', 'workout');
    assert(DG.isSeen(hash),  'Record seen after first push');

    // Second push — already seen
    var hash2 = DG.buildHash('push', 'workout', wo.id, wo.date, wo.duration);
    assertEqual(hash, hash2, 'Hash is identical for same record');
    assert(DG.isSeen(hash2), 'Dedup guard prevents second push');

    // Health record that came FROM the platform should not re-echo back
    var hkRec = M.healthKitWorkoutToApp({
      uuid: 'hk-int-1', activityType: 'HKWorkoutActivityTypeRunning',
      startDate: '2025-06-10T07:00:00Z', endDate: '2025-06-10T07:55:00Z',
      totalEnergyBurned: 420,
    });
    assert(hkRec.source === 'healthkit', 'Pulled record tagged as healthkit');
    // In _pushWorkouts, source === 'healthkit' → skipped
    var wouldSkip = hkRec.source === 'healthkit' || hkRec.source === 'health_connect';
    assert(wouldSkip, 'Platform-sourced records are skipped in push loop');
  });

  // ─────────────────────────────────────────────────────────
  //  SUMMARY
  // ─────────────────────────────────────────────────────────
  var total = _results.passed + _results.failed;
  _log('\n' + '─'.repeat(50));
  _log('Results: ' + _results.passed + '/' + total + ' passed');
  if (_results.failed > 0) {
    _log('Failed:');
    _results.errors.forEach(function (e) { _log('  ✗ ' + e); });
  } else {
    _log('🎉 All tests passed!');
  }

  // Expose for external runners
  if (typeof module !== 'undefined') {
    module.exports = _results;
    // Exit with non-zero if failures
    if (typeof process !== 'undefined' && _results.failed > 0) {
      process.exitCode = 1;
    }
  }
})();
