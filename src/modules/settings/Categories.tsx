import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import type { LifeArea } from '@/core/settings';
import { Card, Chip, IconButton, Input, PageHeader, Section } from '@/design/ui';
import { newId } from '@/core/ids';

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState('');
  const { L } = useI18n();
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">{items.map((x) => <Chip key={x} onClick={() => onChange(items.filter((y) => y !== x))}>{x} <X size={11} /></Chip>)}</div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onChange([...new Set([...items, v.trim()])]); setV(''); } }}>
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
        <IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={18} /></IconButton>
      </form>
    </div>
  );
}

const PALETTE = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)'];

export default function Categories() {
  const { L } = useI18n();
  const s = useSettings();
  const [area, setArea] = useState({ name: '', icon: '✨' });
  const setAreas = (lifeAreas: LifeArea[]) => updateSettings({ lifeAreas });

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('التصنيفات ومجالات الحياة', 'Categories & life areas')} />
      <Section title={L('مجالات الحياة (لتوازن الحياة)', 'Life areas (for life balance)')}>
        <Card className="divide-y divide-line">
          {s.lifeAreas.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 px-3 py-2">
              <input className="field h-9 min-h-0 w-14 py-1 text-center" value={a.icon} aria-label={L('أيقونة', 'Icon')} onChange={(e) => setAreas(s.lifeAreas.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)))} />
              <input className="field h-9 min-h-0 flex-1 py-1" value={a.name} aria-label={L('الاسم', 'Name')} onChange={(e) => setAreas(s.lifeAreas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <button className="size-6 rounded-full border border-line" style={{ background: a.color }} aria-label={L('اللون', 'Colour')} onClick={() => setAreas(s.lifeAreas.map((x, j) => (j === i ? { ...x, color: PALETTE[(PALETTE.indexOf(x.color) + 1) % PALETTE.length] } : x)))} />
              <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => setAreas(s.lifeAreas.filter((_, j) => j !== i))}><X size={15} /></IconButton>
            </div>
          ))}
          <form className="flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (!area.name.trim()) return; setAreas([...s.lifeAreas, { id: newId('a'), name: area.name.trim(), icon: area.icon || '✨', color: PALETTE[s.lifeAreas.length % PALETTE.length] }]); setArea({ name: '', icon: '✨' }); }}>
            <input className="field w-14 text-center" value={area.icon} onChange={(e) => setArea({ ...area, icon: e.target.value })} aria-label={L('أيقونة', 'Icon')} />
            <Input className="flex-1" value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} placeholder={L('مثال: الروحانية، الهوايات…', 'e.g. Spirituality, hobbies…')} />
            <IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={18} /></IconButton>
          </form>
        </Card>
      </Section>
      <Section title={L('تصنيفات المهام', 'Task categories')}><Card className="p-4"><ListEditor items={s.categories.tasks} onChange={(tasks) => updateSettings({ categories: { tasks } })} placeholder={L('تصنيف جديد', 'New category')} /></Card></Section>
      <Section title={L('تصنيفات المصاريف', 'Expense categories')}><Card className="p-4"><ListEditor items={s.categories.expenses} onChange={(expenses) => updateSettings({ categories: { expenses } })} placeholder={L('مثال: 🎁 هدايا', 'e.g. 🎁 Gifts')} /></Card></Section>
      <Section title={L('تصنيفات الملاحظات', 'Note categories')}><Card className="p-4"><ListEditor items={s.categories.notes} onChange={(notes) => updateSettings({ categories: { notes } })} placeholder={L('تصنيف جديد', 'New category')} /></Card></Section>
    </div>
  );
}
