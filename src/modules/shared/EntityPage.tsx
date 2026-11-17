import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Search, Trash2, Star, X } from 'lucide-react';
import clsx from 'clsx';
import type { Rec, RecordType } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { undoToast, toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Button, Chip, EmptyState, IconButton, Input, Label, PageHeader, Select, Switch, Textarea } from '@/design/ui';

/**
 * Configurable CRUD page used by the many "collection-like" modules (subscriptions, library,
 * resources, medications, health records, references…). One reusable component instead of a
 * dozen near-identical apps — every field is real, persisted and synced.
 */

export interface Field {
  key: string;
  ar: string;
  en: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'url' | 'tags' | 'checkbox' | 'rating' | 'times';
  options?: Array<{ value: string; ar: string; en: string }>;
  required?: boolean;
  placeholder?: string;
  full?: boolean;
  min?: number;
  step?: number;
  hint?: { ar: string; en: string };
}

export interface EntityConfig {
  type: RecordType;
  ar: string;
  en: string;
  subAr?: string;
  subEn?: string;
  fields: Field[];
  titleKey: string;
  /** field whose value is stored as record.date (sortable/rangeable) */
  dateKey?: string;
  /** field whose value is stored as record.status */
  statusKey?: string;
  groupBy?: string;
  sort?: (a: Rec, b: Rec) => number;
  meta?: (r: Rec, L: (a: string, e: string) => string) => ReactNode;
  badge?: (r: Rec) => ReactNode;
  summary?: (rs: Rec[]) => ReactNode;
  emptyAr: string;
  emptyEn: string;
  defaults?: Record<string, unknown>;
  private?: boolean;
  icon?: ReactNode;
  filterKey?: string;
  extraActions?: (r: Rec) => ReactNode;
  headerExtra?: ReactNode;
}

