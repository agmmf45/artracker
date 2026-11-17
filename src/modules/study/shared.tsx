import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { Select } from '@/design/ui';
import type { CourseData } from './model';

export function useCourses() {
  const cs = useRecords<CourseData>('course');
  return (cs ?? []).filter((c) => !c.data.archived).sort((a, b) => (a.data.code || a.data.name).localeCompare(b.data.code || b.data.name));
}

export function CourseSelect({ value, onChange, label, all, className }: { value: string | null; onChange: (v: string | null) => void; label?: string; all?: boolean; className?: string }) {
  const { L } = useI18n();
  const courses = useCourses();
  return (
    <Select className={className} label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label ?? L('المقرر', 'Course')}>
      <option value="">{all ? L('كل المقررات', 'All courses') : '—'}</option>
      {courses.map((c) => <option key={c.id} value={c.id}>{c.data.code ? `${c.data.code} · ` : ''}{c.data.name}</option>)}
    </Select>
  );
}

export function courseLabel(c?: { data: CourseData } | null) {
  if (!c) return '';
  return c.data.code ? `${c.data.code} · ${c.data.name}` : c.data.name;
}

export const COURSE_COLORS = ['#799FCB', '#A69BCB', '#83B89C', '#D5B178', '#E08571', '#7FB9BF', '#C99AC0', '#9AA7B8'];
