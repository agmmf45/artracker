/**
 * Focus-session accounting.
 * - Duration is computed from timestamps (started_at, ended_at, paused milliseconds), never from a ticking counter,
 *   so refreshes, sleep or background throttling cannot distort it.
 * - A new session is clipped against existing sessions so overlapping time is never counted twice.
 */
export interface Interval { start: number; end: number }

export function effectiveMinutes(startedAt: string, endedAt: string, pausedMs: number): number {
  return Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt) - pausedMs) / 60000));
}

/** Returns the portion of [start,end] not covered by existing intervals (may be split). */
export function subtractOverlaps(s: Interval, existing: Interval[]): Interval[] {
  let parts: Interval[] = [s];
  for (const e of existing) {
    const next: Interval[] = [];
    for (const p of parts) {
      if (e.end <= p.start || e.start >= p.end) { next.push(p); continue; }
      if (e.start > p.start) next.push({ start: p.start, end: e.start });
      if (e.end < p.end) next.push({ start: e.end, end: p.end });
    }
    parts = next;
  }
  return parts.filter((p) => p.end - p.start >= 60_000);
}
