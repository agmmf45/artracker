/**
 * water-tracker.test.js — Water Tracker Test Suite
 *
 * Self-contained — writes directly to #test-output and appends
 * its own Results line, independent of health-sync.test.js counters.
 *
 * Depends on water-tracker.js being loaded first (window.WaterTracker).
 */
(function () {
  'use strict';

  var _r = { passed: 0, failed: 0, errors: [] };

  function _out(msg) {
    var el = document.getElementById('test-output');
    if (el) { el.textContent += msg + '\n'; }
  }

  function wtAssert(cond, label) {
    if (cond) { _r.passed++;  _out('  ✅ ' + label); }
    else       { _r.failed++; _r.errors.push(label); _out('  ❌ ' + label); }
  }

  function wtEqual(a, b, label) {
    var ok = JSON.stringify(a) === JSON.stringify(b);
    wtAssert(ok, label + (ok ? '' : ' — got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)));
  }

  function suite(name, fn) {
    _out('\n📦 WaterTracker: ' + name);
    try { fn(); }
    catch (e) { _r.failed++; _r.errors.push(name + ': ' + e.message); _out('  💥 ' + e.message); }
  }

  // ── Helpers ─────────────────────────────────────────────
  function freshMyData() {
    window.myData = {
      nutrition: { goal: 2000, log: {}, water: {}, waterLog: {}, waterGoal: 2000 },
      fitness: {}
    };
    // Suppress saveMyData during tests
    window.saveMyData = function () { return Promise.resolve(); };
  }

  function todayKey() {
    return new Date().toISOString().split('T')[0];
  }

  // ── Helpers ─────────────────────────────────────────────
  function freshMyData() {
    window.myData = {
      nutrition: { goal: 2000, log: {}, water: {}, waterLog: {}, waterGoal: 2000 },
      fitness: {}
    };
    window.saveMyData = function () { return Promise.resolve(); };
  }

  function todayKey() { return new Date().toISOString().split('T')[0]; }

  // ── Tests ────────────────────────────────────────────────
  suite('data model init', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found on window'); return; }

    freshMyData();
    var n = WT._getData();
    wtAssert(!!n,                        '_getData returns nutrition object');
    wtAssert(typeof n.water    === 'object', '_getData creates water map');
    wtAssert(typeof n.waterLog === 'object', '_getData creates waterLog map');

    window.myData = {};
    var n2 = WT._getData();
    wtAssert(!!n2,                   '_getData creates nutrition if missing');
    wtEqual(n2.water,    {},         'water starts empty');
    wtEqual(n2.waterLog, {},         'waterLog starts empty');
  });

  suite('addWater accumulates correctly', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found'); return; }

    freshMyData();
    var day = todayKey();

    WT.add(250);
    wtEqual(window.myData.nutrition.water[day], 250, 'add 250 → total 250');

    WT.add(330);
    wtEqual(window.myData.nutrition.water[day], 580, 'add 330 → total 580');

    var log = window.myData.nutrition.waterLog[day];
    wtEqual(log.length,   2,   'two log entries after two adds');
    wtEqual(log[0].ml,  250,   'first entry ml = 250');
    wtEqual(log[1].ml,  330,   'second entry ml = 330');
    wtAssert(typeof log[0].time === 'string' && log[0].time.length > 0, 'entry has time string');
  });

  suite('addWater rejects invalid values', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found'); return; }

    freshMyData();
    var day = todayKey();
    WT.add(500);
    var before = window.myData.nutrition.water[day];

    WT.add(0);      wtEqual(window.myData.nutrition.water[day], before, 'add 0 rejected');
    WT.add(-100);   wtEqual(window.myData.nutrition.water[day], before, 'add negative rejected');
    WT.add(6000);   wtEqual(window.myData.nutrition.water[day], before, 'add >5000 rejected');
    WT.add('abc');  wtEqual(window.myData.nutrition.water[day], before, 'add non-numeric rejected');

    WT.add(1);
    wtEqual(window.myData.nutrition.water[day], before + 1,       'add 1 (min) accepted');
    WT.add(5000);
    wtEqual(window.myData.nutrition.water[day], before + 1 + 5000,'add 5000 (max) accepted');
  });

  suite('removeEntry decrements correctly', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found'); return; }

    freshMyData();
    var day = todayKey();
    WT.add(200); WT.add(500); WT.add(300);

    wtEqual(window.myData.nutrition.water[day], 1000, 'setup: total 1000');
    wtEqual(window.myData.nutrition.waterLog[day].length, 3, 'setup: 3 entries');

    WT.removeEntry(day, 1);  // remove 500
    wtEqual(window.myData.nutrition.water[day], 500, 'remove 500 → total 500');
    wtEqual(window.myData.nutrition.waterLog[day].length, 2, '2 entries remain');
    wtEqual(window.myData.nutrition.waterLog[day][0].ml, 200, 'entry[0]=200');
    wtEqual(window.myData.nutrition.waterLog[day][1].ml, 300, 'entry[1]=300');

    WT.removeEntry(day, 0);  // remove 200
    wtEqual(window.myData.nutrition.water[day], 300, 'remove 200 → total 300');

    WT.removeEntry(day, 0);  // remove 300 → zero
    wtEqual(window.myData.nutrition.water[day], 0, 'all removed → total 0');
    wtEqual(window.myData.nutrition.waterLog[day].length, 0, 'log empty');

    WT.removeEntry(day, 0);  // out of bounds — no-op
    wtEqual(window.myData.nutrition.water[day], 0, 'out-of-bounds remove: total stays 0');
  });

  suite('goal setting', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found'); return; }

    freshMyData();
    wtEqual(WT._goal(), 2000, 'default goal 2000ml');

    window.myData.nutrition.waterGoal = 2500;
    wtEqual(WT._goal(), 2500, 'reads waterGoal from myData');

    [500, 1000, 1500, 2000, 2500, 3000].forEach(function (v) {
      wtAssert(v >= 100 && v <= 10000, 'preset ' + v + ' in valid range');
    });
  });

  suite('_dayKey offsets', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found'); return; }

    var today     = new Date().toISOString().split('T')[0];
    var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    var sixAgo    = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

    wtEqual(WT._dayKey(0), today,     '_dayKey(0) = today');
    wtEqual(WT._dayKey(1), yesterday, '_dayKey(1) = yesterday');
    wtEqual(WT._dayKey(6), sixAgo,    '_dayKey(6) = 6 days ago');

    var keys   = [0,1,2,3,4,5,6].map(WT._dayKey);
    var unique = new Set(keys).size;
    wtEqual(unique, 7, '7 keys are all unique');
    keys.forEach(function (k) {
      wtAssert(/^\d{4}-\d{2}-\d{2}$/.test(k), k + ' is YYYY-MM-DD');
    });
  });

  suite('multi-day isolation', function () {
    var WT = window.WaterTracker;
    if (!WT) { wtAssert(false, 'WaterTracker not found'); return; }

    freshMyData();
    window.myData.nutrition.water[WT._dayKey(1)] = 1800;
    window.myData.nutrition.water[WT._dayKey(2)] = 2200;

    var n = WT._getData();
    wtEqual(n.water[WT._dayKey(1)], 1800, 'yesterday = 1800');
    wtEqual(n.water[WT._dayKey(2)], 2200, '2 days ago = 2200');
    wtEqual(n.water[WT._dayKey(0)] || 0, 0, 'today starts at 0');

    WT.add(400);
    wtEqual(n.water[WT._dayKey(0)], 400,  'today = 400 after add');
    wtEqual(n.water[WT._dayKey(1)], 1800, 'yesterday unaffected');
  });

  // ── Summary ──────────────────────────────────────────────
  var total = _r.passed + _r.failed;
  _out('\n' + '─'.repeat(50));
  _out('Water Tracker: ' + _r.passed + '/' + total + ' passed');
  if (_r.failed > 0) {
    _r.errors.forEach(function (e) { _out('  ✗ ' + e); });
  } else {
    _out('🎉 All water tests passed!');
  }

})();
