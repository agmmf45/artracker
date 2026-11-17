import { FileCheck2, Check } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { todayKey, relativeDay } from '@/core/dates';
import { update } from '@/core/repo';
import { useSettings } from '@/core/hooks';
import { grantXp, revokeXp } from '@/core/xp';
import { IconButton } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';
import { useCourses } from './shared';

/** Assignments: one record each; due date drives the calendar and Overview deadlines. */
export default function Assignments() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const courses = useCourses();
  const today = todayKey();
  const config: EntityConfig = {
    type: 'assignment', ar: 'الواجبات', en: 'Assignments', icon: <FileCheck2 size={30} />,
    subAr: 'تظهر مواعيدها في التقويم تلقائياً.', subEn: 'Due dates appear in the calendar automatically.',
    titleKey: 'title', dateKey: 'due', statusKey: 'state', groupBy: 'course_id', filterKey: 'state',
    emptyAr: 'لا واجبات — استمتع بالوقت.', emptyEn: 'No assignments — enjoy the time.',
    defaults: { state: 'todo', max: 100 },
    fields: [
      { key: 'title', ar: 'العنوان', en: 'Title', type: 'text', required: true, full: true },
      { key: 'course_id', ar: 'المقرر', en: 'Course', type: 'select', options: courses.map((c) => ({ value: c.id, ar: c.data.code || c.data.name, en: c.data.code || c.data.name })) },
      { key: 'state', ar: 'الحالة', en: 'Status', type: 'select', options: [{ value: 'todo', ar: 'لم يُسلّم', en: 'To do' }, { value: 'doing', ar: 'قيد العمل', en: 'In progress' }, { value: 'done', ar: 'سُلّم', en: 'Submitted' }] },
      { key: 'due', ar: 'موعد التسليم', en: 'Due date', type: 'date', required: true },
      { key: 'due_time', ar: 'الوقت', en: 'Time', type: 'time' },
      { key: 'weight', ar: 'الوزن %', en: 'Weight %', type: 'number' },
      { key: 'score', ar: 'الدرجة', en: 'Score', type: 'number' },
      { key: 'max', ar: 'من', en: 'Out of', type: 'number' },
      { key: 'link', ar: 'رابط', en: 'Link', type: 'url' },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    sort: (a, b) => Number(a.status === 'done') - Number(b.status === 'done') || String(a.date ?? '').localeCompare(String(b.date ?? '')),
    meta: (r) => {
      const due = String(r.data.due ?? '');
      const late = r.status !== 'done' && due && due < today;
      return <span className={late ? 'font-bold text-danger' : ''}>{due ? relativeDay(due, lang, locale) : ''}{r.data.due_time ? ` · ${r.data.due_time}` : ''}{r.data.score != null ? ` · ${r.data.score}/${r.data.max}` : ''}</span>;
    },
    badge: (r) => r.status === 'done' ? <span className="text-[11px] font-bold text-success">✓ {L('سُلّم', 'Submitted')}</span> : null,
    extraActions: (r: Rec) => (
      <IconButton size="sm" label={r.status === 'done' ? L('لم يُسلّم', 'Mark not submitted') : L('سُلّم', 'Mark submitted')} onClick={async () => {
        const done = r.status !== 'done';
        await update(r.id, { status: done ? 'done' : 'todo', data: { state: done ? 'done' : 'todo' } });
        if (done) await grantXp(`assignment:${r.id}`, 'task_important', settings, String(r.data.title)); else await revokeXp(`assignment:${r.id}`);
      }} className={r.status === 'done' ? 'text-success' : ''}><Check size={17} /></IconButton>
    ),
  };
  return <EntityPage config={config} />;
}
