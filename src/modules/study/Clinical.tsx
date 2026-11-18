import { useMemo, useState } from 'react';
import { Plus, Stethoscope, ShieldAlert, Trash2, ClipboardList, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { bulk, create, remove, update } from '@/core/repo';
import { fmtDate, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { confirm, Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Stat, Textarea } from '@/design/ui';
import { CourseSelect } from './shared';

interface ReqData { category: string; name: string; required: number; kind: 'clinical' | 'preclinical' | 'simulation' | 'osce' | 'competency'; course_id: string | null; checklist?: Array<{ id: string; text: string; done: boolean }> }
interface LogData { req_id: string; case_ref: string; tooth: string; role: 'performed' | 'assisted' | 'observed'; supervisor: string; evaluation: string; score: number | null; notes: string }

export const DENTAL_CATEGORIES: Array<[string, string, string]> = [
  ['operative', 'العلاج التحفظي', 'Operative dentistry'], ['endo', 'علاج العصب', 'Endodontics'], ['perio', 'أمراض اللثة', 'Periodontics'],
  ['prosth', 'التركيبات', 'Prosthodontics'], ['surgery', 'جراحة الفم', 'Oral surgery'], ['diagnosis', 'التشخيص والأشعة', 'Oral diagnosis & radiology'],
  ['pedo', 'طب أسنان الأطفال', 'Pediatric dentistry'], ['ortho', 'التقويم', 'Orthodontics'], ['other', 'أخرى', 'Other'],
];

/** Example dental requirements — a starting template only; every university sets its own numbers. */
const DENTAL_TEMPLATE: Array<[string, string, number, ReqData['kind']]> = [
  ['operative', 'Class I composite', 4, 'clinical'], ['operative', 'Class II composite / amalgam', 4, 'clinical'], ['operative', 'Class III composite', 3, 'clinical'], ['operative', 'Class V restoration (GIC/composite)', 2, 'clinical'],
  ['endo', 'Anterior root canal treatment', 2, 'clinical'], ['endo', 'Premolar root canal treatment', 2, 'clinical'], ['endo', 'Molar root canal treatment', 1, 'clinical'],
  ['perio', 'Full periodontal charting', 4, 'clinical'], ['perio', 'Scaling & root planing (full mouth)', 4, 'clinical'], ['perio', 'Oral hygiene instruction', 6, 'clinical'],
  ['prosth', 'Complete denture (set)', 1, 'clinical'], ['prosth', 'Removable partial denture', 1, 'clinical'], ['prosth', 'Crown preparation', 2, 'clinical'], ['prosth', 'Post & core', 1, 'clinical'],
  ['surgery', 'Simple extraction', 10, 'clinical'], ['surgery', 'Surgical extraction (supervised)', 2, 'clinical'],
  ['diagnosis', 'Comprehensive exam & treatment plan', 5, 'clinical'], ['diagnosis', 'Periapical radiograph', 10, 'clinical'], ['diagnosis', 'Bitewing radiographs', 5, 'clinical'],
  ['pedo', 'Fissure sealant', 4, 'clinical'], ['pedo', 'Pulpotomy', 1, 'clinical'], ['pedo', 'Fluoride application', 4, 'clinical'],
  ['operative', 'Phantom-head cavity preparations', 10, 'preclinical'], ['endo', 'Extracted-tooth RCT (simulation)', 3, 'simulation'],
];

const OSCE_TEMPLATE = ['Hand hygiene & PPE', 'Patient identification & consent', 'Medical history review', 'Extra-oral examination', 'Intra-oral examination', 'Charting & findings', 'Communicate findings & plan', 'Infection control at the end'];

/** Looks like a person's name (letters only, 2+ words) — we nudge the user to anonymise. */
function looksIdentifying(s: string): boolean {
  return /^[\p{L}\s.'-]{5,}$/u.test(s.trim()) && s.trim().split(/\s+/).length >= 2;
}

export default function Clinical() {
  const { L, locale } = useI18n();
  const reqs = useRecords<ReqData>('clinical_req');
  const logs = useRecords<LogData>('clinical_log');
  const [tab, setTab] = useState<'requirements' | 'logbook' | 'osce'>('requirements');
  const [editReq, setEditReq] = useState<Rec<ReqData> | 'new' | null>(null);
  const [logFor, setLogFor] = useState<string | null | ''>(null);
  const [cat, setCat] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs ?? []) if (l.data.role === 'performed') m.set(l.data.req_id, (m.get(l.data.req_id) ?? 0) + 1);
    return m;
  }, [logs]);
  const list = (reqs ?? []).filter((r) => r.data.kind !== 'osce' && (!cat || r.data.category === cat));
  const required = list.reduce((s, r) => s + r.data.required, 0);
  const done = list.reduce((s, r) => s + Math.min(r.data.required, counts.get(r.id) ?? 0), 0);

  const applyTemplate = async () => {
    if (!(await confirm(L('إضافة قالب متطلبات طب الأسنان؟', 'Add the dental requirements template?'), { message: L('أرقام توضيحية فقط — عدّلها لتطابق متطلبات جامعتك. لن نحذف أي متطلبات موجودة.', 'Illustrative numbers only — edit them to match your university. Existing requirements are kept.') }))) return;
    const existing = new Set((reqs ?? []).map((r) => r.data.name));
    await bulk(async () => {
      for (const [category, name, required, kind] of DENTAL_TEMPLATE) if (!existing.has(name)) await create<ReqData>('clinical_req', { category, name, required, kind, course_id: null });
    });
    toast(L('أُضيف القالب', 'Template added'));
  };

  return (
    <div>
      <PageHeader title={L('المتطلبات السريرية', 'Clinical tracker')} subtitle={L('بدون أسماء أو صور مرضى — استخدم رمزاً مجهولاً لكل حالة.', 'No patient names or identifying images — use an anonymous case code.')}
        actions={<><Segmented value={tab} onChange={setTab} options={[{ value: 'requirements', label: L('المتطلبات', 'Requirements') }, { value: 'logbook', label: L('السجل', 'Logbook') }, { value: 'osce', label: 'OSCE' }]} /><Button variant="primary" icon={<Plus size={16} />} onClick={() => (tab === 'logbook' ? setLogFor('') : setEditReq('new'))}>{tab === 'logbook' ? L('حالة', 'Case') : L('متطلب', 'Requirement')}</Button></>} />

      {tab === 'requirements' && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Card className="p-4"><Stat label={L('المنجز', 'Completed')} value={`${done}/${required}`} /><Bar className="mt-2" value={done} max={Math.max(1, required)} color="var(--study)" /></Card>
            <Card className="p-4"><Stat label={L('المتبقي', 'Remaining')} value={Math.max(0, required - done)} /></Card>
            <Card className="p-4"><Stat label={L('حالات مسجلة', 'Logged cases')} value={logs?.length ?? 0} /></Card>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip active={!cat} onClick={() => setCat('')}>{L('الكل', 'All')}</Chip>
            {DENTAL_CATEGORIES.filter(([k]) => (reqs ?? []).some((r) => r.data.category === k)).map(([k, ar, en]) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{L(ar, en)}</Chip>)}
          </div>
          {!list.length ? (
            <EmptyState icon={<Stethoscope size={30} />} title={L('أضف متطلباتك السريرية', 'Add your clinical requirements')} hint={L('ابدأ من قالب طب الأسنان ثم عدّل الأعداد.', 'Start from the dental template, then edit the numbers.')} action={<Button variant="primary" onClick={applyTemplate}>{L('قالب طب الأسنان', 'Dental template')}</Button>} />
          ) : (
            <div className="space-y-4">
              {DENTAL_CATEGORIES.map(([k, ar, en]) => {
                const rs = list.filter((r) => r.data.category === k);
                if (!rs.length) return null;
                return (
                  <section key={k}>
                    <h2 className="mb-1.5 text-[13px] font-bold text-fg-2">{L(ar, en)}</h2>
                    <Card className="divide-y divide-line">
                      {rs.map((r) => {
                        const n = counts.get(r.id) ?? 0;
                        const complete = n >= r.data.required;
                        return (
                          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                            <button className="min-w-0 flex-1 text-start" onClick={() => setEditReq(r)}>
                              <div className="flex items-center gap-2"><span className="truncate font-bold">{r.data.name}</span>{r.data.kind !== 'clinical' && <span className="rounded-xs bg-surface-2 px-1.5 text-[10px] font-bold text-fg-3">{r.data.kind}</span>}</div>
                              <Bar className="mt-1.5" value={n} max={r.data.required} color={complete ? 'var(--success)' : 'var(--study)'} />
                            </button>
                            <span className={clsx('num w-14 text-end text-sm font-black', complete && 'text-success')}>{n}/{r.data.required}</span>
                            <Button size="sm" variant="subtle" icon={<Plus size={14} />} onClick={() => setLogFor(r.id)}>{L('حالة', 'Case')}</Button>
                          </div>
                        );
                      })}
                    </Card>
                  </section>
                );
              })}
              <Button variant="ghost" onClick={applyTemplate}>{L('أضف عناصر القالب الناقصة', 'Add missing template items')}</Button>
            </div>
          )}
        </>
      )}

      {tab === 'logbook' && (
        !logs?.length ? <EmptyState icon={<ClipboardList size={28} />} title={L('سجل الحالات فارغ', 'Logbook is empty')} /> : (
          <Card className="divide-y divide-line">
            {[...logs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((l) => {
              const r = (reqs ?? []).find((x) => x.id === l.data.req_id);
              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{r?.data.name ?? '—'}</div>
                    <div className="text-[12px] text-fg-3">{fmtDate(l.date!, locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {l.data.case_ref}{l.data.tooth ? ` · #${l.data.tooth}` : ''} · {l.data.role === 'performed' ? L('أدّيتها', 'performed') : l.data.role === 'assisted' ? L('ساعدت', 'assisted') : L('شاهدت', 'observed')}{l.data.evaluation ? ` · ${l.data.evaluation}` : ''}{l.data.score != null ? ` (${l.data.score})` : ''}</div>
                  </div>
                  <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(l.id)}><Trash2 size={14} /></IconButton>
                </div>
              );
            })}
          </Card>
        )
      )}

      {tab === 'osce' && <Osce reqs={(reqs ?? []).filter((r) => r.data.kind === 'osce')} />}

      {editReq && <ReqEditor r={editReq === 'new' ? null : editReq} onClose={() => setEditReq(null)} />}
      {logFor !== null && <LogEditor reqs={(reqs ?? []).filter((r) => r.data.kind !== 'osce')} reqId={logFor || null} onClose={() => setLogFor(null)} />}
    </div>
  );
}

