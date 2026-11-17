import { describe, it, expect } from 'vitest';
import { prayerTimes } from './prayer';

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

describe('prayer times', () => {
  it('Riyadh, Umm al-Qura — within a few minutes of published times', () => {
    process.env.TZ = 'Asia/Riyadh';
    // Published Umm al-Qura times for Riyadh on 2026-11-17 are about: Fajr 04:55, Dhuhr 11:37, Asr 14:39, Maghrib 17:00, Isha 18:30
    const t = prayerTimes(new Date(2026, 10, 17), 24.7136, 46.6753, 'umm_al_qura');
    const near = (a: string, b: string, tol = 6) => expect(Math.abs(toMin(a) - toMin(b))).toBeLessThanOrEqual(tol);
    near(t.fajr, '04:55');
    near(t.dhuhr, '11:37');
    near(t.asr, '14:39');
    near(t.maghrib, '17:00');
    expect(toMin(t.isha) - toMin(t.maghrib)).toBe(90);
  });

  it('orders prayers chronologically', () => {
    const t = prayerTimes(new Date(2026, 5, 21), 21.4858, 39.1925, 'mwl');
    const seq = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map(toMin);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1]);
  });
});
