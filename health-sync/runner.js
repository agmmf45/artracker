/**
 * runner.js — Capacitor BackgroundRunner script for دقيق
 *
 * This file runs in an ISOLATED JavaScript context on iOS
 * (no window, no DOM, no fetch — only the BackgroundRunner APIs).
 * It is NOT loaded as a browser script.
 *
 * Reference: https://capacitorjs.com/docs/apis/background-runner
 *
 * Registered in capacitor.config.json under:
 *   "BackgroundRunner": { "src": "health-sync/runner.js", ... }
 *
 * The event "healthSync" is dispatched by background-sync.js
 * when the app backgrounds.
 */

// ── HealthKit read inside BackgroundRunner context ────────
// BackgroundRunner provides: CapacitorHealthKit.* APIs natively
addEventListener('healthSync', async function (resolve, reject, args) {
  try {
    var since = args.details && args.details.cursor
      ? args.details.cursor
      : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    var until = new Date().toISOString();

    // Read workouts from HealthKit
    var workouts = [];
    try {
      var wResult = await CapacitorHealthKit.queryWorkouts({
        startDate: since,
        endDate:   until,
        limit:     50,
        ascending: false,
      });
      workouts = wResult.workouts || [];
    } catch (_) {}

    // Read body weight
    var weights = [];
    try {
      var bwResult = await CapacitorHealthKit.querySampleType({
        sampleType: 'HKQuantityTypeIdentifierBodyMass',
        startDate:  since,
        endDate:    until,
        limit:      30,
        ascending:  false,
      });
      weights = bwResult.samples || [];
    } catch (_) {}

    // Read step counts (aggregate per day)
    var steps = [];
    try {
      var stResult = await CapacitorHealthKit.queryStatisticsCollection({
        quantityType:       'HKQuantityTypeIdentifierStepCount',
        startDate:          since,
        endDate:            until,
        anchorDate:         since,
        intervalComponents: { day: 1 },
        statisticsOptions:  ['cumulativeSum'],
      });
      steps = stResult.statistics || [];
    } catch (_) {}

    // Send collected data to the main app context via notification
    // The main app processes it on next foreground using a stored payload.
    var payload = {
      workouts:  workouts.slice(0, 20).map(function (w) {
        return {
          uuid:              w.uuid,
          activityType:      w.activityType,
          startDate:         w.startDate,
          endDate:           w.endDate,
          totalEnergyBurned: w.totalEnergyBurned || 0,
          totalDistance:     w.totalDistance     || 0,
        };
      }),
      weights: weights.slice(0, 10).map(function (s) {
        return { uuid: s.uuid, quantity: s.quantity, endDate: s.endDate };
      }),
      steps: steps.map(function (s) {
        return { date: s.startDate, count: s.sumQuantity || 0 };
      }),
      fetchedAt: until,
    };

    // Persist the payload so the main context can read it when foregrounded
    await CapacitorKV.set('daqeeq_bg_payload', JSON.stringify(payload));

    resolve({ fetched: workouts.length + weights.length + steps.length });
  } catch (err) {
    reject(err.message || 'runner error');
  }
});