function ReqEditor({ r, onClose }: { r: Rec<ReqData> | null; onClose: () => void }) {
  const { L } = useI18n();
  const [d, setD] = useState<ReqData>(r?.data ?? { category: 'operative', name: '', required: 1, kind: 'clinical', course_id: null });
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={r ? L('تعديل المتطلب', 'Edit requirement') : L('متطلب جديد', 'New requirement')}
      footer={<>{r && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { await remove(r.id); onClose(); }}><Trash2 size={17} /></IconButton>}<Button variant="primary" onClick={async () => { if (!d.name.trim()) return; if (r) await update<ReqData>(r.id, { data: d }); else await create<ReqData>('clinical_req', d); onClose(); }}>{L('حفظ', 'Save')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input className="sm:col-span-2" label={L('الإجراء', 'Procedure')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} autoFocus={!r} />
        <Select label={L('القسم', 'Category')} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>{DENTAL_CATEGORIES.map(([k, ar, en]) => <option key={k} value={k}>{L(ar, en)}</option>)}</Select>
        <Select label={L('النوع', 'Kind')} value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ReqData['kind'] })}>
          <option value="clinical">{L('سريري', 'Clinical')}</option><option value="preclinical">{L('ما قبل السريري', 'Preclinical')}</option><option value="simulation">{L('محاكاة', 'Simulation')}</option><option value="competency">{L('تقييم كفاءة', 'Competency')}</option><option value="osce">OSCE</option>
        </Select>
        <Input type="number" min={0} label={L('العدد المطلوب', 'Required count')} value={d.required} onChange={(e) => setD({ ...d, required: Math.max(0, Number(e.target.value) || 0) })} />
        <CourseSelect label={L('المقرر', 'Course')} value={d.course_id} onChange={(v) => setD({ ...d, course_id: v })} />
      </div>
    </Modal>
  );
}

