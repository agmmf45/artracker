import { lazy } from 'react';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { isIdOn } from '@/app/registry';
import type { CaptureData } from '@/modules/shared/domain';
import { Hub, type HubTab } from './plan/Hub';

const Tasks = lazy(() => import('./Tasks'));
const Inbox = lazy(() => import('./Inbox'));

/** Tasks and the Inbox in one place: the inbox is just "captured, not sorted yet". */
export default function TasksHub() {
  const { L } = useI18n();
  const s = useSettings();
  const captures = useRecords<CaptureData>('capture');
  const tasks = useRecords<{ title: string }>('task');
  const waiting = (captures ?? []).filter((c) => c.status !== 'done').length + (tasks ?? []).filter((t) => t.status === 'inbox').length;
  const on = (id: string) => isIdOn(id, s.modules, s.modulePreset);
  const tabs: HubTab[] = [
    { id: 'tasks', ar: 'كل المهام', en: 'All tasks', C: Tasks },
    { id: 'inbox', ar: 'الوارد — لم يُرتّب', en: 'Inbox — to sort', badge: waiting, C: Inbox },
  ].filter((t) => on(t.id === 'tasks' ? 'life.tasks' : 'life.inbox'));
  return <Hub tabs={tabs.length ? tabs : [{ id: 'tasks', ar: 'كل المهام', en: 'All tasks', C: Tasks }]} label={L('المهام', 'Tasks')} />;
}
