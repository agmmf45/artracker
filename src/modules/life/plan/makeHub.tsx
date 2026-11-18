import type { ComponentType } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { isIdOn } from '@/app/registry';
import { Hub } from './Hub';

export interface HubSpec { id: string; page: string; ar: string; en: string; C: ComponentType }

/** A hub page from a list of tabs; a tab shows when its page is on in Settings › Modules. */
export function makeHub(labelAr: string, labelEn: string, specs: HubSpec[]) {
  return function HubPage() {
    const { L } = useI18n();
    const s = useSettings();
    const tabs = specs.filter((t) => isIdOn(t.page, s.modules, s.modulePreset));
    return <Hub tabs={tabs.length ? tabs : specs.slice(0, 1)} label={L(labelAr, labelEn)} />;
  };
}
