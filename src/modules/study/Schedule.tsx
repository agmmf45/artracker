import { useNavigate } from 'react-router';
import { CalendarRange } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { fmtTime, hm } from '@/core/dates';
import { Button, Card, EmptyState, PageHeader } from '@/design/ui';
import { useCourses } from './shared';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PX = 52;

/** Weekly timetable built from each course's sessions (same data the calendar shows). */
export default function Schedule() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const courses = useCourses();
  const sessions = courses.flatMap((c) => c.data.schedule.map((s, i) => ({ ...s, c, key: `${c.id}:${i}` })));
  if (!sessions.length) return <div><PageHeader title={L('الجدول الدراسي', 'Timetable')} /><EmptyState icon={<CalendarRange size={30} />} title={L('لا مواعيد أسبوعية بعد', 'No weekly sessions yet')} hint={L('أضف مواعيد المحاضرات والمعامل والسريري من صفحة المقرر.', 'Add lecture, lab and clinical sessions from each course.')} action={<Button variant="primary" onClick={() => nav('/study/courses')}>{L('المقررات', 'Courses')}</Button>} /></div>;
  const order = Array.from({ length: 7 }, (_, i) => (settings.weekStart + i) % 7).filter((d) => sessions.some((s) => s.day === d) || d !== 5);
  const min = Math.min(...sessions.map((s) => hm(s.start) ?? 480));
  const max = Math.max(...sessions.map((s) => hm(s.end) ?? 960));
  const h0 = Math.floor(min / 60);
  const h1 = Math.ceil(max / 60);
  const now = new Date();
  return (
    <div>
      <PageHeader title={L('الجدول الدراسي', 'Timetable')} subtitle={L(`${sessions.length} موعد أسبوعي في ${courses.length} مقرر`, `${sessions.length} weekly sessions across ${courses.length} courses`)} />
      <Card className="overflow-x-auto p-3 scroll-thin">
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `48px repeat(${order.length}, 1fr)` }}>
          <div />
          {order.map((d) => <div key={d} className={`pb-2 text-center text-[12px] font-bold ${d === now.getDay() ? 'text-study' : 'text-fg-3'}`}>{(lang === 'ar' ? DAYS_AR : DAYS_EN)[d]}</div>)}
          <div className="relative" style={{ height: (h1 - h0) * PX }}>
            {Array.from({ length: h1 - h0 }, (_, i) => <div key={i} className="num absolute end-1 text-[10px] text-fg-3" style={{ top: i * PX - 6 }}>{fmtTime(`${String(h0 + i).padStart(2, '0')}:00`, locale, settings.timeFormat === '12')}</div>)}
          </div>
          {order.map((d) => (
            <div key={d} className="relative border-s border-line" style={{ height: (h1 - h0) * PX }}>
              {Array.from({ length: h1 - h0 }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-line/60" style={{ top: i * PX }} />)}
              {sessions.filter((s) => s.day === d).map((s) => {
                const top = (((hm(s.start) ?? 0) - h0 * 60) / 60) * PX;
                const h = Math.max(24, (((hm(s.end) ?? 0) - (hm(s.start) ?? 0)) / 60) * PX - 2);
                const col = s.c.data.color ?? 'var(--study)';
                return (
                  <button key={s.key} onClick={() => nav(`/study/courses?open=${s.c.id}`)} className="absolute inset-x-1 overflow-hidden rounded-[6px] border-s-[3px] px-1.5 py-1 text-start text-[11px] leading-tight"
                    style={{ top, height: h, background: `color-mix(in oklab, ${col} 20%, var(--surface))`, borderInlineStartColor: col }}>
                    <div className="truncate font-bold">{s.c.data.code || s.c.data.name}</div>
                    <div className="num truncate text-fg-2">{s.start}–{s.end}</div>
                    {s.room && <div className="truncate text-fg-3">{s.room}{s.kind && s.kind !== 'lecture' ? ` · ${s.kind === 'lab' ? L('معمل', 'Lab') : L('سريري', 'Clinical')}` : ''}</div>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
