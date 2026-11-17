/**
 * Prayer times computed locally (no network, location never leaves the device/account).
 * Standard astronomical method (Jean Meeus approximations, as used by PrayTimes.org).
 * Times are returned in the device's local time zone as "HH:MM".
 */
export type PrayerMethod = 'umm_al_qura' | 'mwl' | 'isna' | 'egypt';

const METHODS: Record<PrayerMethod, { fajr: number; isha: number | { minutes: number } }> = {
  umm_al_qura: { fajr: 18.5, isha: { minutes: 90 } },
  mwl: { fajr: 18, isha: 17 },
  isna: { fajr: 15, isha: 15 },
  egypt: { fajr: 19.5, isha: 17.5 },
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => { const x = a - b * Math.floor(a / b); return x < 0 ? x + b : x; };

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - RA;
  return { decl, eqt };
}

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

export interface PrayerTimes { fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string }

export function prayerTimes(date: Date, lat: number, lng: number, method: PrayerMethod = 'umm_al_qura'): PrayerTimes {
  const tz = -date.getTimezoneOffset() / 60;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const m = METHODS[method];

  const midDay = (t: number) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const { decl } = sunPosition(jd + t);
    const noon = midDay(t);
    const cosH = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    const h = deg(Math.acos(Math.max(-1, Math.min(1, cosH)))) / 15;
    return noon + (ccw ? -h : h);
  };
  const asrTime = (t: number) => {
    const { decl } = sunPosition(jd + t);
    const angle = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - decl))))));
    return angleTime(angle, t, false);
  };

  // two-pass refinement around default times
  let times = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const p = (h: number) => h / 24;
    times = {
      fajr: angleTime(m.fajr, p(times.fajr), true),
      sunrise: angleTime(0.833, p(times.sunrise), true),
      dhuhr: midDay(p(times.dhuhr)),
      asr: asrTime(p(times.asr)),
      maghrib: angleTime(0.833, p(times.maghrib), false),
      isha: typeof m.isha === 'number' ? angleTime(m.isha, p(times.isha), false) : times.isha,
    };
  }
  const adj = (h: number) => h + tz - lng / 15;
  const out = {
    fajr: adj(times.fajr), sunrise: adj(times.sunrise), dhuhr: adj(times.dhuhr), asr: adj(times.asr), maghrib: adj(times.maghrib),
    isha: typeof m.isha === 'number' ? adj(times.isha) : adj(times.maghrib) + m.isha.minutes / 60,
  };
  const fmt = (h: number) => {
    const t = fix(h + 0.5 / 60, 24);
    return `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t - Math.floor(t)) * 60)).padStart(2, '0')}`;
  };
  return { fajr: fmt(out.fajr), sunrise: fmt(out.sunrise), dhuhr: fmt(out.dhuhr), asr: fmt(out.asr), maghrib: fmt(out.maghrib), isha: fmt(out.isha) };
}

export const PRAYER_NAMES: Record<keyof PrayerTimes, [string, string]> = {
  fajr: ['الفجر', 'Fajr'], sunrise: ['الشروق', 'Sunrise'], dhuhr: ['الظهر', 'Dhuhr'], asr: ['العصر', 'Asr'], maghrib: ['المغرب', 'Maghrib'], isha: ['العشاء', 'Isha'],
};