export function EntityPage({ config: c, filter, parentId }: { config: EntityConfig; filter?: (r: Rec) => boolean; parentId?: string | null }) {
  const { L } = useI18n();
  const records = useRecords(c.type);
  const [q, setQ] = useState('');
  const [fval, setFval] = useState('');
  const [editing, setEditing] = useState<Rec | null>(null);
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const id = params.get('open');
    if (id && records) {
      const r = records.find((x) => x.id === id);
      if (r) { setEditing(r); setOpen(true); }
      params.delete('open'); setParams(params, { replace: true });
    }
  }, [params, records, setParams]);

  const list = useMemo(() => {
    let xs = (records ?? []) as Rec[];
    if (filter) xs = xs.filter(filter);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      xs = xs.filter((r) => Object.values(r.data).some((v) => String(v ?? '').toLowerCase().includes(s)));
    }
    if (c.filterKey && fval) xs = xs.filter((r) => String(r.data[c.filterKey!] ?? '') === fval);
    return [...xs].sort(c.sort ?? ((a, b) => b.created_at.localeCompare(a.created_at)));
  }, [records, q, fval, c, filter]);

  const groups = useMemo(() => {
    if (!c.groupBy) return [['', list]] as Array<[string, Rec[]]>;
    const m = new Map<string, Rec[]>();
    for (const r of list) {
      const k = String(r.data[c.groupBy] ?? '');
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()];
  }, [list, c.groupBy]);

  const groupField = c.fields.find((f) => f.key === c.groupBy);
  const filterField = c.fields.find((f) => f.key === c.filterKey);
  const optLabel = (f: Field | undefined, v: string) => {
    const o = f?.options?.find((x) => x.value === v);
    return o ? L(o.ar, o.en) : v || L('أخرى', 'Other');
  };

  return (
    <div>
      <PageHeader
        title={L(c.ar, c.en)}
        subtitle={c.subAr ? L(c.subAr, c.subEn ?? c.subAr) : undefined}
        actions={<><Button variant="primary" icon={<Plus size={17} />} onClick={() => { setEditing(null); setOpen(true); }}>{L('إضافة', 'Add')}</Button></>}
      />
      {c.headerExtra}
      {c.summary && records && list.length > 0 && <div className="mb-4">{c.summary(list)}</div>}
      {(records?.length ?? 0) > 4 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field ps-9" placeholder={L('بحث', 'Search')} aria-label={L('بحث', 'Search')} />
          </div>
          {filterField?.options && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!fval} onClick={() => setFval('')}>{L('الكل', 'All')}</Chip>
              {filterField.options.map((o) => <Chip key={o.value} active={fval === o.value} onClick={() => setFval(o.value)}>{L(o.ar, o.en)}</Chip>)}
            </div>
          )}
        </div>
      )}

      {records && list.length === 0 ? (
        <EmptyState icon={c.icon} title={L(c.emptyAr, c.emptyEn)} action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => { setEditing(null); setOpen(true); }}>{L('أضف أول عنصر', 'Add the first one')}</Button>} />
      ) : (
        <div className="space-y-5">
          {groups.map(([g, rs]) => (
            <section key={g}>
              {c.groupBy && <h2 className="mb-1.5 px-1 text-[13px] font-bold text-fg-2">{optLabel(groupField, g)} <span className="num text-fg-3">{rs.length}</span></h2>}
              <div className="card divide-y divide-line">
                {rs.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <button className="min-w-0 flex-1 text-start" onClick={() => { setEditing(r); setOpen(true); }}>
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold">{String(r.data[c.titleKey] ?? '') || L('بدون عنوان', 'Untitled')}</span>
                        {c.badge?.(r)}
                      </div>
                      {c.meta && <div className="mt-0.5 truncate text-[12.5px] text-fg-2">{c.meta(r, L)}</div>}
                    </button>
                    {c.extraActions?.(r)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <EntityEditor config={c} rec={editing} open={open} onOpenChange={setOpen} parentId={parentId} />
    </div>
  );
}

export function EntityEditor({ config: c, rec, open, onOpenChange, parentId, defaults }: { config: EntityConfig; rec: Rec | null; open: boolean; onOpenChange: (v: boolean) => void; parentId?: string | null; defaults?: Record<string, unknown> }) {
  const { L } = useI18n();
  const [d, setD] = useState<Record<string, unknown>>({});
  useEffect(() => { if (open) setD(rec ? { ...rec.data } : { ...(c.defaults ?? {}), ...(defaults ?? {}) }); }, [open, rec, c.defaults, defaults]);
  const set = (k: string, v: unknown) => setD((p) => ({ ...p, [k]: v }));

  const save = async () => {
    for (const f of c.fields) {
      if (f.required && (d[f.key] === undefined || d[f.key] === '' || d[f.key] === null)) { toast(L(`«${f.ar}» مطلوب`, `${f.en} is required`), { tone: 'error' }); return; }
    }
    const date = c.dateKey ? ((d[c.dateKey] as string) || null) : undefined;
    const status = c.statusKey ? ((d[c.statusKey] as string) || null) : undefined;
    if (rec) await update(rec.id, { data: d, ...(date !== undefined && { date }), ...(status !== undefined && { status }) });
    else await create(c.type, d, { date: date ?? null, status: status ?? null, parent_id: parentId ?? null, private: c.private });
    onOpenChange(false);
  };

  const del = async () => {
    if (!rec) return;
    const prev = await remove(rec.id);
    onOpenChange(false);
    undoToast(L('حُذف', 'Deleted'), async () => { if (prev) await revertTo(prev); });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={rec ? L('تعديل', 'Edit') : `${L('إضافة', 'Add')} · ${L(c.ar, c.en)}`}
      footer={<>
        {rec && <IconButton label={L('حذف', 'Delete')} tone="danger" className="me-auto" onClick={del}><Trash2 size={17} /></IconButton>}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        {c.fields.map((f) => <FieldInput key={f.key} f={f} value={d[f.key]} onChange={(v) => set(f.key, v)} />)}
      </div>
    </Modal>
  );
}

export function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const { L } = useI18n();
  const label = L(f.ar, f.en);
  const cls = clsx(f.full || f.type === 'textarea' || f.type === 'tags' || f.type === 'times' ? 'col-span-2' : 'col-span-2 sm:col-span-1');
  const hint = f.hint ? L(f.hint.ar, f.hint.en) : undefined;
  switch (f.type) {
    case 'textarea':
      return <Textarea className={cls} label={label} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <Select className={cls} label={label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{L(o.ar, o.en)}</option>)}
        </Select>
      );
    case 'checkbox':
      return <div className={cls}><Switch checked={!!value} onChange={onChange} label={label} hint={hint} /></div>;
    case 'number':
      return <Input className={cls} label={label} hint={hint} type="number" inputMode="decimal" min={f.min} step={f.step ?? 'any'} value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'rating':
      return (
        <div className={cls}>
          <Label>{label}</Label>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-label={`${n}`} onClick={() => onChange(value === n ? null : n)} className={Number(value) >= n ? 'text-reward' : 'text-line-strong'}><Star size={22} fill="currentColor" /></button>
          ))}</div>
        </div>
      );
    case 'tags':
    case 'times': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={cls}>
          <Label hint={hint}>{label}</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {arr.map((t) => <Chip key={t} onClick={() => onChange(arr.filter((x) => x !== t))}>{t} <X size={11} /></Chip>)}
            <input
              type={f.type === 'times' ? 'time' : 'text'}
              className="field h-8 min-h-0 w-36 py-1 text-[13px]"
              placeholder={f.type === 'tags' ? L('+ Enter', '+ Enter') : undefined}
              onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === 'Enter' && v) { e.preventDefault(); onChange([...new Set([...arr, v])].sort()); (e.target as HTMLInputElement).value = ''; } }}
              onBlur={(e) => { const v = e.target.value.trim(); if (f.type === 'times' && v) { onChange([...new Set([...arr, v])].sort()); e.target.value = ''; } }}
            />
          </div>
        </div>
      );
    }
    default:
      return <Input className={cls} label={label} hint={hint} type={f.type === 'url' ? 'url' : f.type} dir={f.type === 'url' ? 'ltr' : undefined} placeholder={f.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}