function LogEditor({ reqs, reqId, onClose }: { reqs: Array<Rec<ReqData>>; reqId: string | null; onClose: () => void }) {
  const { L } = useI18n();
  const [d, setD] = useState<LogData>({ req_id: reqId ?? reqs[0]?.id ?? '', case_ref: `C-${String(Date.now()).slice(-5)}`, tooth: '', role: 'performed', supervisor: '', evaluation: '', score: null, notes: '' });
  const [date, setDate] = useState(todayKey());
  const warn = looksIdentifying(d.case_ref);
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('حالة جديدة', 'New case')}
      footer={<Button variant="primary" disabled={!d.req_id} onClick={async () => {
        if (warn && !(await confirm(L('يبدو أن رمز الحالة اسم شخص', 'The case code looks like a person’s name'), { message: L('لا تحفظ أسماء المرضى. استخدم رمزاً مجهولاً مثل C-1042.', 'Do not store patient names. Use an anonymous code like C-1042.'), okText: L('حفظ رغم ذلك', 'Save anyway') }))) return;
        await create<LogData>('clinical_log', d, { date, parent_id: d.req_id, private: true });
        onClose();
      }}>{L('حفظ', 'Save')}</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select className="sm:col-span-2" label={L('المتطلب', 'Requirement')} value={d.req_id} onChange={(e) => setD({ ...d, req_id: e.target.value })}>{reqs.map((r) => <option key={r.id} value={r.id}>{r.data.name}</option>)}</Select>
        <Input type="date" label={L('التاريخ', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label={L('رمز الحالة (مجهول)', 'Case code (anonymous)')} dir="ltr" value={d.case_ref} onChange={(e) => setD({ ...d, case_ref: e.target.value })} />
        {warn && <p className="flex items-center gap-1.5 text-[12px] font-bold text-warning sm:col-span-2"><ShieldAlert size={14} />{L('لا تكتب اسم المريض.', 'Do not enter the patient’s name.')}</p>}
        <Input label={L('رقم السن (FDI)', 'Tooth (FDI)')} dir="ltr" value={d.tooth} onChange={(e) => setD({ ...d, tooth: e.target.value })} placeholder="36" />
        <Select label={L('دوري', 'My role')} value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as LogData['role'] })}><option value="performed">{L('أدّيتها', 'Performed')}</option><option value="assisted">{L('ساعدت', 'Assisted')}</option><option value="observed">{L('شاهدت', 'Observed')}</option></Select>
        <Input label={L('المشرف (اختصار)', 'Supervisor (initials)')} value={d.supervisor} onChange={(e) => setD({ ...d, supervisor: e.target.value })} />
        <Input label={L('تقييم المشرف', 'Supervisor evaluation')} value={d.evaluation} onChange={(e) => setD({ ...d, evaluation: e.target.value })} placeholder="A / Competent" />
        <Input type="number" label={L('الدرجة', 'Score')} value={d.score ?? ''} onChange={(e) => setD({ ...d, score: e.target.value ? Number(e.target.value) : null })} />
        <Textarea className="sm:col-span-2" label={L('ملاحظات (بدون بيانات تعريفية)', 'Notes (no identifying details)')} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </div>
      <p className="mt-2 text-[12px] text-fg-3">{L('فقط حالات «أدّيتها» تُحسب في المتطلبات.', 'Only “performed” cases count toward requirements.')}</p>
    </Modal>
  );
}

