import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, EyeOff, GripVertical, LayoutGrid, Move, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { Button, Segmented } from '@/design/ui';
import { Menu } from '@/design/overlay';
import { useDashData, type Range } from './overview/data';
import { NEEDS_GAMIFICATION, SPAN, WIDGETS, saveLayout, useDevice, useLayout, type LayoutItem, type WSize } from './overview/layout';

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5 xl:grid-cols-12';

/** Sortable wrapper used in edit mode (tablet and desktop). */
function EditableCell({ item, onSize, onHide, children }: { item: LayoutItem; onSize: (s: WSize) => void; onHide: () => void; children: ReactNode }) {
  const { L } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={clsx('relative', SPAN[item.size], isDragging && 'z-20 opacity-90')}>
      <div className="pointer-events-none select-none rounded-lg outline-2 outline-offset-2 outline-dashed outline-[var(--accent-ink)]/40">{children}</div>
      <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-1.5 rounded-full border border-line bg-elevated/95 p-1 shadow-2 backdrop-blur">
        <button {...attributes} {...listeners} className="grid size-8 cursor-grab touch-none place-items-center rounded-full text-fg-2 hover:bg-surface-2 active:cursor-grabbing" aria-label={L('اسحب لإعادة الترتيب', 'Drag to reorder')}><GripVertical size={16} /></button>
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{L(WIDGETS.find((w) => w.id === item.id)!.ar, WIDGETS.find((w) => w.id === item.id)!.en)}</span>
        <Segmented size="sm" value={item.size} onChange={(v) => onSize(v as WSize)} options={[{ value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L' }, { value: 'xl', label: 'XL' }]} />
        <button onClick={onHide} className="grid size-8 place-items-center rounded-full text-fg-2 hover:bg-surface-2" aria-label={L('إخفاء الودجت', 'Hide widget')}><EyeOff size={15} /></button>
      </div>
    </div>
  );
}

/** Life › Overview — the personal command center. Each device class gets its own layout. */
export default function Overview() {
  const { L } = useI18n();
  const settings = useSettings();
  const [range, setRange] = useState<Range>('day');
  const data = useDashData(range, settings.weekStart);
  const device = useDevice();
  const layout = useLayout(device);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<LayoutItem[]>([]);
  useEffect(() => { if (layout) setItems(layout.items); }, [layout]);
  useEffect(() => { if (device === 'm') setEditing(false); }, [device]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (!data || !layout) {
    return (
      <div className={GRID} aria-busy="true">
        <div className="skeleton h-44 md:col-span-6 xl:col-span-12" />
        <div className="skeleton h-56 md:col-span-3 xl:col-span-4" />
        <div className="skeleton h-56 md:col-span-3 xl:col-span-4" />
        <div className="skeleton h-56 md:col-span-6 xl:col-span-4" />
      </div>
    );
  }

  const persist = (next: LayoutItem[]) => { setItems(next); void saveLayout(device, { items: next, preset: 'custom' }); };
  const enabled = (i: LayoutItem) => !(NEEDS_GAMIFICATION.has(i.id) && !settings.gamification.enabled);
  const visible = items.filter((i) => !i.hidden && enabled(i));
  const hidden = items.filter((i) => i.hidden && enabled(i));
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    persist(arrayMove(items, items.findIndex((i) => i.id === e.active.id), items.findIndex((i) => i.id === e.over!.id)));
  };
  const setItem = (id: string, p: Partial<LayoutItem>) => persist(items.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={range} onChange={setRange} size="sm" options={[
          { value: 'day', label: L('اليوم', 'Today') },
          { value: 'week', label: L('هذا الأسبوع', 'This week') },
          { value: 'month', label: L('هذا الشهر', 'This month') },
        ]} />
        <span className="flex-1" />
        {editing ? (
          <>
            {hidden.length > 0 && (
              <Menu trigger={<Button size="sm" icon={<Plus size={15} />}>{L('أضف ودجت', 'Add widget')}</Button>}
                items={hidden.map((h) => { const def = WIDGETS.find((w) => w.id === h.id)!; return { label: L(def.ar, def.en), onSelect: () => setItem(h.id, { hidden: false }) }; })} />
            )}
            <Button size="sm" variant="primary" icon={<Check size={15} />} onClick={() => setEditing(false)}>{L('تم', 'Done')}</Button>
          </>
        ) : (
          <>
            {device !== 'm' && <Button size="sm" variant="ghost" icon={<Move size={15} />} onClick={() => setEditing(true)}>{L('رتّب', 'Arrange')}</Button>}
            <Link to="/settings/dashboard" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-fg-2 hover:bg-surface-2 hover:text-fg">
              <LayoutGrid size={15} /> {L('تخصيص', 'Customize')}
            </Link>
          </>
        )}
      </div>

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={visible.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className={GRID}>
              {visible.map((item) => {
                const def = WIDGETS.find((w) => w.id === item.id);
                if (!def) return null;
                return (
                  <EditableCell key={item.id} item={item} onSize={(s) => setItem(item.id, { size: s })} onHide={() => setItem(item.id, { hidden: true })}>
                    <def.C d={data} range={range} />
                  </EditableCell>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className={GRID}>
          {visible.map((item, i) => {
            const def = WIDGETS.find((w) => w.id === item.id);
            if (!def) return null;
            return (
              <div key={item.id} className={`anim-in ${SPAN[item.size]}`} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <def.C d={data} range={range} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
