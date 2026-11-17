/**
 * runner.js — Capacitor BackgroundRunner script for دقيق
 *
 * Runs in an ISOLATED JavaScript context on iOS (no window/DOM/fetch).
 * Reads workouts + body weight from HealthKit in the background,
 * stores a payload in CapacitorKV for the main app to consume on foreground.
 *
 * Docs: https://capacitorjs.com/docs/apis/background-runner
 * Registered in capacitor.config.json → plugins.BackgroundRunner
 */

addEventListener('healthSync', async function (resolve, reject, args) {
  try {
    var since = (args.details && args.details.cursor)
      ? args.details.cursor
      : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    var until = new Date().toISOString();

    // ── Workouts ──────────────────────────────────────────
    var workouts = [];
    try {
      var wResult = await CapacitorHealthKit.queryWorkouts({
        startDate: since, endDate: until, limit: 50, ascending: false,
      });
      workouts = wResult.workouts || [];
    } catch (_) {}

    // ── Body Weight ───────────────────────────────────────
    var weights = [];
    try {
      var bwResult = await CapacitorHealthKit.querySampleType({
        sampleType: 'HKQuantityTypeIdentifierBodyMass',
        startDate:  since, endDate: until, limit: 30, ascending: false,
      });
      weights = bwResult.samples || [];
    } catch (_) {}

    // ── Store payload for foreground pickup ───────────────
    var payload = {
      workouts: workouts.slice(0, 20).map(function (w) {
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
      fetchedAt: until,
    };

    await CapacitorKV.set('daqeeq_bg_payload', JSON.stringify(payload));
    resolve({ fetched: workouts.length + weights.length });

  } catch (err) {
    reject(err.message || 'runner error');
  }
});
