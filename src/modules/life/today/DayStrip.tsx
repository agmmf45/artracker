import { useMemo } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useMedia, useNow, useSettings } from '@/core/hooks';
import { daysBetween, fmtDate, fmtTime, fromKey, hijri, hijriParts, hm, relativeDay, shiftKey, specialDay, todayKey } from '@/core/dates';
import { prayerTimes, PRAYER_NAMES, type PrayerTimes } from '@/core/prayer';
import { useCalendarItems, type CalItem } from '../calendar/sources';

const ORDER: Array<keyof PrayerTimes> = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const SYN = 29.530588853;

/** Moon age (days) and phase 0..1 from the mean synodic month, reference new moon 2000-01-06 18:14 UTC. */
export function moonPhase(at: Date): { age: number; phase: number; lit: number } {
  const age = (((at.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % SYN + SYN) % SYN;
  const phase = age / SYN;
  return { age, phase, lit: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
}

function moonName(p: number, ar: boolean): string {
  const n: Array<[number, string, string]> = [[0.03, 'محاق', 'New moon'], [0.22, 'هلال', 'Crescent'], [0.28, 'تربيع أول', 'First quarter'], [0.47, 'أحدب متزايد', 'Waxing gibbous'], [0.53, 'بدر', 'Full moon'], [0.72, 'أحدب متناقص', 'Waning gibbous'], [0.78, 'تربيع أخير', 'Last quarter'], [0.97, 'هلال آخر الشهر', 'Waning crescent'], [1.01, 'محاق', 'New moon']];
  const row = n.find(([max]) => p < max)!;
  return ar ? row[1] : row[2];
}

function Moon({ phase, size, label }: { phase: number; size: number; label: string }) {
  const r = 18, c = 20, rx = (r * Math.abs(Math.cos(2 * Math.PI * phase))).toFixed(2);
  const waxing = phase < 0.5;
  const gib = waxing ? phase > 0.25 : phase < 0.75;
  const d = waxing
    ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${gib ? 1 : 0} ${c},${c - r} Z`
    : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${gib ? 0 : 1} ${c},${c - r} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={label} className="shrink-0">
      <circle cx="20" cy="20" r="18" fill="color-mix(in oklab, var(--border) 70%, var(--surface))" stroke="var(--border)" />
      <path d={d} fill="var(--reward)" />
    </svg>
  );
}

interface Special { sym: string; text: string; to?: string }

/** What's notable about a day — all computed (calendar, Hijri date, weekday, your exams and due work), nothing invented. */
function specialsFor(day: string, ar: boolean, locale: string, upcoming: CalItem[] | undefined): Special[] {
  const L = (a: string, e: string) => (ar ? a : e);
  const out: Special[] = [];
  const hol = specialDay(day, ar ? 'ar' : 'en');
  if (hol) out.push({ sym: '✦', text: hol });
  const h = hijriParts(day);
  const month = hijri(day, ar ? 'ar' : 'en', { month: 'long' });
  if (h.day >= 13 && h.day <= 15) out.push({ sym: '◐', text: L(`من أيام البيض (${h.day} ${month})`, `One of the White Days (${h.day} ${month})`) });
  else if (h.day < 13 && 13 - h.day <= 7) out.push({ sym: '◐', text: L(`أيام البيض بعد ${13 - h.day} ${13 - h.day === 1 ? 'يوم' : 'أيام'}`, `White Days in ${13 - h.day} day${13 - h.day === 1 ? '' : 's'}`) });
  const wd = fromKey(day).getDay();
  if (wd === 1 || wd === 4) out.push({ sym: '☾', text: L(`${wd === 1 ? 'الاثنين' : 'الخميس'} — صيام سنّة`, `${wd === 1 ? 'Monday' : 'Thursday'} — sunnah fast`) });
  if (wd === 0 || wd === 3) out.push({ sym: '☾', text: L(`بكرة ${wd === 0 ? 'الاثنين' : 'الخميس'} — صيام سنّة`, `Tomorrow is ${wd === 0 ? 'Monday' : 'Thursday'} — sunnah fast`) });
  if (wd === 5) out.push({ sym: '✦', text: L('الجمعة — سورة الكهف', 'Friday — Surat al-Kahf') });
  for (const it of upcoming ?? []) {
    const n = daysBetween(day, it.date);
    if (n < 0) continue;
    const when = n === 0 ? L('اليوم', 'today') : n === 1 ? L('بكرة', 'tomorrow') : L(`بعد ${n} أيام`, `in ${n} days`);
    if (it.kind === 'exam' && n <= 14) out.push({ sym: '★', text: `${it.title} ${when}`, to: '/life/calendar' });
    else if (it.kind === 'assignment' && !it.done && n <= 1) out.push({ sym: '★', text: L(`تسليم ${it.title} ${when}`, `${it.title} due ${when}`), to: '/life/calendar' });
  }
  void locale;
  return out.slice(0, 5);
}

/**
 * The calendar card at the top of the Day page: a tear-off date, the clock, the next prayer with a
 * countdown, the whole day on one line (prayers, daylight, now), the moon, and what's special today.
 * Prayer times are computed on the device from the saved location (Settings › Integrations).
 */
export function DayStrip({ day }: { day: string }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const now = useNow(1000);
  const wide = useMedia('(min-width: 1024px)');
  const today = todayKey();
  const isToday = day === today;
  const ar = lang === 'ar';
  const h12 = settings.timeFormat !== '24';
  const upcoming = useCalendarItems(day, shiftKey(day, 14), settings);

  const pr = settings.prayer;
  const times = useMemo(() => (pr.lat != null && pr.lng != null ? prayerTimes(fromKey(day), pr.lat, pr.lng, pr.method) : null), [day, pr.lat, pr.lng, pr.method]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const list = times ? ORDER.map((k) => ({ k, name: L(PRAYER_NAMES[k][0], PRAYER_NAMES[k][1]), at: times[k], min: hm(times[k]) ?? 0 })) : [];
  let nextIdx = isToday ? list.findIndex((p) => p.k !== 'sunrise' && p.min > nowMin) : -1;
  const afterIsha = isToday && times && nextIdx < 0;
  const tomorrowFajr = useMemo(() => (afterIsha && pr.lat != null && pr.lng != null ? prayerTimes(fromKey(shiftKey(day, 1)), pr.lat, pr.lng, pr.method).fajr : null), [afterIsha, day, pr.lat, pr.lng, pr.method]);
  const next = nextIdx >= 0 ? { name: list[nextIdx].name, at: list[nextIdx].at, min: list[nextIdx].min } : afterIsha && tomorrowFajr ? { name: L('الفجر', 'Fajr'), at: tomorrowFajr, min: (hm(tomorrowFajr) ?? 0) + 1440 } : null;
  if (afterIsha) nextIdx = -1;
  const left = next ? next.min - nowMin - (now.getSeconds() > 0 ? 1 : 0) : 0;
  const leftTxt = `${Math.floor(left / 60)}:${String(Math.max(0, left % 60)).padStart(2, '0')}`;
  const past = (min: number) => (day < today ? true : day > today ? false : min <= nowMin);

  // the day's line runs 03:00 → 22:00 so the prayers spread out
  const W0 = 180, W1 = 1320;
  const pos = (m: number) => `${Math.min(100, Math.max(0, ((m - W0) / (W1 - W0)) * 100)).toFixed(2)}%`;

  const moonAt = isToday ? now : new Date(fromKey(day).getTime() + 12 * 3600e3);
  const moon = moonPhase(moonAt);
  const mName = moonName(moon.phase, ar);
  const specials = specialsFor(day, ar, locale, upcoming);

  const hh = now.getHours();
  const clock = h12 ? `${hh % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}` : `${String(hh).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const ampm = h12 ? (hh < 12 ? L('ص', 'AM') : L('م', 'PM')) : '';
  const weekday = fmtDate(day, locale, { weekday: 'long' });
  const gMonth = fmtDate(day, locale, { month: 'long' });
  const gDay = fmtDate(day, locale, { day: 'numeric' });

  const tear = (
    <div className={clsx('shrink-0 overflow-hidden rounded-[14px] border-[1.5px] border-line bg-surface text-center', wide ? 'w-[150px]' : 'w-[70px] rounded-[12px]')}>
      <div className={clsx('bg-accent font-bold text-on-accent', wide ? 'py-1.5 text-[14px]' : 'py-0.5 text-[11.5px]')}>{gMonth}{wide && <span className="num"> {fmtDate(day, locale, { year: 'numeric' })}</span>}</div>
      <div className={clsx('num font-black leading-tight', wide ? 'pt-1 text-[58px]' : 'text-[28px]')}>{gDay}</div>
      <div className={clsx('font-bold', wide ? 'text-[17px]' : 'pb-1 text-[11.5px]')}>{weekday}</div>
      {wide && <div className="mx-2.5 mt-2 border-t-[1.5px] border-dashed border-line px-1 pb-3 pt-1.5 text-[12.5px] text-fg-2">{hijri(day, lang)}</div>}
    </div>
  );

  const clockBlock = isToday ? (
    <div className="flex items-baseline gap-1.5" aria-label={L('الساعة', 'Time')}>
      <b className={clsx('num leading-none', wide ? 'text-[54px]' : 'text-[34px]')}>{clock}</b>
      <span className={clsx('num font-semibold text-fg-2', wide ? 'text-[17px]' : 'text-[13px]')}>:{String(now.getSeconds()).padStart(2, '0')}</span>
      {ampm && <span className={clsx('font-semibold text-fg-2', wide ? 'text-[17px]' : 'text-[14px]')}>{ampm}</span>}
    </div>
  ) : (
    <b className={clsx('nb-title leading-none', wide ? 'text-[42px]' : 'text-[30px]')}>{relativeDay(day, lang, locale)}</b>
  );

  const nextBox = next ? (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[14px] bg-fg px-3.5 py-2 text-bg">
      <span className="text-[12.5px] opacity-80">{L('الصلاة الجاية', 'Next prayer')}</span>
      <b className="text-[16px]">{next.name}</b>
      <b className="num text-[16px] text-reward">{fmtTime(next.at, locale, h12)}</b>
      <span className="num text-[12.5px] opacity-90">{L(`باقي ${leftTxt}`, `in ${leftTxt}`)}</span>
    </div>
  ) : null;

  const pills = times ? (
    <ol className="grid grid-cols-6 gap-0.5" aria-label={L('أوقات الصلاة', 'Prayer times')}>
      {list.map((p, i) => (
        <li key={p.k} className={clsx('flex min-w-0 flex-col items-center rounded-[12px] px-0.5 py-1',
          i === nextIdx ? 'bg-fg text-bg' : p.k === 'sunrise' ? 'text-warning' : past(p.min) ? 'text-fg-3' : '')}>
          <span className={clsx('text-[11.5px] font-semibold', i !== nextIdx && p.k !== 'sunrise' && 'text-fg-2', i !== nextIdx && past(p.min) && p.k !== 'sunrise' && 'text-fg-3')}>{p.name}</span>
          <b className={clsx('num whitespace-nowrap', wide ? 'text-[14px]' : 'text-[12.5px]', i !== nextIdx && past(p.min) && p.k !== 'sunrise' && 'line-through decoration-1')}>{fmtTime(p.at, locale, h12)}</b>
        </li>
      ))}
    </ol>
  ) : (
    <Link to="/settings/integrations" className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border-[1.5px] border-dashed border-line-strong px-3.5 text-[13px] font-bold text-accent-ink hover:border-solid">
      🕌 {L('حدّد موقعك عشان تطلع أوقات الصلاة', 'Set your location to see prayer times')}
    </Link>
  );

  const line = times ? (
    <div className="relative h-8" aria-hidden="true">
      <span className="absolute inset-x-0 top-[14px] h-1 rounded bg-surface-2" />
      <span className="absolute top-[14px] h-1 rounded bg-reward" style={{ insetInlineStart: pos(hm(times.sunrise) ?? 0), width: `calc(${pos(hm(times.maghrib) ?? 0)} - ${pos(hm(times.sunrise) ?? 0)})` }} />
      {list.map((p, i) => <span key={p.k} className={clsx('absolute top-[8px] h-4 -translate-x-1/2 rounded rtl:translate-x-1/2', i === nextIdx ? 'w-[3px] bg-fg' : 'w-0.5 bg-line-strong')} style={{ insetInlineStart: pos(p.min) }} />)}
      {isToday && <span className="absolute top-[7px] size-[18px] -translate-x-1/2 rounded-full border-[3px] border-surface bg-accent shadow-[0_0_0_1.5px_var(--accent)] rtl:translate-x-1/2" style={{ insetInlineStart: pos(nowMin) }} />}
    </div>
  ) : null;

  const moonBlock = (
    <div className="flex items-center gap-3">
      <Moon phase={moon.phase} size={wide ? 52 : 42} label={L(`القمر: ${mName}`, `Moon: ${mName}`)} />
      <div>
        <div className="text-[15px] font-bold">{mName}</div>
        <div className="num text-[12.5px] text-fg-2">{L(`مضاء ${Math.round(moon.lit * 100)}٪ · عمره ${Math.round(moon.age)} يوم`, `${Math.round(moon.lit * 100)}% lit · ${Math.round(moon.age)} days old`)}</div>
      </div>
    </div>
  );

  const title = <h1 className="sr-only">{`${weekday}، ${gDay} ${gMonth} — ${hijri(day, lang)}`}</h1>;

  if (!wide) {
    return (
      <section className="nb-paper relative mb-4 flex flex-col gap-3 rounded-lg p-3.5 shadow-2" aria-label={L('شريط اليوم', 'Day strip')}>
        {title}
        <div className="flex items-center gap-3">
          {tear}
          <div className="min-w-0 flex-1">
            {clockBlock}
            <div className="mt-1 text-[12.5px] text-fg-2">{hijri(day, lang)}</div>
          </div>
          <div className="text-center">
            <Moon phase={moon.phase} size={42} label={L(`القمر: ${mName}`, `Moon: ${mName}`)} />
            <div className="text-[11px] font-semibold text-fg-2">{mName}</div>
          </div>
        </div>
        {nextBox}
        {pills}
        {specials.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {specials.map((s, i) => <SpecialChip key={i} s={s} />)}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="nb-paper relative mb-5 grid grid-cols-[150px_minmax(0,1fr)_280px] gap-6 rounded-lg p-5 shadow-2" aria-label={L('شريط اليوم', 'Day strip')}>
      {title}
      <span className="nb-washi -top-3 end-16 rotate-3" aria-hidden="true" />
      {tear}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">{clockBlock}{nextBox}</div>
        {line}
        {pills}
      </div>
      <div className="flex flex-col gap-2 border-s-[1.5px] border-dashed border-line ps-5">
        {moonBlock}
        <div className="mt-1 text-[12px] font-bold text-fg-2">{L('المميز اليوم', 'Special today')}</div>
        {specials.length ? (
          <ul className="flex flex-col">
            {specials.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 border-b-[1.5px] border-dashed border-line py-1.5 text-[13.5px] leading-snug last:border-b-0">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--reward)_35%,var(--surface))] text-[11px] font-bold" aria-hidden="true">{s.sym}</span>
                {s.to ? <Link to={s.to} className="hover:underline">{s.text}</Link> : <span>{s.text}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-fg-3">{L('يوم عادي — اكتبه أنت.', 'An ordinary day — make it yours.')}</p>}
      </div>
    </section>
  );
}

function SpecialChip({ s }: { s: Special }) {
  const cls = 'inline-flex min-h-8 items-center gap-1.5 rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--reward)_70%,var(--border))] bg-[color-mix(in_oklab,var(--reward)_30%,var(--surface))] px-3 text-[12.5px] font-semibold';
  return s.to ? <Link to={s.to} className={cls}><span aria-hidden="true">{s.sym}</span>{s.text}</Link> : <span className={cls}><span aria-hidden="true">{s.sym}</span>{s.text}</span>;
}
