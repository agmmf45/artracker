import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

export { clsx as cx };

/* ── Button ───────────────────────────────────────────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const vClass: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent border border-[color-mix(in_oklab,var(--accent)_70%,var(--accent-ink))] hover:bg-[color-mix(in_oklab,var(--accent)_85%,var(--accent-ink))] active:translate-y-px',
  secondary: 'bg-surface border border-line-strong text-fg hover:bg-surface-2',
  subtle: 'bg-surface-2 text-fg hover:bg-[color-mix(in_oklab,var(--surface-2)_80%,var(--border))]',
  ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-110',
};
const sClass: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5 rounded-full',
  md: 'h-10 px-4.5 text-sm gap-2 rounded-full',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-bold transition-[background,filter,color,transform] duration-150 active:scale-[0.98] disabled:opacity-50',
        vClass[variant], sClass[size], className,
      )}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md'; tone?: 'default' | 'danger' }>(
  function IconButton({ label, size = 'md', tone = 'default', className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
          size === 'sm' ? 'size-8' : 'size-10',
          tone === 'danger' ? 'text-fg-3 hover:bg-surface-2 hover:text-danger' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/* ── Surfaces ─────────────────────────────────────────── */
export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children?: ReactNode; as?: 'div' | 'section' | 'article' } & Record<string, unknown>) {
  return <As className={clsx('card', className)} {...rest}>{children}</As>;
}

export function CardHeader({ title, eyebrow, action, icon }: { title: ReactNode; eyebrow?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      {icon && <span className="mt-0.5 text-accent">{icon}</span>}
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <h3 className="truncate text-[15px] font-bold leading-tight">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-[26px] font-black leading-tight tracking-tight md:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('mb-6', className)}>
      {(title || action) && (
        <div className="mb-2.5 flex items-center gap-2">
          {title && <h2 className="flex-1 text-[13px] font-bold text-fg-2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-[color-mix(in_oklab,var(--accent)_12%,var(--surface))] px-6 py-10 text-center">
      {icon && <div className="mb-1 grid size-14 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent)_45%,var(--surface))] text-accent">{icon}</div>}
      <p className="font-bold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-fg-2">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── Form controls ────────────────────────────────────── */
export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-bold text-fg-2">
      {children}
      {hint && <span className="ms-1 font-normal text-fg-3">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode }>(
  function Input({ label, hint, className, id, ...rest }, ref) {
    const auto = useId();
    const iid = id ?? auto;
    return (
      <div className={className}>
        {label && <Label htmlFor={iid} hint={hint}>{label}</Label>}
        <input ref={ref} id={iid} className="field" {...rest} />
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode }>(
  function Textarea({ label, className, id, ...rest }, ref) {
    const auto = useId();
    const iid = id ?? auto;
    return (
      <div className={className}>
        {label && <Label htmlFor={iid}>{label}</Label>}
        <textarea ref={ref} id={iid} className="field min-h-24 resize-y leading-relaxed" {...rest} />
      </div>
    );
  },
);

export function Select({ label, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode }) {
  const auto = useId();
  const iid = id ?? auto;
  return (
    <div className={className}>
      {label && <Label htmlFor={iid}>{label}</Label>}
      <div className="relative">
        <select id={iid} className="field appearance-none pe-9" {...rest}>{children}</select>
        <ChevronDown size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-fg-3" />
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-bold">{label}</label>
        {hint && <p className="text-[13px] text-fg-2">{hint}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
      >
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow-1 transition-[inset-inline-start] duration-200', checked ? 'start-[22px]' : 'start-0.5')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>; size?: 'sm' | 'md'; className?: string;
}) {
  return (
    <div role="tablist" className={clsx('inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-surface-2 p-1 scroll-thin', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-accent text-on-accent' : 'text-fg-2 hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, className, tone }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string; tone?: string }) {
  const El = onClick ? 'button' : 'span';
  return (
    <El
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={clsx(
        'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12.5px] font-bold transition-colors',
        active ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_45%,var(--surface))] text-fg' : 'border-line bg-surface text-fg-2',
        onClick && !active && 'hover:border-line-strong hover:text-fg',
        className,
      )}
      style={tone ? { borderColor: tone, color: tone } : undefined}
    >
      {children}
    </El>
  );
}

/* ── Progress ─────────────────────────────────────────── */
export function Bar({ value, max = 1, color, className, label }: { value: number; max?: number; color?: string; className?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color ?? 'var(--accent)', transitionTimingFunction: 'var(--ease-out)' }} />
    </div>
  );
}

export function Ring({ value, max = 1, size = 56, stroke = 6, color, children, label }: { value: number; max?: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? 'var(--accent)'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 600ms var(--ease-out)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Round completion check with a subtle pop. */
export function CheckCircle({ checked, onToggle, label, color, size = 22 }: { checked: boolean; onToggle: () => void; label: string; color?: string; size?: number }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); if (!checked) navigator.vibrate?.(12); onToggle(); }}
      className={clsx('grid shrink-0 place-items-center rounded-full border-2 transition-colors', checked ? 'anim-pop' : 'hover:bg-surface-2')}
      style={{
        width: size, height: size,
        borderColor: checked ? (color ?? 'var(--accent)') : 'var(--border-strong)',
        background: checked ? (color ?? 'var(--accent)') : 'transparent',
      }}
    >
      {checked && <Check size={size * 0.62} strokeWidth={3} className="text-on-accent" />}
    </button>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-bold text-fg-3">{label}</div>
      <div className="num truncate text-xl font-black leading-tight" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="truncate text-[12px] text-fg-2">{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}
