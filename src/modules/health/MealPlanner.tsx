import { useMemo, useState } from 'react';
import { ShoppingCart, Plus, X, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecordsInRange, useSettings } from '@/core/hooks';
import { create, update } from '@/core/repo';
import { fmtDate, rangeKeys, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { Button, Card, IconButton, PageHeader } from '@/design/ui';

interface PlanData { breakfast: string; lunch: string; dinner: string; snack: string; grocery: Array<{ text: string; done: boolean }> }
const SLOTS: Array<[keyof Omit<PlanData, 'grocery'>, string, string]> = [['breakfast', 'فطور', 'Breakfast'], ['lunch', 'غداء', 'Lunch'], ['dinner', 'عشاء', 'Dinner'], ['snack', 'سناك', 'Snack']];

/** Weekly meal plan (one record per day) + a grocery list aggregated from the week. */
export default function MealPlanner() {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const [ws, setWs] = useState(weekStartKey(todayKey(), settings.weekStart));
  const days = rangeKeys(ws, 7);
  const plans = useRecordsInRange<PlanData>('meal_plan', days[0], days[6]);
  const byDay = useMemo(() => new Map((plans ?? []).map((p) => [p.date!, p as Rec<PlanData>])), [plans]);
  const [item, setItem] = useState('');

  const setSlot = async (d: string, k: keyof PlanData, v: unknown) => {
    const p = byDay.get(d);
    if (p) await update<PlanData>(p.id, { data: { [k]: v } as Partial<PlanData> });
    else await create<PlanData>('meal_plan', { breakfast: '', lunch: '', dinner: '', snack: '', grocery: [], [k]: v } as PlanData, { id: `mp:${d}`, date: d });
  };
  const grocery = days.flatMap((d) => (byDay.get(d)?.data.grocery ?? []).map((g, i) => ({ d, i, ...g })));

  return (
    <div>
      <PageHeader title={L('تخطيط الوجبات', 'Meal planner')} actions={<><Button size="sm" variant="ghost" onClick={() => setWs(shiftKey(ws, -7))}>‹</Button><span className="text-sm font-bold">{fmtDate(days[0], locale, { day: 'numeric', month: 'short' })} – {fmtDate(days[6], locale, { day: 'numeric', month: 'short' })}</span><Button size="sm" variant="ghost" onClick={() => setWs(shiftKey(ws, 7))}>›</Button></>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => (
            <Card key={d} className={clsx('p-3', d === todayKey() && 'ring-2 ring-health')}>
              <div className="mb-2 text-[13px] font-bold">{fmtDate(d, locale, { weekday: 'long', day: 'numeric' })}</div>
              {SLOTS.map(([k, ar, en]) => (
                <label key={k} className="mb-1.5 block">
                  <span className="text-[11px] font-bold text-fg-3">{L(ar, en)}</span>
                  <input className="field h-9 min-h-0 py-1 text-sm" defaultValue={byDay.get(d)?.data[k] ?? ''} key={`${d}${k}${byDay.get(d)?.updated_at ?? ''}`} onBlur={(e) => { if (e.target.value !== (byDay.get(d)?.data[k] ?? '')) void setSlot(d, k, e.target.value); }} />
                </label>
              ))}
            </Card>
          ))}
        </div>
        <Card className="h-fit p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><ShoppingCart size={15} />{L('قائمة المشتريات', 'Grocery list')}</div>
          <form className="mb-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!item.trim()) return; const d = days.includes(todayKey()) ? todayKey() : days[0]; await setSlot(d, 'grocery', [...(byDay.get(d)?.data.grocery ?? []), { text: item.trim(), done: false }]); setItem(''); }}>
            <input className="field h-9 min-h-0 py-1" value={item} onChange={(e) => setItem(e.target.value)} placeholder={L('أضف غرضاً', 'Add an item')} />
            <IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={17} /></IconButton>
          </form>
          <ul className="space-y-1">{grocery.map((g) => (
            <li key={`${g.d}${g.i}`} className="flex items-center gap-2 text-sm">
              <button aria-label={g.done ? L('غير مشترى', 'Not bought') : L('اشتريته', 'Bought')} onClick={() => setSlot(g.d, 'grocery', byDay.get(g.d)!.data.grocery.map((x, j) => (j === g.i ? { ...x, done: !x.done } : x)))} className={clsx('grid size-5 place-items-center rounded-xs border', g.done ? 'border-health bg-health text-on-accent' : 'border-line-strong')}>{g.done && <Check size={12} />}</button>
              <span className={clsx('flex-1', g.done && 'text-fg-3 line-through')}>{g.text}</span>
              <button aria-label={L('حذف', 'Remove')} onClick={() => setSlot(g.d, 'grocery', byDay.get(g.d)!.data.grocery.filter((_, j) => j !== g.i))}><X size={13} /></button>
            </li>
          ))}</ul>
          {!grocery.length && <p className="text-sm text-fg-3">{L('القائمة فاضية', 'List is empty')}</p>}
        </Card>
      </div>
    </div>
  );
}
