import { useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { fmtDuration, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import { Card, CardHeader, Stat } from '@/design/ui';
import { Bars, Donut, Heatmap, Legend } from '@/design/charts';
import { LECTURE_STATES, type LectureData, type StudySessionData } from './model';
import { courseLabel, useCourses } from './shared';

const VIZ = ['var(--viz-2)', 'var(--viz-1)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)', 'var(--text-3)'];

/** Academic analytics — every number is a sum or ratio of logged records. */
export default function Analytics() {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const today = todayKey();
  const sessions = useRecordsInRange<StudySessionData>('study_session', shiftKey(today, -180), today);
  const lectures = useRecords<LectureData>('lecture');
  const attempts = useRecords<{ correct: boolean }>('question_attempt');
  const reviews = useRecordsInRange<{ rating: number }>('card_review', shiftKey(today, -29), today);
  const courses = useCourses();

  const s = useMemo(() => {
    const byDay: Record<string, number> = {};
    const byCourse = new Map<string, number>();
    for (const x of sessions ?? []) { byDay[x.date!] = (byDay[x.date!] ?? 0) + x.data.duration_min; byCourse.set(x.data.course_id ?? '', (byCourse.get(x.data.course_id ?? '') ?? 0) + x.data.duration_min); }
    const last30 = rangeKeys(shiftKey(today, -29), 30);
    const total30 = last30.reduce((a, d) => a + (byDay[d] ?? 0), 0);
    const goalDays = last30.filter((d) => (byDay[d] ?? 0) >= settings.study.dailyStudyGoalMin).length;
    const acc = attempts?.length ? attempts.filter((a) => a.data.correct).length / attempts.length : null;
    const recall = reviews?.length ? reviews.filter((r) => r.data.rating > 1).length / reviews.length : null;
    return { byDay, byCourse, last30, total30, goalDays, acc, recall };
  }, [sessions, attempts, reviews, today, settings.study.dailyStudyGoalMin]);

  const states = LECTURE_STATES.map(([k, ar, en, col]) => ({ label: L(ar, en), color: col, value: (lectures ?? []).filter((l) => (l.status ?? 'not_started') === k).length }));
  const courseParts = [...s.byCourse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([cid, m], i) => ({ label: courseLabel(courses.find((c) => c.id === cid)) || L('عام', 'General'), value: m, color: VIZ[i] }));

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black">{L('التحليلات الأكاديمية', 'Academic analytics')}</h1>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={L('مذاكرة 30 يوم', 'Studied, 30 days')} value={fmtDuration(s.total30, lang)} sub={`${L('متوسط', 'avg')} ${fmtDuration(Math.round(s.total30 / 30), lang)}/${L('يوم', 'day')}`} /></Card>
        <Card className="p-4"><Stat label={L('أيام حققت الهدف', 'Days at goal')} value={`${s.goalDays}/30`} /></Card>
        <Card className="p-4"><Stat label={L('دقة بنك الأسئلة', 'Question accuracy')} value={s.acc == null ? '—' : `${Math.round(s.acc * 100)}%`} sub={`${attempts?.length ?? 0} ${L('محاولة', 'attempts')}`} /></Card>
        <Card className="p-4"><Stat label={L('تذكر البطاقات', 'Flashcard recall')} value={s.recall == null ? '—' : `${Math.round(s.recall * 100)}%`} sub={L('30 يوم', '30 days')} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><CardHeader title={L('دقائق المذاكرة — 30 يوم', 'Study minutes — 30 days')} /><Bars data={s.last30.map((d) => ({ label: d.slice(8), value: s.byDay[d] ?? 0 }))} height={120} color="var(--study)" goal={settings.study.dailyStudyGoalMin} /></Card>
        <Card className="p-4"><CardHeader title={L('حسب المقرر (6 أشهر)', 'By course (6 months)')} />
          {!courseParts.length ? <p className="text-sm text-fg-3">—</p> : <div className="flex items-center gap-4"><Donut parts={courseParts} size={120} /><div className="min-w-0 flex-1"><Legend items={courseParts.map((p) => ({ ...p, value: fmtDuration(p.value, lang) }))} /></div></div>}
        </Card>
        <Card className="p-4"><CardHeader title={L('حالة المحاضرات', 'Lecture states')} />
          {!(lectures ?? []).length ? <p className="text-sm text-fg-3">—</p> : <div className="flex items-center gap-4"><Donut parts={states} size={120} /><div className="min-w-0 flex-1"><Legend items={states.map((x) => ({ ...x, value: String(x.value) }))} /></div></div>}
        </Card>
        <Card className="p-4"><CardHeader title={L('خريطة المذاكرة', 'Study heatmap')} /><Heatmap values={s.byDay} weeks={24} weekStart={settings.weekStart} label={L('دقائق المذاكرة يومياً', 'Daily study minutes')} /></Card>
      </div>
    </div>
  );
}
