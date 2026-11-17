import type { EventData } from '@/modules/shared/domain';
import type { Recurrence } from './recurrence';

/** Minimal RFC 5545 support: VEVENT with DTSTART/DTEND (date or date-time), SUMMARY, DESCRIPTION, LOCATION, RRULE, UID. */

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function unesc(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}
function fold(line: string): string {
  const out: string[] = [];
  let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; }
  out.push(s);
  return out.join('\r\n');
}

export function toIcs(events: Array<{ id: string; data: EventData }>, calName = 'Daqeeq'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daqeeq//Life OS//AR', `X-WR-CALNAME:${esc(calName)}`, 'CALSCALE:GREGORIAN'];
  for (const { id, data: e } of events) {
    const d = (k: string) => k.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${id}@daqeeq.org`, `DTSTAMP:${stamp}`);
    if (e.all_day || !e.start_time) {
      const end = new Date(`${e.end ?? e.start}T00:00:00`);
      end.setDate(end.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${d(e.start)}`, `DTEND;VALUE=DATE:${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`);
    } else {
      lines.push(`DTSTART:${d(e.start)}T${e.start_time.replace(':', '')}00`, `DTEND:${d(e.end ?? e.start)}T${(e.end_time ?? e.start_time).replace(':', '')}00`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.recurrence) {
      const r = e.recurrence;
      let rule = `RRULE:FREQ=${r.freq.toUpperCase()};INTERVAL=${Math.max(1, r.interval || 1)}`;
      if (r.weekdays?.length) rule += `;BYDAY=${r.weekdays.map((x) => DAYS[x]).join(',')}`;
      if (r.until) rule += `;UNTIL=${d(r.until)}`;
      if (r.count) rule += `;COUNT=${r.count}`;
      lines.push(rule);
      if (r.exceptions?.length) lines.push(`EXDATE;VALUE=DATE:${r.exceptions.map(d).join(',')}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

function parseDate(v: string, params: string): { date: string; time: string | null } {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v);
  if (!m) throw new Error(`bad date ${v}`);
  if (!m[4] || /VALUE=DATE/i.test(params)) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
  if (m[7]) {
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return {
      date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
    };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

export interface ParsedIcsEvent { uid: string; data: EventData }

export function parseIcs(text: string): ParsedIcsEvent[] {
  const raw = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: ParsedIcsEvent[] = [];
  let cur: Record<string, { v: string; p: string }> | null = null;
  for (const line of raw) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT' && cur) {
      try {
        if (!cur.DTSTART) throw new Error('no start');
        const s = parseDate(cur.DTSTART.v, cur.DTSTART.p);
        const e = cur.DTEND ? parseDate(cur.DTEND.v, cur.DTEND.p) : s;
        let endDate = e.date;
        if (!s.time && cur.DTEND) { const x = new Date(`${e.date}T00:00:00`); x.setDate(x.getDate() - 1); endDate = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; if (endDate < s.date) endDate = s.date; }
        let recurrence: Recurrence | null = null;
        if (cur.RRULE) {
          const parts = Object.fromEntries(cur.RRULE.v.split(';').map((kv) => kv.split('=')));
          const freq = String(parts.FREQ ?? '').toLowerCase();
          if (['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) {
            recurrence = {
              freq: freq as Recurrence['freq'],
              interval: Number(parts.INTERVAL ?? 1) || 1,
              weekdays: parts.BYDAY ? String(parts.BYDAY).split(',').map((x: string) => DAYS.indexOf(x.slice(-2))).filter((x: number) => x >= 0) : undefined,
              until: parts.UNTIL ? parseDate(parts.UNTIL, '').date : null,
              count: parts.COUNT ? Number(parts.COUNT) : null,
              exceptions: cur.EXDATE ? cur.EXDATE.v.split(',').map((x) => parseDate(x, cur!.EXDATE.p).date) : undefined,
            };
          }
        }
        out.push({
          uid: (cur.UID?.v ?? `${s.date}-${cur.SUMMARY?.v ?? ''}`).slice(0, 100),
          data: {
            title: unesc(cur.SUMMARY?.v ?? '').slice(0, 300) || '(بدون عنوان)',
            start: s.date, start_time: s.time, end: endDate, end_time: e.time, all_day: !s.time,
            category: 'personal', location: cur.LOCATION ? unesc(cur.LOCATION.v).slice(0, 300) : null,
            notes: cur.DESCRIPTION ? unesc(cur.DESCRIPTION.v).slice(0, 5000) : '', recurrence, color: null, reminder_min: null, source: 'ics',
          },
        });
      } catch { /* skip malformed event */ }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    cur[name.toUpperCase()] = { v: line.slice(i + 1), p: params.join(';') };
  }
  return out;
}
