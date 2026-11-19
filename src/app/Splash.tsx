import { useEffect, useState } from 'react';
import { useAuth } from '@/core/auth';
import { useL } from '@/core/i18n';

export function Brand({ size = 40 }: { size?: number }) {
  return (
    <span className="font-display leading-none" style={{ fontSize: size }}>
      دقيق<span className="text-life">.</span>
    </span>
  );
}

/** Wipes this device's local copy (the server keeps everything that was synced) and reloads. */
async function resetDeviceCopy() {
  try {
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(dbs.filter((d) => d.name?.startsWith('daqeeq-')).map((d) => new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase(d.name!);
      r.onsuccess = r.onerror = r.onblocked = () => res();
    })));
  } catch { /* nothing to delete */ }
  location.reload();
}

export function Splash() {
  const L = useL();
  const [slow, setSlow] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 12_000); return () => clearTimeout(t); }, []);
  return (
    <div className="grid min-h-dvh place-items-center px-6" aria-busy={!slow}>
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Brand size={44} />
        {!slow ? (
          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
            <div className="skeleton h-full w-full" />
          </div>
        ) : (
          <div role="alert" className="flex flex-col items-center gap-3">
            <p className="text-[15px] font-bold">{L('التحميل طوّل أكثر من العادة', 'Loading is taking longer than usual')}</p>
            <p className="text-[13.5px] text-fg-2">{L('غالباً تخزين المتصفح علّق. جرّب إعادة التحميل — بياناتك محفوظة.', 'Usually the browser’s storage got stuck. Try reloading — your data is safe.')}</p>
            <button onClick={() => location.reload()} className="h-11 rounded-full bg-fg px-6 text-sm font-bold text-bg">{L('إعادة التحميل', 'Reload')}</button>
            <button onClick={() => (sure ? void resetDeviceCopy() : setSure(true))} className="text-[13px] font-bold text-accent-ink underline-offset-2 hover:underline">
              {sure ? L('متأكد؟ التعديلات اللي ما تزامنت من هالجهاز بتروح', 'Sure? Changes not yet synced from this device will be lost') : L('ما زال عالق؟ أعد تنزيل بياناتك من الخادم', 'Still stuck? Re-download your data from the server')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MigrationScreen() {
  const L = useL();
  const { migration } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center px-6" aria-busy="true">
      <div className="max-w-sm text-center">
        <Brand size={40} />
        <h1 className="mt-6 text-xl font-black">{L('ننقل بياناتك للنسخة الجديدة', 'Moving your data to the new version')}</h1>
        <p className="mt-2 text-sm text-fg-2">
          {L('عاداتك ومهامك ومصاريفك وتمارينك كلها تنتقل كما هي. نسخة من بياناتك القديمة تبقى محفوظة.', 'Your habits, tasks, expenses and workouts move over as they are. A copy of your old data stays saved.')}
        </p>
        {migration && <p className="num mt-3 text-sm font-bold text-life">{migration.total} {L('عنصر', 'items')}</p>}
        <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-surface-2"><div className="skeleton h-full w-full" /></div>
      </div>
    </div>
  );
}
