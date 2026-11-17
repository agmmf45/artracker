import { useState } from 'react';
import { Link } from 'react-router';
import { LayoutGrid } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { Segmented } from '@/design/ui';
import { useDashData, type Range } from './overview/data';
import { SPAN, WIDGETS, deviceKind, useLayout } from './overview/layout';

/** Life › Overview — the personal command center (5 layers, customizable bento grid). */
export default function Overview() {
  const { L } = useI18n();
  const settings = useSettings();
  const [range, setRange] = useState<Range>('day');
  const data = useDashData(range, settings.weekStart);
  const layout = useLayout(deviceKind());

  if (!data || !layout) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12" aria-busy="true">
        <div className="skeleton h-44 md:col-span-6 lg:col-span-12" />
        <div className="skeleton h-36 md:col-span-6 lg:col-span-12" />
        <div className="skeleton h-56 md:col-span-3 lg:col-span-6" />
        <div className="skeleton h-56 md:col-span-3 lg:col-span-6" />
      </div>
    );
  }

  const visible = layout.items.filter((i) => !i.hidden);
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Segmented value={range} onChange={setRange} size="sm" options={[
          { value: 'day', label: L('اليوم', 'Today') },
          { value: 'week', label: L('هذا الأسبوع', 'This week') },
          { value: 'month', label: L('هذا الشهر', 'This month') },
        ]} />
        <span className="flex-1" />
        <Link to="/settings/dashboard" className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-bold text-fg-2 hover:bg-surface-2 hover:text-fg">
          <LayoutGrid size={15} /> {L('تخصيص', 'Customize')}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
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
    </div>
  );
}
