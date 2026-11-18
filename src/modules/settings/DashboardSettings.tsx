import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { Button, Card, Chip, PageHeader, Segmented } from '@/design/ui';
import { DASH_PRESETS, DEVICE_DEFAULTS, WIDGETS, deviceKind, saveLayout, useLayout, type Device, type LayoutItem, type WSize } from '@/modules/life/overview/layout';
import { toast } from '@/core/toast';

function Row({ item, onChange }: { item: LayoutItem; onChange: (i: LayoutItem) => void }) {
  const { L } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const def = WIDGETS.find((w) => w.id === item.id)!;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx('flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 last:border-0', isDragging && 'relative z-10 shadow-3', item.hidden && 'opacity-55')}>
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-fg-3" aria-label={L('اسحب لإعادة الترتيب', 'Drag to reorder')}><GripVertical size={18} /></button>
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{L(def.ar, def.en)} <span className="text-[11px] font-normal text-fg-3">· {L('طبقة', 'layer')} {def.layer}</span></span>
      <Segmented size="sm" value={item.size} onChange={(v) => onChange({ ...item, size: v as WSize })} options={[{ value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L' }, { value: 'xl', label: 'XL' }]} />
      <button onClick={() => onChange({ ...item, hidden: !item.hidden })} aria-label={item.hidden ? L('إظهار', 'Show') : L('إخفاء', 'Hide')} className="text-fg-2 hover:text-fg">{item.hidden ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </li>
  );
}

export default function DashboardSettings() {
  const { L } = useI18n();
  const [kind, setKind] = useState<Device>(deviceKind());
  const layout = useLayout(kind);
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [preset, setPreset] = useState('device');
  useEffect(() => { if (layout) { setItems(layout.items); setPreset(layout.preset); } }, [layout]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const persist = async (next: LayoutItem[], p = 'custom') => { setItems(next); setPreset(p); await saveLayout(kind, { items: next, preset: p }); };
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const a = items.findIndex((i) => i.id === e.active.id);
    const b = items.findIndex((i) => i.id === e.over!.id);
    void persist(arrayMove(items, a, b));
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('لوحة التحكم', 'Dashboard')} subtitle={L('رتّب وأخفِ وغيّر حجم ودجات الصفحة الرئيسية. يُحفظ لكل نوع جهاز.', 'Reorder, hide and resize overview widgets. Saved per device type.')} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'm', label: L('الجوال', 'Phone') }, { value: 't', label: L('التابلت', 'Tablet') }, { value: 'd', label: L('الكمبيوتر', 'Desktop') }]} />
      </div>
      <div className="mb-4">
        <div className="mb-1.5 text-[13px] font-bold text-fg-2">{L('قوالب جاهزة', 'Presets')}</div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={preset === 'device'} onClick={async () => { await persist(DEVICE_DEFAULTS[kind], 'device'); toast(L('طُبّق القالب', 'Preset applied')); }}>{L('المقترح لهذا الجهاز', 'Recommended for this device')}</Chip>
          {Object.entries(DASH_PRESETS).map(([id, p]) => (
            <Chip key={id} active={preset === id} onClick={async () => { await persist(p.items, id); toast(L('طُبّق القالب', 'Preset applied')); }}>{L(p.ar, p.en)}</Chip>
          ))}
          {preset === 'custom' && <Chip active>{L('مخصص', 'Custom')}</Chip>}
        </div>
      </div>
      <Card className="overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul>{items.map((it) => <Row key={it.id} item={it} onChange={(n) => void persist(items.map((x) => (x.id === n.id ? n : x)))} />)}</ul>
          </SortableContext>
        </DndContext>
      </Card>
      <Button variant="ghost" className="mt-3" onClick={() => persist(DEVICE_DEFAULTS[kind], 'device')}>{L('استعادة الافتراضي', 'Reset to default')}</Button>
    </div>
  );
}
