import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Dialog } from 'radix-ui';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Droplets, Timer, Dumbbell, SunMoon, CalendarDays, Search, FileText, ListChecks, FolderKanban, Target, BookOpen, Presentation, CalendarClock, Wallet } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { toast } from '@/core/toast';
import { logWater } from '@/modules/shared/domain';
import { PAGES, isPageOn, SECTIONS } from './registry';

const SEARCH_TYPES: Record<string, { icon: typeof FileText; path: (id: string) => string; field: string }> = {
  task: { icon: ListChecks, path: (id) => `/life/tasks?open=${id}`, field: 'title' },
  note: { icon: FileText, path: (id) => `/life/notes?open=${id}`, field: 'title' },
  project: { icon: FolderKanban, path: (id) => `/life/projects?open=${id}`, field: 'title' },
  goal: { icon: Target, path: (id) => `/life/goals?open=${id}`, field: 'title' },
  course: { icon: BookOpen, path: (id) => `/study/courses?open=${id}`, field: 'name' },
  lecture: { icon: Presentation, path: (id) => `/study/lectures?open=${id}`, field: 'title' },
  exam: { icon: CalendarClock, path: (id) => `/study/exams?open=${id}`, field: 'title' },
  event: { icon: CalendarDays, path: (id) => `/life/calendar?open=${id}`, field: 'title' },
};

export function CommandPalette({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (v: boolean) => void; onCapture: () => void }) {
  const { L, dir } = useI18n();
  const nav = useNavigate();
  const settings = useSettings();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => { if (open) setQ(''); }, [open]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 120); return () => clearTimeout(t); }, [q]);

  // Searches only non-private records the user owns locally; journal/health/finance stay out of results.
  const results = useLiveQuery(async () => {
    if (debounced.length < 2) return [];
    const out: Array<{ id: string; type: string; title: string; sub: string }> = [];
    await db().records.filter((r) => !r.deleted_at && !r.private && r.type in SEARCH_TYPES).until(() => out.length >= 30).each((r) => {
      const d = r.data as Record<string, unknown>;
      const title = String(d[SEARCH_TYPES[r.type].field] ?? d.title ?? '');
      const body = r.type === 'note' ? String(d.body ?? '') : String(d.notes ?? '');
      const hay = `${title} ${body}`.toLowerCase();
      if (hay.includes(debounced)) {
        const i = body.toLowerCase().indexOf(debounced);
        out.push({ id: r.id, type: r.type, title: title || L('بدون عنوان', 'Untitled'), sub: i >= 0 ? body.slice(Math.max(0, i - 20), i + 60) : '' });
      }
    });
    return out;
  }, [debounced]);

  const go = (path: string) => { onOpenChange(false); nav(path); };
  const pages = useMemo(() => PAGES.filter((p) => isPageOn(p, settings.modules, settings.modulePreset)), [settings.modules, settings.modulePreset]);

  const commands = [
    { id: 'new', label: L('إضافة سريعة (مهمة، فكرة، مصروف…)', 'Quick capture (task, idea, expense…)'), icon: Plus, run: onCapture, kw: 'new create task add مهمة اضافة' },
    { id: 'note', label: L('ملاحظة جديدة', 'New note'), icon: FileText, run: () => go('/life/notes?new=1'), kw: 'note ملاحظة' },
    { id: 'water', label: L('سجّل كوب ماء (250 مل)', 'Log a glass of water (250 ml)'), icon: Droplets, run: async () => { await logWater(250); toast(L('+250 مل', '+250 ml')); onOpenChange(false); }, kw: 'water ماء' },
    { id: 'expense', label: L('سجّل مصروف', 'Log expense'), icon: Wallet, run: onCapture, kw: 'expense مصروف صرف' },
    { id: 'timer', label: L('ابدأ جلسة تركيز', 'Start focus timer'), icon: Timer, run: () => go('/study/focus?start=1'), kw: 'timer pomodoro focus تركيز مؤقت' },
    { id: 'workout', label: L('ابدأ تمرين', 'Start workout'), icon: Dumbbell, run: () => go('/health/workouts?start=1'), kw: 'workout gym تمرين' },
    { id: 'today', label: L('جدول اليوم', "Today's schedule"), icon: CalendarDays, run: () => go('/life/today'), kw: 'today اليوم' },
    { id: 'week', label: L('خطط أسبوعك', 'Plan your week'), icon: CalendarClock, run: () => go('/life/week'), kw: 'week planner اسبوع' },
    { id: 'tour', label: L('الجولة التعريفية', 'Guided tour'), icon: CalendarDays, run: async () => { onOpenChange(false); await updateSettings({ tourPending: true }); }, kw: 'tour help guide جولة مساعدة شرح' },
    { id: 'kb', label: L('ابحث في العقل الثاني', 'Search knowledge base'), icon: Search, run: () => go('/life/brain'), kw: 'brain knowledge معرفة' },
    {
      id: 'theme', label: L('بدّل الوضع الفاتح/الداكن', 'Toggle light/dark'), icon: SunMoon,
      run: async () => {
        const isDark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        await updateSettings({ theme: isDark ? 'light' : 'dark' });
        onOpenChange(false);
      }, kw: 'theme dark light ثيم داكن',
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content dir={dir} className="anim-in fixed left-1/2 top-[10vh] z-[61] w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-elevated shadow-3">
          <Dialog.Title className="sr-only">{L('بحث وأوامر', 'Search and commands')}</Dialog.Title>
          <Dialog.Description className="sr-only">{L('ابحث في سجلاتك أو نفّذ أمراً', 'Search your records or run a command')}</Dialog.Description>
          <Command label={L('بحث وأوامر', 'Search and commands')} shouldFilter loop className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-fg-3">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={18} className="text-fg-3" />
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder={L('ابحث أو اكتب أمراً…', 'Search or type a command…')} className="h-13 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-fg-3" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2 scroll-thin">
              <Command.Empty className="px-3 py-6 text-center text-sm text-fg-3">{L('لا نتائج', 'No results')}</Command.Empty>
              {!!results?.length && (
                <Command.Group heading={L('نتائج', 'Results')}>
                  {results.map((r) => {
                    const Icon = SEARCH_TYPES[r.type].icon;
                    return (
                      <Command.Item key={r.id} value={`${r.title} ${r.sub} ${r.id}`} onSelect={() => go(SEARCH_TYPES[r.type].path(r.id))} className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 data-[selected=true]:bg-surface-2">
                        <Icon size={16} className="shrink-0 text-fg-3" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{r.title}</span>{r.sub && <span className="block truncate text-[12px] text-fg-3">{r.sub}</span>}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              <Command.Group heading={L('أوامر', 'Commands')}>
                {commands.map((c) => (
                  <Command.Item key={c.id} value={`${c.label} ${c.kw}`} onSelect={c.run} className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm data-[selected=true]:bg-surface-2">
                    <c.icon size={16} className="text-fg-3" /> {c.label}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading={L('انتقل إلى', 'Go to')}>
                {pages.map((p) => {
                  const s = SECTIONS.find((x) => x.id === p.section)!;
                  return (
                    <Command.Item key={p.id} value={`${L(p.ar, p.en)} ${p.en} ${p.ar} ${s.en}`} onSelect={() => go(p.path)} className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm data-[selected=true]:bg-surface-2">
                      <p.icon size={16} className="text-fg-3" /> {L(p.ar, p.en)} <span className="text-[12px] text-fg-3">· {L(s.ar, s.en)}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
