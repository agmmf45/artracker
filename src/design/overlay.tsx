import { useSyncExternalStore, type ReactNode } from 'react';
import { Dialog, DropdownMenu } from 'radix-ui';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useMedia } from '@/core/hooks';
import { useI18n, useL } from '@/core/i18n';
import { Button, IconButton } from './ui';

/**
 * Modal: bottom sheet on phones (drag to close, one-handed), centered dialog on larger screens.
 * Radix/vaul give focus trapping, Esc to close, aria-modal and scroll locking.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const desktop = useMedia('(min-width: 768px)');
  const { dir } = useI18n();
  const L = useL();
  if (!desktop) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content dir={dir} className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[92dvh] flex-col rounded-t-[20px] border-t border-line bg-elevated outline-none">
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
            <div className="px-5 pb-2 pt-3">
              <Drawer.Title className="text-lg font-black">{title}</Drawer.Title>
              {description ? <Drawer.Description className="mt-0.5 whitespace-pre-line text-sm text-fg-2">{description}</Drawer.Description> : <Drawer.Description className="sr-only">{typeof title === 'string' ? title : ''}</Drawer.Description>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 scroll-thin">{children}</div>
            {footer && <div className="safe-bottom flex gap-2 border-t border-line px-5 py-3">{footer}</div>}
            {!footer && <div className="safe-bottom" />}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 anim-in" />
        <Dialog.Content
          dir={dir}
          className={clsx('anim-in fixed left-1/2 top-[8vh] z-[61] flex max-h-[84vh] w-[calc(100vw-32px)] -translate-x-1/2 flex-col rounded-lg border border-line bg-elevated shadow-3 outline-none', wide ? 'max-w-3xl' : 'max-w-lg')}
        >
          <div className="flex items-start gap-3 px-6 pb-2 pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-black">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 whitespace-pre-line text-sm text-fg-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label={L('إغلاق', 'Close')} size="sm"><X size={18} /></IconButton></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 scroll-thin">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── Promise-based confirm/prompt ─────────────────────── */
interface ConfirmReq { id: number; title: string; message?: string; okText?: string; danger?: boolean; input?: { placeholder?: string; value?: string; type?: string }; resolve: (v: string | boolean | null) => void }
let pending: ConfirmReq | null = null;
const subs = new Set<() => void>();
let n = 0;

export function confirm(title: string, opts: { message?: string; okText?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { id: ++n, title, ...opts, resolve: (v) => resolve(v === true) };
    subs.forEach((s) => s());
  });
}

export function prompt(title: string, opts: { message?: string; okText?: string; placeholder?: string; value?: string; type?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    pending = { id: ++n, title, message: opts.message, okText: opts.okText, input: { placeholder: opts.placeholder, value: opts.value, type: opts.type }, resolve: (v) => resolve(typeof v === 'string' ? v : null) };
    subs.forEach((s) => s());
  });
}

export function ConfirmHost() {
  const req = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => pending);
  const L = useL();
  const close = (v: string | boolean | null) => {
    req?.resolve(v);
    pending = null;
    subs.forEach((s) => s());
  };
  if (!req) return null;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && close(req.input ? null : false)}
      title={req.title}
      description={req.message}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(req.input ? null : false)}>{L('إلغاء', 'Cancel')}</Button>
          <Button
            variant={req.danger ? 'danger' : 'primary'}
            onClick={() => {
              if (req.input) close((document.getElementById(`dq-prompt-${req.id}`) as HTMLInputElement | null)?.value ?? '');
              else close(true);
            }}
          >
            {req.okText ?? L('تأكيد', 'Confirm')}
          </Button>
        </>
      }
    >
      {req.input && (
        <input
          id={`dq-prompt-${req.id}`}
          autoFocus
          className="field"
          type={req.input.type ?? 'text'}
          placeholder={req.input.placeholder}
          defaultValue={req.input.value}
          onKeyDown={(e) => { if (e.key === 'Enter') close((e.target as HTMLInputElement).value); }}
        />
      )}
    </Modal>
  );
}

/* ── Menu ─────────────────────────────────────────────── */
export interface MenuItem { label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }

export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: Array<MenuItem | 'sep'>; align?: 'start' | 'end' }) {
  const { dir } = useI18n();
  return (
    <DropdownMenu.Root dir={dir}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className="anim-in z-[70] min-w-48 rounded-md border border-line bg-elevated p-1 shadow-3">
          {items.map((it, i) =>
            it === 'sep' ? (
              <DropdownMenu.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <DropdownMenu.Item
                key={i}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={clsx(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2',
                  it.danger && 'text-danger',
                )}
              >
                {it.icon}
                {it.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
