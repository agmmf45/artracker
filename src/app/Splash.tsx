import { useAuth } from '@/core/auth';
import { useL } from '@/core/i18n';

export function Brand({ size = 40 }: { size?: number }) {
  return (
    <span className="font-display leading-none" style={{ fontSize: size }}>
      دقيق<span className="text-life">.</span>
    </span>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <Brand size={44} />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
          <div className="skeleton h-full w-full" />
        </div>
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
