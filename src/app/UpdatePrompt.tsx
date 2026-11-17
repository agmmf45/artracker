import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { useL } from '@/core/i18n';

/** Service-worker update management: never reloads under the user, asks first. */
export function UpdatePrompt() {
  const L = useL();
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => { void reg.update(); }, 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div role="status" className="anim-in fixed inset-x-4 top-4 z-[75] mx-auto flex max-w-md items-center gap-3 rounded-md border border-line bg-elevated px-4 py-3 shadow-3">
      <RefreshCw size={18} className="text-life" />
      <span className="flex-1 text-sm">{L('نسخة جديدة من دقيق جاهزة', 'A new version of Daqeeq is ready')}</span>
      <button className="text-sm text-fg-3" onClick={() => setNeedRefresh(false)}>{L('لاحقاً', 'Later')}</button>
      <button className="rounded-sm bg-life px-3 py-1.5 text-sm font-bold text-on-accent" onClick={() => updateServiceWorker(true)}>{L('تحديث', 'Update')}</button>
    </div>
  );
}