function Osce({ reqs }: { reqs: Array<Rec<ReqData>> }) {
  const { L } = useI18n();
  const [name, setName] = useState('');
  const add = async (title: string, items: string[]) => create<ReqData>('clinical_req', { category: 'diagnosis', name: title, required: 0, kind: 'osce', course_id: null, checklist: items.map((t, i) => ({ id: `o${i}`, text: t, done: false })) });
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button onClick={() => add(L('محطة فحص المريض', 'Patient examination station'), OSCE_TEMPLATE)}>{L('قالب محطة فحص', 'Examination station template')}</Button>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await add(name.trim(), []); setName(''); }}><input className="field h-10" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('محطة جديدة', 'New station')} /><Button type="submit" icon={<Plus size={15} />}>{L('أضف', 'Add')}</Button></form>
      </div>
      {!reqs.length ? <EmptyState title={L('قوائم تحقق OSCE تساعدك تتدرب خطوة بخطوة', 'OSCE checklists help you rehearse step by step')} /> : (
        <div className="grid gap-3 md:grid-cols-2">{reqs.map((r) => {
          const cl = r.data.checklist ?? [];
          return (
            <Card key={r.id} className="p-4">
              <div className="mb-2 flex items-center gap-2"><span className="flex-1 font-bold">{r.data.name}</span><span className="num text-[12px] text-fg-3">{cl.filter((c) => c.done).length}/{cl.length}</span>
                <Button size="sm" variant="ghost" onClick={() => update<ReqData>(r.id, { data: { checklist: cl.map((c) => ({ ...c, done: false })) } })}>{L('إعادة', 'Reset')}</Button>
                <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(r.id)}><Trash2 size={14} /></IconButton></div>
              <ul className="space-y-1">{cl.map((c) => (
                <li key={c.id}><button className="flex w-full items-center gap-2 text-start text-sm" onClick={() => update<ReqData>(r.id, { data: { checklist: cl.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) } })}>
                  <span className={clsx('grid size-5 place-items-center rounded-xs border', c.done ? 'border-study bg-study text-on-accent' : 'border-line-strong')}>{c.done && <Check size={12} />}</span><span className={c.done ? 'text-fg-3 line-through' : ''}>{c.text}</span></button></li>
              ))}</ul>
              <form className="mt-2" onSubmit={async (e) => { e.preventDefault(); const t = (new FormData(e.currentTarget).get('t') as string).trim(); if (!t) return; await update<ReqData>(r.id, { data: { checklist: [...cl, { id: `o${Date.now()}`, text: t, done: false }] } }); e.currentTarget.reset(); }}><input name="t" className="field h-8 min-h-0 py-1 text-[13px]" placeholder={L('+ خطوة', '+ step')} /></form>
            </Card>
          );
        })}</div>
      )}
    </div>
  );
}
