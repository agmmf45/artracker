import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DndContext, PointerSensor, TouchSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus, Upload, Download, AlertTriangle, MapPin } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useNow, useRecord, useSettings } from '@/core/hooks';
import { fmtDate, fmtTime, fromKey, hijri, hm, monthGrid, rangeKeys, shiftKey, specialDay, todayKey, weekStartKey, fromMinutes, dateKey } from '@/core/dates';
import { update, create } from '@/core/repo';
import { toast } from '@/core/toast';
import { parseIcs, toIcs } from '@/core/ics';
import { download } from '@/core/portability';
import { prayerTimes, PRAYER_NAMES, type PrayerTimes } from '@/core/prayer';
import { db } from '@/core/db';
import { Button, Chip, EmptyState, IconButton, PageHeader, Segmented } from '@/design/ui';
import type { EventData } from '@/modules/shared/domain';
import { EventEditor } from './calendar/EventEditor';
import { TaskEditor } from './tasks/TaskEditor';
import { conflicts, useCalendarItems, type CalItem } from './calendar/sources';
import type { Task, TaskData } from './tasks/model';

type View = 'day' | 'week' | 'month' | 'agenda';
const HOUR_PX = 48;

export default function CalendarPage() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(settings.calendar.defaultView);
  const [cursor, setCursor] = useState(todayKey());
  const [editEvent, setEditEvent] = useState<{ rec: Rec<EventData> | null; defaults?: Partial<EventData>; occ?: string } | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const editTask = useRecord<TaskData>(editTaskId);
  const fileRef = useRef<HTMLInputElement>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') { const s = weekStartKey(cursor, settings.weekStart); return { from: s, to: shiftKey(s, 6) }; }
    if (view === 'agenda') return { from: cursor, to: shiftKey(cursor, 30) };
    const d = fromKey(cursor);
    const g = monthGrid(d.getFullYear(), d.getMonth(), settings.weekStart);
    return { from: g[0], to: g[41] };
  }, [view, cursor, settings.weekStart]);

  const items = useCalendarItems(range.from, range.to, settings);
  const clash = useMemo(() => conflicts(items ?? []), [items]);

  useEffect(() => {
    const day = params.get('date');
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) { setCursor(day); setView('day'); params.delete('date'); setParams(params, { replace: true }); return; }
    const id = params.get('open');
    if (!id) return;
    void db().records.get(id).then((r) => { if (r?.type === 'event') setEditEvent({ rec: r as unknown as Rec<EventData> }); });
    params.delete('open'); setParams(params, { replace: true });
  }, [params, setParams]);

  const step = (dir: number) => {
    const n = view === 'day' ? 1 : view === 'week' ? 7 : view === 'agenda' ? 30 : 0;
    if (n) setCursor(shiftKey(cursor, dir * n));
    else { const d = fromKey(cursor); setCursor(dateKey(new Date(d.getFullYear(), d.getMonth() + dir, 1))); }
  };

  const openItem = async (it: CalItem) => {
    if (it.kind === 'event') { const r = await db().records.get(it.recId); if (r) setEditEvent({ rec: r as unknown as Rec<EventData>, occ: it.date }); }
    else if (it.kind === 'task' || it.kind === 'deadline') setEditTaskId(it.recId);
    else if (it.kind === 'exam') nav(`/study/exams?open=${it.recId}`);
    else if (it.kind === 'assignment') nav(`/study/assignments?open=${it.recId}`);
    else if (it.kind === 'class') nav(`/study/courses?open=${it.recId}`);
    else if (it.kind === 'workout') nav('/health/workouts');
    else if (it.kind === 'medication') nav('/health/medication');
  };

  const importIcs = async (f?: File) => {
    if (!f) return;
    const evs = parseIcs(await f.text());
    let added = 0;
    for (const e of evs) {
      const id = `ics:${e.uid.replace(/[^\w:.-]/g, '_')}`;
      if (await db().records.get(id)) continue; // duplicate detection by UID
      await create<EventData>('event', e.data, { id, date: e.data.start });
      added++;
    }
    toast(L(`استوردنا ${added} موعد (${evs.length - added} مكرر)`, `Imported ${added} events (${evs.length - added} duplicates skipped)`));
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportIcs = async () => {
    const evs = await db().records.where('type').equals('event').filter((r) => !r.deleted_at).toArray();
    download('daqeeq-calendar.ics', toIcs(evs.map((e) => ({ id: e.id, data: e.data as unknown as EventData }))), 'text/calendar');
  };

  const title = view === 'month'
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(fromKey(cursor))
    : view === 'day' ? fmtDate(cursor, locale, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${fmtDate(range.from, locale, { day: 'numeric', month: 'short' })} – ${fmtDate(range.to, locale, { day: 'numeric', month: 'short' })}`;
  const showHijri = settings.calendarDisplay !== 'gregorian';

  return (
    <div>
      <PageHeader
        title={L('التقويم', 'Calendar')}
        subtitle={showHijri ? hijri(cursor, lang, { month: 'long', year: 'numeric' }) : undefined}
        actions={<>
          <IconButton label={L('استيراد ICS', 'Import ICS')} onClick={() => fileRef.current?.click()}><Upload size={18} /></IconButton>
          <IconButton label={L('تصدير ICS', 'Export ICS')} onClick={exportIcs}><Download size={18} /></IconButton>
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => setEditEvent({ rec: null, defaults: { start: cursor, end: cursor } })}>{L('موعد', 'Event')}</Button>
        </>}
      />
      <input ref={fileRef} type="file" accept=".ics,text/calendar" className="sr-only" onChange={(e) => importIcs(e.target.files?.[0])} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton label={L('السابق', 'Previous')} onClick={() => step(-1)}>{lang === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</IconButton>
          <Button size="sm" variant="secondary" onClick={() => setCursor(todayKey())}>{L('اليوم', 'Today')}</Button>
          <IconButton label={L('التالي', 'Next')} onClick={() => step(1)}>{lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</IconButton>
        </div>
        <div className="min-w-0 flex-1 truncate font-bold">{title}</div>
        <Segmented size="sm" value={view} onChange={setView} options={[
          { value: 'day', label: L('يوم', 'Day') }, { value: 'week', label: L('أسبوع', 'Week') }, { value: 'month', label: L('شهر', 'Month') }, { value: 'agenda', label: L('أجندة', 'Agenda') },
        ]} />
      </div>

      {clash.size > 0 && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-sm bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] px-3 py-1.5 text-[13px] font-bold text-warning">
          <AlertTriangle size={15} /> {L(`${clash.size} عنصر متعارض في الوقت`, `${clash.size} items overlap in time`)}
        </p>
      )}

      {!items ? <div className="skeleton h-96" /> : view === 'month' ? (
        <MonthView cursor={cursor} items={items} onPick={(d) => { setCursor(d); setView('day'); }} onOpen={openItem} />
      ) : view === 'agenda' ? (
        <Agenda items={items} onOpen={openItem} clash={clash} />
      ) : (
        <TimeGrid days={view === 'day' ? [cursor] : rangeKeys(range.from, 7)} items={items} clash={clash} onOpen={openItem}
          onCreate={(d, t) => setEditEvent({ rec: null, defaults: { start: d, end: d, start_time: t, end_time: fromMinutes((hm(t) ?? 0) + 60), all_day: false } })} />
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 text-[12px]">
        {([['event', 'مواعيد', 'Events'], ['task', 'مهام مجدولة', 'Scheduled tasks'], ['deadline', 'مواعيد نهائية', 'Deadlines'], ['class', 'محاضرات', 'Classes'], ['exam', 'اختبارات', 'Exams']] as const).map(([k, ar, en]) => (
          <Chip key={k}><span className="size-2 rounded-full" style={{ background: `var(--${k === 'event' ? 'life' : k === 'task' ? 'viz-6' : k === 'deadline' ? 'warning' : k === 'class' ? 'study' : 'danger'})` }} />{L(ar, en)}</Chip>
        ))}
      </div>

      <EventEditor open={!!editEvent} onOpenChange={(v) => !v && setEditEvent(null)} rec={editEvent?.rec ?? null} defaults={editEvent?.defaults} occurrence={editEvent?.occ} />
      <TaskEditor open={!!editTaskId && !!editTask} onOpenChange={(v) => !v && setEditTaskId(null)} task={(editTask as Task | null) ?? null} />
    </div>
  );
}

/* ── Day/week time grid with drag-to-reschedule ── */
function TimeGrid({ days, items, clash, onOpen, onCreate }: { days: string[]; items: CalItem[]; clash: Set<string>; onOpen: (i: CalItem) => void; onCreate: (d: string, t: string) => void }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const now = useNow(60_000);
  const scroller = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }));
  const prayers = useMemo(() => {
    const m = new Map<string, PrayerTimes>();
    if (settings.prayer.enabled && settings.prayer.lat != null && settings.prayer.lng != null) for (const d of days) m.set(d, prayerTimes(fromKey(d), settings.prayer.lat, settings.prayer.lng, settings.prayer.method));
    return m;
  }, [days, settings.prayer]);

  useEffect(() => { scroller.current?.scrollTo({ top: Math.max(0, ((hm(settings.dayStart) ?? 420) / 60) * HOUR_PX - 8) }); }, [settings.dayStart]);

  const onEnd = async (e: DragEndEvent) => {
    const it = items.find((x) => x.key === e.active.id);
    if (!it || !it.start) return;
    const colW = (scroller.current?.querySelector('[data-col]') as HTMLElement | null)?.offsetWidth ?? 1;
    const dir = lang === 'ar' ? -1 : 1;
    const dayShift = Math.round((e.delta.x * dir) / colW);
    const minShift = Math.round((e.delta.y / HOUR_PX) * 60 / 15) * 15;
    if (!dayShift && !minShift) return;
    const newDate = shiftKey(it.date, dayShift);
    const newStart = fromMinutes(Math.max(0, Math.min(23 * 60 + 45, (hm(it.start) ?? 0) + minShift)));
    const dur = it.end ? (hm(it.end)! - hm(it.start)!) : 60;
    if (it.kind === 'event') {
      const r = await db().records.get(it.recId);
      const ev = r?.data as unknown as EventData | undefined;
      if (!ev) return;
      if (ev.recurrence) { toast(L('عدّل المواعيد المتكررة من نافذة الموعد', 'Edit recurring events from the event window')); return; }
      await update<EventData>(it.recId, { data: { start: newDate, end: newDate, start_time: newStart, end_time: fromMinutes((hm(newStart) ?? 0) + dur) }, date: newDate });
    } else if (it.kind === 'task') {
      await update<TaskData>(it.recId, { data: { start: newDate, start_time: newStart }, date: newDate });
    } else {
      toast(L('هذا العنصر يُعدّل من صفحته', 'Edit this item from its own page'));
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => {
          const sp = specialDay(d, lang);
          return (
            <div key={d} className={clsx('px-1 py-2 text-center', d === today && 'text-accent')}>
              <div className="text-[11px] font-bold text-fg-3">{fmtDate(d, locale, { weekday: 'short' })}</div>
              <div className="num text-lg font-black leading-tight">{fromKey(d).getDate()}</div>
              {settings.calendarDisplay !== 'gregorian' && <div className="text-[10px] text-fg-3">{hijri(d, lang, { day: 'numeric', month: 'short' })}</div>}
              {sp && <div className="truncate text-[10px] font-bold text-reward">{sp}</div>}
            </div>
          );
        })}
      </div>
      {/* all-day row */}
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
        <div className="p-1 text-[10px] text-fg-3">{L('اليوم كله', 'all-day')}</div>
        {days.map((d) => (
          <div key={d} className="min-h-7 space-y-0.5 border-s border-line p-0.5">
            {items.filter((i) => i.date === d && i.allDay).map((i) => (
              <button key={i.key} onClick={() => onOpen(i)} className={clsx('block w-full truncate rounded-[4px] px-1.5 py-0.5 text-start text-[11px] font-bold', i.done && 'line-through opacity-60')} style={{ background: `color-mix(in oklab, ${i.color} 45%, var(--surface))`, color: 'var(--text)' }}>{i.title}</button>
            ))}
          </div>
        ))}
      </div>
      <DndContext sensors={sensors} onDragEnd={onEnd}>
        <div ref={scroller} className="relative max-h-[68vh] overflow-y-auto scroll-thin">
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)`, height: 24 * HOUR_PX }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="num absolute end-1.5 -translate-y-1/2 text-[10px] text-fg-3" style={{ top: h * HOUR_PX }}>{h ? fmtTime(`${String(h).padStart(2, '0')}:00`, locale, settings.timeFormat === '12') : ''}</div>)}
            </div>
            {days.map((d) => {
              const dayItems = items.filter((i) => i.date === d && !i.allDay && i.start);
              const pr = prayers.get(d);
              return (
                <div key={d} data-col className="relative border-s border-line"
                  onDoubleClick={(e) => { const y = e.clientY - (e.currentTarget.getBoundingClientRect().top); onCreate(d, fromMinutes(Math.floor((y / HOUR_PX) * 4) * 15)); }}
                  onClick={(e) => { if (e.target === e.currentTarget && window.matchMedia('(pointer: coarse)').matches) { const y = e.clientY - e.currentTarget.getBoundingClientRect().top; onCreate(d, fromMinutes(Math.floor((y / HOUR_PX) * 4) * 15)); } }}>
                  {Array.from({ length: 24 }, (_, h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/60" style={{ top: h * HOUR_PX }} />)}
                  {pr && (Object.keys(PRAYER_NAMES) as Array<keyof PrayerTimes>).filter((k) => k !== 'sunrise').map((k) => (
                    <div key={k} className="pointer-events-none absolute inset-x-0 flex items-center gap-1 border-t border-dashed border-reward/60 ps-1 text-[9.5px] font-bold text-reward" style={{ top: ((hm(pr[k]) ?? 0) / 60) * HOUR_PX }}>
                      {L(PRAYER_NAMES[k][0], PRAYER_NAMES[k][1])} {pr[k]}
                    </div>
                  ))}
                  {d === today && <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }} />}
                  {layout(dayItems).map(({ it, col, cols }) => <GridItem key={it.key} it={it} col={col} cols={cols} clash={clash.has(it.key)} onOpen={onOpen} />)}
                </div>
              );
            })}
          </div>
        </div>
      </DndContext>
      <p className="border-t border-line px-3 py-2 text-[11px] text-fg-3">{L('انقر مرتين على وقت فارغ لإضافة موعد · اسحب المواعيد والمهام لإعادة جدولتها', 'Double-click an empty slot to add · drag events and tasks to reschedule')}</p>
    </div>
  );
}

