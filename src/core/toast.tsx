import { useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { useL } from './i18n';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error' | 'reward';
  action?: { label: string; run: () => void | Promise<void> };
  ttl: number;
}

let items: ToastItem[] = [];
let seq = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(message: string, opts: Partial<Omit<ToastItem, 'id' | 'message'>> = {}) {
  const t: ToastItem = { id: seq++, message, tone: opts.tone ?? 'default', action: opts.action, ttl: opts.ttl ?? (opts.action ? 6000 : 3200) };
  items = [...items.slice(-2), t];
  emit();
  setTimeout(() => dismiss(t.id), t.ttl);
  return t.id;
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Toast with an Undo button — every destructive or completion action should use this. */
export function undoToast(message: string, undo: () => void | Promise<void>, label = 'تراجع') {
  return toast(message, { action: { label, run: undo } });
}

export function ToastHost() {
  const list = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => items);
  const L = useL();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 16px)' }}
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="anim-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md border border-line bg-elevated px-4 py-3 shadow-3"
          style={t.tone === 'reward' ? { borderColor: 'var(--reward)' } : t.tone === 'error' ? { borderColor: 'var(--danger)' } : undefined}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          {t.action && (
            <button
              className="rounded-sm px-2 py-1 text-sm font-bold text-accent hover:bg-surface-2"
              onClick={async () => { dismiss(t.id); await t.action!.run(); }}
            >
              {t.action.label === 'تراجع' ? L('تراجع', 'Undo') : t.action.label}
            </button>
          )}
          <button aria-label={L('إغلاق', 'Dismiss')} className="text-fg-3 hover:text-fg" onClick={() => dismiss(t.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
