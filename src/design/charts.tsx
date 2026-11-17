import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fromKey, shiftKey, todayKey, weekStartKey } from '@/core/dates';

/**
 * Small dependency-free SVG charts. Every chart takes real values; when there is no data the
 * caller renders an empty state instead of a decorative placeholder.
 */

export function Bars({ data, height = 120, color = 'var(--accent)', format = (v: number) => String(v), goal }: {
  data: Array<{ label: string; value: number; sub?: string }>; height?: number; color?: string; format?: (v: number) => string; goal?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join('، ')}>
        {goal ? <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
        {data.map((d, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="num absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xs bg-fg px-1.5 py-0.5 text-[11px] font-bold text-bg">{format(d.value)}</div>
            )}
            <div
              className="w-full rounded-t-[4px] transition-[height] duration-500"
              style={{ height: `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * 100)}%`, background: color, opacity: hover === null || hover === i ? 1 : 0.55, transitionTimingFunction: 'var(--ease-out)' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => <div key={i} className="flex-1 truncate text-center text-[10.5px] text-fg-3">{d.label}</div>)}
      </div>
    </div>
  );
}

export function Line({ points, height = 140, color = 'var(--accent)', format = (v: number) => String(v), area = true }: {
  points: Array<{ x: string; y: number }>; height?: number; color?: string; format?: (v: number) => string; area?: boolean;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 600;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const px = (i: number) => (i / (points.length - 1)) * W;
  const py = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const h = hover ?? points.length - 1;
  return (
    <div className="relative w-full" dir="ltr">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="h-auto w-full overflow-visible" style={{ height }}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)));
        }}
        onMouseLeave={() => setHover(null)} role="img" aria-label={`${points[0].x} → ${points.at(-1)!.x}: ${format(points[0].y)} → ${format(points.at(-1)!.y)}`}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={`${d} L${W},${height} L0,${height} Z`} fill={`url(#${id})`} />}
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={px(h)} x2={px(h)} y1={0} y2={height} stroke="var(--border-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute top-0 -translate-y-full rounded-xs bg-fg px-1.5 py-0.5 text-[11px] font-bold text-bg"
        style={{ left: `${(h / (points.length - 1)) * 100}%`, transform: `translate(${h > points.length / 2 ? '-100%' : '0'}, -110%)` }}>
        <span className="num">{format(points[h].y)}</span> · {points[h].x}
      </div>
    </div>
  );
}

/** GitHub-style heatmap of the last N weeks. values: dateKey → number. */
export function Heatmap({ values, weeks = 18, max, weekStart = 6, label }: { values: Record<string, number>; weeks?: number; max?: number; weekStart?: 0 | 1 | 6; label?: string }) {
  const { locale } = useI18n();
  const end = todayKey();
  const start = shiftKey(weekStartKey(end, weekStart), -7 * (weeks - 1));
  const m = max ?? Math.max(1, ...Object.values(values));
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => shiftKey(start, w * 7 + d)));
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / m) * 4)));
  return (
    <div className="flex gap-[3px] overflow-x-auto scroll-thin" role="img" aria-label={label}>
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((k) => (
            <div
              key={k}
              title={`${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(fromKey(k))}: ${values[k] ?? 0}`}
              className="size-[11px] rounded-[3px]"
              style={{ background: k > end ? 'transparent' : `var(--heat-${level(values[k] ?? 0)})` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Donut({ parts, size = 120, stroke = 16, center }: { parts: Array<{ label: string; value: number; color: string }>; size?: number; stroke?: number; center?: React.ReactNode }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join('، ')}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {total > 0 && parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-[13px]">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
          <span className="min-w-0 flex-1 truncate text-fg-2">{it.label}</span>
          {it.value && <span className="num font-bold">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