function layout(items: CalItem[]): Array<{ it: CalItem; col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => (hm(a.start) ?? 0) - (hm(b.start) ?? 0));
  const out: Array<{ it: CalItem; col: number; cols: number }> = [];
  let group: typeof out = [];
  let groupEnd = -1;
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.col + 1)); group.forEach((g) => (g.cols = n)); out.push(...group); group = []; };
  for (const it of sorted) {
    const s = hm(it.start) ?? 0;
    const e = hm(it.end) ?? s + 30;
    if (s >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => (hm(g.it.end) ?? (hm(g.it.start) ?? 0) + 30) > s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ it, col, cols: 1 });
    groupEnd = Math.max(groupEnd, e);
  }
  if (group.length) flush();
  return out;
}

function GridItem({ it, col, cols, clash, onOpen }: { it: CalItem; col: number; cols: number; clash: boolean; onOpen: (i: CalItem) => void }) {
  const { locale } = useI18n();
  const settings = useSettings();
  const draggable = it.kind === 'event' || it.kind === 'task';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: it.key, disabled: !draggable });
  const s = hm(it.start) ?? 0;
  const e = Math.max(s + 20, hm(it.end) ?? s + 30);
  return (
    <button
      ref={setNodeRef}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      onClick={() => onOpen(it)}
      className={clsx('absolute overflow-hidden rounded-[6px] border-s-[3px] px-1.5 py-0.5 text-start text-[11px] leading-tight transition-shadow', isDragging ? 'z-30 shadow-3' : 'z-20', it.done && 'opacity-55', clash && 'ring-2 ring-warning')}
      style={{
        top: (s / 60) * HOUR_PX + 1, height: ((e - s) / 60) * HOUR_PX - 2,
        insetInlineStart: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)`,
        background: `color-mix(in oklab, ${it.color} 42%, var(--surface))`, borderInlineStartColor: it.color,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
      title={it.title}
    >
      <div className={clsx('truncate font-bold', it.done && 'line-through')}>{it.title}</div>
      <div className="num truncate text-fg-2">{fmtTime(it.start, locale, settings.timeFormat === '12')}{it.end ? `–${fmtTime(it.end, locale, settings.timeFormat === '12')}` : ''}</div>
      {it.location && e - s >= 60 && <div className="truncate text-fg-3"><MapPin size={9} className="inline" /> {it.location}</div>}
    </button>
  );
}

function MonthView({ cursor, items, onPick, onOpen }: { cursor: string; items: CalItem[]; onPick: (d: string) => void; onOpen: (i: CalItem) => void }) {
  const { lang, locale } = useI18n();
  const settings = useSettings();
  const d0 = fromKey(cursor);
  const grid = monthGrid(d0.getFullYear(), d0.getMonth(), settings.weekStart);
  const today = todayKey();
  const by = new Map<string, CalItem[]>();
  for (const i of items) { if (!by.has(i.date)) by.set(i.date, []); by.get(i.date)!.push(i); }
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {grid.slice(0, 7).map((d) => <div key={d} className="py-2 text-center text-[11px] font-bold text-fg-3">{fmtDate(d, locale, { weekday: 'short' })}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const inMonth = fromKey(d).getMonth() === d0.getMonth();
          const list = by.get(d) ?? [];
          return (
            <div key={d} className={clsx('min-h-24 border-b border-e border-line p-1', !inMonth && 'bg-surface-2/50')}>
              <button onClick={() => onPick(d)} className={clsx('mb-0.5 flex w-full items-baseline gap-1 rounded-[4px] px-1 text-start hover:bg-surface-2', !inMonth && 'opacity-50')}>
                <span className={clsx('num text-[13px] font-black', d === today && 'grid size-6 place-items-center rounded-full bg-accent text-on-accent')}>{fromKey(d).getDate()}</span>
                {settings.calendarDisplay !== 'gregorian' && <span className="text-[9.5px] text-fg-3">{hijri(d, lang, { day: 'numeric' })}</span>}
              </button>
              {specialDay(d, lang) && <div className="truncate px-1 text-[9.5px] font-bold text-reward">{specialDay(d, lang)}</div>}
              {list.slice(0, 3).map((i) => (
                <button key={i.key} onClick={() => onOpen(i)} className={clsx('mb-0.5 flex w-full items-center gap-1 truncate rounded-[4px] px-1 text-start text-[11px] hover:bg-surface-2', i.done && 'line-through opacity-55')}>
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: i.color }} />
                  <span className="truncate">{i.title}</span>
                </button>
              ))}
              {list.length > 3 && <button onClick={() => onPick(d)} className="px-1 text-[10px] text-fg-3">+{list.length - 3}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ items, onOpen, clash }: { items: CalItem[]; onOpen: (i: CalItem) => void; clash: Set<string> }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  if (!items.length) return <EmptyState title={L('لا شيء في الثلاثين يوماً القادمة', 'Nothing in the next 30 days')} hint={L('أضف موعداً أو استورد تقويماً (ICS).', 'Add an event or import a calendar (ICS).')} />;
  const days = [...new Set(items.map((i) => i.date))];
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d}>
          <h2 className="mb-1.5 text-[13px] font-bold text-fg-2">{fmtDate(d, locale)}{settings.calendarDisplay !== 'gregorian' && <span className="ms-2 font-normal text-fg-3">{hijri(d, lang, { day: 'numeric', month: 'long' })}</span>}</h2>
          <div className="card divide-y divide-line">
            {items.filter((i) => i.date === d).map((i) => (
              <button key={i.key} onClick={() => onOpen(i)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: i.color }} />
                <span className="num w-24 shrink-0 text-[12px] text-fg-2">{i.allDay ? L('طوال اليوم', 'All day') : `${fmtTime(i.start, locale, settings.timeFormat === '12')}${i.end ? `–${fmtTime(i.end, locale, settings.timeFormat === '12')}` : ''}`}</span>
                <span className={clsx('min-w-0 flex-1 truncate text-sm font-bold', i.done && 'text-fg-3 line-through')}>{i.title}</span>
                {clash.has(i.key) && <AlertTriangle size={14} className="text-warning" aria-label={L('تعارض', 'Conflict')} />}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
