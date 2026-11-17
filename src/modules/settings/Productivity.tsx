import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { Card, Input, PageHeader, Section, Select, Switch } from '@/design/ui';

export default function Productivity() {
  const { L } = useI18n();
  const s = useSettings();
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('الإنتاجية', 'Productivity')} />
      <Section title={L('المهام', 'Tasks')}>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Select label={L('الأولوية الافتراضية', 'Default priority')} value={String(s.tasks.defaultPriority)} onChange={(e) => updateSettings({ tasks: { defaultPriority: Number(e.target.value) } })}>
            <option value="4">{L('عاجل', 'Urgent')}</option><option value="3">{L('مهم', 'High')}</option><option value="2">{L('عادي', 'Normal')}</option><option value="1">{L('منخفض', 'Low')}</option>
          </Select>
          <Select label={L('العرض الافتراضي', 'Default view')} value={s.tasks.defaultView} onChange={(e) => updateSettings({ tasks: { defaultView: e.target.value as 'list' } })}>
            <option value="list">{L('قائمة', 'List')}</option><option value="kanban">{L('لوحة', 'Board')}</option><option value="calendar">{L('تقويم', 'Calendar')}</option><option value="timeline">{L('خط زمني', 'Timeline')}</option><option value="matrix">{L('أيزنهاور', 'Eisenhower')}</option>
          </Select>
          <div className="sm:col-span-2"><Switch checked={s.tasks.showCompletedInToday} onChange={(v) => updateSettings({ tasks: { showCompletedInToday: v } })} label={L('أظهر المنجز في صفحة اليوم', 'Show completed in Today')} /></div>
        </Card>
      </Section>
      <Section title={L('التقويم', 'Calendar')}>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Select label={L('العرض الافتراضي', 'Default view')} value={s.calendar.defaultView} onChange={(e) => updateSettings({ calendar: { defaultView: e.target.value as 'week' } })}>
            <option value="day">{L('يوم', 'Day')}</option><option value="week">{L('أسبوع', 'Week')}</option><option value="month">{L('شهر', 'Month')}</option><option value="agenda">{L('أجندة', 'Agenda')}</option>
          </Select>
          <div className="sm:col-span-2">
            <Switch checked={s.calendar.showTasks} onChange={(v) => updateSettings({ calendar: { showTasks: v } })} label={L('أظهر المهام المجدولة في التقويم', 'Show scheduled tasks in calendar')} />
            <Switch checked={s.calendar.showHealth} onChange={(v) => updateSettings({ calendar: { showHealth: v } })} label={L('أظهر التمارين والأدوية في التقويم', 'Show workouts & medication in calendar')} hint={L('مخفية افتراضياً لحماية الخصوصية.', 'Hidden by default for privacy.')} />
          </div>
        </Card>
      </Section>
      <Section title={L('مؤقت التركيز', 'Focus timer')}>
        <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Input type="number" min={5} max={180} label={L('تركيز (د)', 'Focus (min)')} value={s.focus.work} onChange={(e) => updateSettings({ focus: { work: Number(e.target.value) || 25 } })} />
          <Input type="number" min={1} max={60} label={L('استراحة (د)', 'Break (min)')} value={s.focus.short} onChange={(e) => updateSettings({ focus: { short: Number(e.target.value) || 5 } })} />
          <Input type="number" min={5} max={90} label={L('استراحة طويلة', 'Long break')} value={s.focus.long} onChange={(e) => updateSettings({ focus: { long: Number(e.target.value) || 15 } })} />
          <Input type="number" min={2} max={10} label={L('كل كم جلسة', 'Every N sessions')} value={s.focus.longEvery} onChange={(e) => updateSettings({ focus: { longEvery: Number(e.target.value) || 4 } })} />
          <div className="col-span-full"><Switch checked={s.focus.sound} onChange={(v) => updateSettings({ focus: { sound: v } })} label={L('صوت عند انتهاء الجلسة', 'Sound when a session ends')} /></div>
        </Card>
      </Section>
      <Section title={L('الدراسة', 'Study')}>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Input type="number" min={0} step={15} label={L('هدف المذاكرة اليومي (د)', 'Daily study goal (min)')} value={s.study.dailyStudyGoalMin} onChange={(e) => updateSettings({ study: { dailyStudyGoalMin: Number(e.target.value) || 0 } })} />
          <Select label={L('مقياس المعدل', 'GPA scale')} value={String(s.study.gpaScale)} onChange={(e) => updateSettings({ study: { gpaScale: Number(e.target.value) } })}>
            <option value="5">5.0</option><option value="4">4.0</option><option value="100">100</option>
          </Select>
          <div className="sm:col-span-2"><Switch checked={s.study.dental} onChange={(v) => updateSettings({ study: { dental: v } })} label={L('قوالب طب الأسنان السريرية', 'Dental clinical templates')} /></div>
        </Card>
      </Section>
      <Section title={L('الصحة', 'Health')}>
        <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          <Input type="number" label={L('هدف السعرات', 'Calorie goal')} min={1200} value={s.health.calorieGoal} onChange={(e) => updateSettings({ health: { calorieGoal: Math.max(1200, Number(e.target.value) || 2000) } })} hint={L('(الحد الأدنى 1200)', '(min 1200)')} />
          <Input type="number" label={L('بروتين (جم)', 'Protein (g)')} value={s.health.proteinGoal ?? ''} onChange={(e) => updateSettings({ health: { proteinGoal: e.target.value ? Number(e.target.value) : null } })} />
          <Input type="number" label={L('هدف الماء (مل)', 'Water goal (ml)')} step={250} value={s.health.waterGoal} onChange={(e) => updateSettings({ health: { waterGoal: Number(e.target.value) || 2000 } })} />
          <Input type="number" label={L('هدف النوم (س)', 'Sleep goal (h)')} step={0.5} value={s.health.sleepGoalHours} onChange={(e) => updateSettings({ health: { sleepGoalHours: Number(e.target.value) || 8 } })} />
          <Input type="number" label={L('الطول (سم)', 'Height (cm)')} value={s.health.heightCm ?? ''} onChange={(e) => updateSettings({ health: { heightCm: e.target.value ? Number(e.target.value) : null } })} />
          <Input label={L('أحجام الماء (مل)', 'Water servings (ml)')} value={s.health.waterServings.join(', ')} onChange={(e) => updateSettings({ health: { waterServings: e.target.value.split(/[,،\s]+/).map(Number).filter((n) => n > 0).slice(0, 6) } })} />
        </Card>
      </Section>
    </div>
  );
}
