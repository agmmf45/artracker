/** Sleep math. Bedtime after wake time means the sleep crossed midnight (e.g. 23:30 → 07:00 = 7.5h). */
export function sleepHours(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

/** Bedtime as minutes relative to 18:00 so 23:00 and 01:00 average sensibly. */
export function bedMinutes(bed: string): number {
  const [h, m] = bed.split(':').map(Number);
  const t = h * 60 + m;
  return t < 18 * 60 ? t + 24 * 60 : t;
}

/** Consistency = standard deviation of bedtimes in minutes (lower is steadier). */
export function bedtimeSpread(beds: string[]): number | null {
  if (beds.length < 2) return null;
  const xs = beds.map(bedMinutes);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.round(Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length));
}

export function fromBedMinutes(m: number): string {
  const t = Math.round(m) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
