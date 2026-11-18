import { useRef, useState } from 'react';
import { Plus, Camera, Sparkles, Trash2, Bookmark, X, Droplets } from 'lucide-react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecord, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { fmtDate, rangeKeys, relativeDay, shiftKey, todayKey } from '@/core/dates';
import { api } from '@/core/api';
import { toast, undoToast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Ring, Segmented, Stat, Textarea } from '@/design/ui';
import { Bars } from '@/design/charts';

export interface MealData {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; name: string; calories: number; protein: number; carbs: number; fat: number;
  fiber?: number | null; sugar?: number | null; sodium?: number | null; estimated: boolean; photo_id: string | null; analysis_id: string | null;
  grams?: number | null; confidence?: number | null; extra?: Record<string, unknown>;
}
type Meal = Rec<MealData>;
const TYPES: Array<[MealData['meal_type'], string, string, string]> = [['breakfast', '🍳', 'فطور', 'Breakfast'], ['lunch', '🍗', 'غداء', 'Lunch'], ['dinner', '🍽️', 'عشاء', 'Dinner'], ['snack', '🍎', 'سناك', 'Snack']];
const guessType = (): MealData['meal_type'] => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; };

async function compress(file: File, max = 1024, q = 0.8): Promise<{ dataUrl: string; data: string; media: 'image/jpeg' }> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', q);
  return { dataUrl, data: dataUrl.split(',')[1], media: 'image/jpeg' };
}

export default function Nutrition() {
  const { L, lang, locale, fmtNum } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const [day, setDay] = useState(todayKey());
  const meals = useRecordsInRange<MealData>('meal', shiftKey(todayKey(), -29), todayKey()) as Meal[] | undefined;
  const water = useRecordsInRange<{ ml: number }>('water_log', day, day);
  const saved = useRecords<MealData & { uses?: number }>('food');
  const [add, setAdd] = useState<Partial<MealData> | null>(null);
  const [ai, setAi] = useState(false);
  const [detail, setDetail] = useState<Meal | null>(null);
  const h = settings.health;

  const todays = (meals ?? []).filter((m) => m.date === day);
  const tot = todays.reduce((s, m) => ({ cal: s.cal + m.data.calories, p: s.p + m.data.protein, c: s.c + m.data.carbs, f: s.f + m.data.fat }), { cal: 0, p: 0, c: 0, f: 0 });
  const week = rangeKeys(shiftKey(todayKey(), -6), 7).map((d) => ({ label: fmtDate(d, locale, { weekday: 'narrow' }), value: (meals ?? []).filter((m) => m.date === d).reduce((s, m) => s + m.data.calories, 0) }));

  return (
    <div>
      <PageHeader title={L('التغذية', 'Nutrition')} subtitle={L('القيم التقديرية موسومة بوضوح. لا ننصح بتقييد خطر للسعرات.', 'Estimated values are clearly marked. We never suggest dangerously low calories.')}
        actions={<>
          <Button icon={<Camera size={16} />} onClick={() => setAi(true)}>{L('حلّل وجبة', 'Analyze a meal')}</Button>
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => setAdd({ meal_type: guessType() })}>{L('وجبة', 'Meal')}</Button>
        </>} />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
        {rangeKeys(shiftKey(todayKey(), -6), 7).map((d) => <Chip key={d} active={d === day} onClick={() => setDay(d)}>{relativeDay(d, lang, locale)}</Chip>)}
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-wrap items-center gap-6 p-5">
          <Ring value={tot.cal} max={h.calorieGoal} size={130} stroke={10} color={tot.cal > h.calorieGoal * 1.1 ? 'var(--warning)' : 'var(--health)'} label={L('السعرات', 'Calories')}>
            <div><div className="num text-2xl font-black">{fmtNum(Math.round(tot.cal))}</div><div className="num text-[11px] text-fg-3">/ {fmtNum(h.calorieGoal)} kcal</div></div>
          </Ring>
          <div className="grid min-w-52 flex-1 gap-3">
            {[[L('بروتين', 'Protein'), tot.p, h.proteinGoal, 'var(--viz-2)'], [L('كربوهيدرات', 'Carbs'), tot.c, h.carbGoal, 'var(--viz-4)'], [L('دهون', 'Fat'), tot.f, h.fatGoal, 'var(--viz-5)']].map(([label, v, g, col]) => (
              <div key={label as string}><div className="mb-1 flex text-sm"><span className="flex-1">{label as string}</span><span className="num text-fg-2">{Math.round(v as number)}g{g ? ` / ${g}g` : ''}</span></div><Bar value={v as number} max={(g as number) || Math.max(1, (v as number) * 1.5)} color={col as string} /></div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-[13px] font-bold text-fg-2">{L('آخر 7 أيام', 'Last 7 days')}</div>
          <Bars data={week} height={80} color="var(--health)" goal={h.calorieGoal} />
          <button onClick={() => nav('/health/water')} className="mt-3 flex w-full items-center gap-2 rounded-sm bg-surface-2 px-3 py-2 text-sm"><Droplets size={15} className="text-info" /><span className="flex-1 text-start">{L('الماء', 'Water')}</span><span className="num font-bold">{fmtNum((water ?? []).reduce((s, w) => s + w.data.ml, 0))} / {fmtNum(h.waterGoal)} ml</span></button>
        </Card>
      </div>

      {!todays.length ? <EmptyState title={L('لا وجبات مسجّلة لهذا اليوم', 'No meals logged for this day')} hint={L('صوّر وجبتك ودع التحليل يقدّر القيم، أو أضفها يدوياً.', 'Snap your meal for an estimate, or add it manually.')} /> : (
        <div className="space-y-4">
          {TYPES.map(([t, icon, ar, en]) => {
            const ms = todays.filter((m) => m.data.meal_type === t);
            if (!ms.length) return null;
            return (
              <section key={t}>
                <h2 className="mb-1.5 text-[13px] font-bold text-fg-2">{icon} {L(ar, en)} <span className="num text-fg-3">· {Math.round(ms.reduce((s, m) => s + m.data.calories, 0))} kcal</span></h2>
                <Card className="divide-y divide-line">
                  {ms.map((m) => (
                    <button key={m.id} onClick={() => setDetail(m)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{m.data.name}{m.data.estimated && <span className="ms-2 rounded-xs bg-surface-2 px-1.5 text-[10px] font-bold text-fg-3">{L('تقديري', 'estimate')}</span>}</div>
                        <div className="num text-[12px] text-fg-3">P {Math.round(m.data.protein)} · C {Math.round(m.data.carbs)} · F {Math.round(m.data.fat)}{m.data.grams ? ` · ${m.data.grams}g` : ''}</div>
                      </div>
                      <span className="num font-black">{Math.round(m.data.calories)}</span>
                    </button>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      {!!saved?.length && (
        <div className="mt-6">
          <h2 className="mb-1.5 text-[13px] font-bold text-fg-2"><Bookmark size={13} className="inline" /> {L('وجباتي المحفوظة', 'Saved meals')}</h2>
          <div className="flex flex-wrap gap-1.5">{saved.map((f) => <Chip key={f.id} onClick={() => setAdd({ ...f.data, meal_type: guessType() })}>{f.data.name} · {Math.round(f.data.calories)}</Chip>)}</div>
        </div>
      )}

      {add && <MealEditor initial={add} day={day} onClose={() => setAdd(null)} />}
      {ai && <MealAnalyzer day={day} onClose={() => setAi(false)} />}
      {detail && <MealDetail m={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function MealEditor({ initial, day, onClose, edit }: { initial: Partial<MealData>; day: string; onClose: () => void; edit?: Meal }) {
  const { L } = useI18n();
  const [d, setD] = useState<MealData>({ meal_type: 'snack', name: '', calories: 0, protein: 0, carbs: 0, fat: 0, estimated: false, photo_id: null, analysis_id: null, ...initial } as MealData);
  const [saveTpl, setSaveTpl] = useState(false);
  const set = (p: Partial<MealData>) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!d.name.trim()) { toast(L('اكتب اسم الطعام', 'Name the food'), { tone: 'error' }); return; }
    if (edit) await update<MealData>(edit.id, { data: d });
    else await create<MealData>('meal', d, { date: day });
    if (saveTpl) await create('food', { ...d, photo_id: null, analysis_id: null });
    onClose();
  };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={edit ? L('تعديل الوجبة', 'Edit meal') : L('أضف وجبة', 'Add meal')}
      footer={<><Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button></>}>
      <div className="space-y-3">
        <Segmented value={d.meal_type} onChange={(v) => set({ meal_type: v })} options={TYPES.map(([v, i, ar, en]) => ({ value: v, label: `${i} ${L(ar, en)}` }))} />
        <Input label={L('الطعام', 'Food')} value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Input type="number" label="kcal" value={d.calories || ''} onChange={(e) => set({ calories: Number(e.target.value) || 0 })} />
          <Input type="number" label={L('بروتين g', 'Protein g')} value={d.protein || ''} onChange={(e) => set({ protein: Number(e.target.value) || 0 })} />
          <Input type="number" label={L('كارب g', 'Carbs g')} value={d.carbs || ''} onChange={(e) => set({ carbs: Number(e.target.value) || 0 })} />
          <Input type="number" label={L('دهون g', 'Fat g')} value={d.fat || ''} onChange={(e) => set({ fat: Number(e.target.value) || 0 })} />
          <Input type="number" label={L('الوزن g', 'Weight g')} value={d.grams ?? ''} onChange={(e) => set({ grams: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.estimated} onChange={(e) => set({ estimated: e.target.checked })} />{L('قيم تقديرية', 'Estimated values')}</label>
        {!edit && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} />{L('احفظها في وجباتي للإضافة السريعة', 'Save to my meals for quick add')}</label>}
      </div>
    </Modal>
  );
}

interface AiItem { name: string; category?: string; brand?: string | null; packageSize?: string | null; count?: number; cookingMethod?: string | null; confidence?: number; weightG?: { low: number; likely: number; high: number }; cal: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number; sodium?: number }
interface AiResult { mealName: string; cuisine?: string | null; mealType?: MealData['meal_type']; confidence?: number; items: AiItem[]; tips?: Array<{ tone: 'good' | 'watch' | 'idea'; text: string }>; message?: string }

/** v4 "Nutrition vision analyzer": up to 4 photos + optional description → itemized estimate with confidence. */
function MealAnalyzer({ day, onClose }: { day: string; onClose: () => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const [images, setImages] = useState<Array<{ dataUrl: string; data: string; media: 'image/jpeg' }>>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiResult | null>(null);
  const [on, setOn] = useState<boolean[]>([]);
  const [type, setType] = useState<MealData['meal_type']>(guessType());
  const file = useRef<HTMLInputElement>(null);
  const allowed = settings.privacy.ai.enabled && settings.privacy.ai.health;

  const analyze = async () => {
    if (!images.length && !text.trim()) { toast(L('صوّر وجبة أو اكتب وصفاً', 'Add a photo or a description'), { tone: 'error' }); return; }
    setBusy(true);
    try {
      const r = await api<{ result: AiResult }>('/ai/nutrition_vision', { input: { text: text || undefined, images: images.map((i) => ({ media_type: i.media, data: i.data })) }, consent: true });
      setRes(r.result); setOn((r.result.items ?? []).map(() => true));
      if (r.result.mealType) setType(r.result.mealType);
    } catch (e) { toast((e as Error).message, { tone: 'error' }); } finally { setBusy(false); }
  };
  const apply = async () => {
    if (!res) return;
    const analysis_id = `an-${Date.now()}`;
    let photo_id: string | null = null;
    if (images[0]) {
      const thumb = await fetch(images[0].dataUrl).then((r) => r.blob()).then((b) => compress(new File([b], 'x.jpg'), 480, 0.72));
      const p = await create('blob', { kind: 'meal_photo', data_url: thumb.dataUrl });
      photo_id = p.id;
    }
    const items = res.items.filter((_, i) => on[i]);
    for (const it of items) {
      await create<MealData>('meal', {
        meal_type: type, name: it.brand ? `${it.name} (${it.brand})` : it.name, calories: Math.round(it.cal), protein: Math.round(it.protein), carbs: Math.round(it.carbs), fat: Math.round(it.fat),
        fiber: it.fiber ?? null, sugar: it.sugar ?? null, sodium: it.sodium ?? null, estimated: true, photo_id, analysis_id, grams: it.weightG?.likely ?? null, confidence: it.confidence ?? null,
        extra: { source: 'ai_vision', mealName: res.mealName, cuisine: res.cuisine ?? null, category: it.category, cookingMethod: it.cookingMethod ?? null, weightG: it.weightG, packageSize: it.packageSize ?? null, count: it.count ?? 1, analyzedAt: new Date().toISOString() },
      }, { date: day });
    }
    toast(L(`أُضيف ${items.length} صنف`, `${items.length} items added`));
    onClose();
  };

  if (!allowed) return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('تحليل الوجبة', 'Meal analysis')} footer={<Button variant="primary" onClick={() => nav('/settings/privacy')}>{L('الإعدادات › الخصوصية', 'Settings › Privacy')}</Button>}>
      <p className="text-sm text-fg-2">{L('تحليل الصور يرسل صورة الوجبة للمساعد الذكي، لذلك يحتاج موافقتك: فعّل «المساعد الذكي» و«بيانات الصحة» من إعدادات الخصوصية.', 'Photo analysis sends the meal photo to the AI assistant, so it needs your consent: enable "AI assistant" and "health data" in Privacy settings.')}</p>
    </Modal>
  );

  const tips = { good: '✅', watch: '⚠️', idea: '💡' } as const;
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('حلّل وجبتك', 'Analyze your meal')} wide
      footer={res ? <><Button variant="ghost" onClick={() => setRes(null)}>{L('رجوع', 'Back')}</Button><Button variant="primary" onClick={apply}>{L('أضف المحدد', 'Add selected')}</Button></> : <Button variant="primary" icon={<Sparkles size={16} />} loading={busy} onClick={analyze}>{L('حلّل', 'Analyze')}</Button>}>
      {!res ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {images.map((im, i) => <div key={i} className="relative"><img src={im.dataUrl} alt="" className="size-24 rounded-md object-cover" /><button aria-label={L('إزالة', 'Remove')} className="absolute -top-1.5 -end-1.5 grid size-6 place-items-center rounded-full bg-fg text-bg" onClick={() => setImages(images.filter((_, j) => j !== i))}><X size={13} /></button></div>)}
            {images.length < 4 && <button onClick={() => file.current?.click()} className="grid size-24 place-items-center rounded-md border-2 border-dashed border-line-strong text-fg-3 hover:text-fg"><Camera size={24} /></button>}
          </div>
          <input ref={file} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={async (e) => { const fs = [...(e.target.files ?? [])].slice(0, 4 - images.length); const out = await Promise.all(fs.map((f) => compress(f))); setImages([...images, ...out]); e.target.value = ''; }} />
          <p className="text-[12px] text-fg-3">{L('حتى 4 صور لنفس الوجبة من زوايا مختلفة.', 'Up to 4 photos of the same meal from different angles.')}</p>
          <Textarea label={L('وصف (اختياري)', 'Description (optional)')} value={text} onChange={(e) => setText(e.target.value)} placeholder={L('مثال: كبسة دجاج، صحن متوسط', 'e.g. chicken kabsa, medium plate')} />
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-lg font-black">{res.mealName}</span>{res.confidence != null && <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', res.confidence >= 70 ? 'bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-success' : res.confidence >= 40 ? 'bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] text-warning' : 'bg-[color-mix(in_oklab,var(--danger)_15%,transparent)] text-danger')}>{L('الثقة', 'Confidence')} {res.confidence}%</span>}<span className="flex-1" /><Segmented size="sm" value={type} onChange={setType} options={TYPES.map(([v, i]) => ({ value: v, label: i }))} /></div>
          {res.message && <p className="mb-3 text-sm text-fg-2">{res.message}</p>}
          <ul className="divide-y divide-line">
            {res.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={on[i]} onChange={() => setOn(on.map((x, j) => (j === i ? !x : x)))} aria-label={it.name} />
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{it.name}{it.brand ? ` · ${it.brand}` : ''}</div><div className="num text-[12px] text-fg-3">{it.weightG ? `${it.weightG.low}–${it.weightG.high}g (≈${it.weightG.likely}) · ` : ''}P {it.protein} · C {it.carbs} · F {it.fat}{it.cookingMethod ? ` · ${it.cookingMethod}` : ''}</div></div>
                <span className="num font-black">{it.cal}</span>
              </li>
            ))}
          </ul>
          {!!res.tips?.length && <ul className="mt-3 space-y-1 rounded-md bg-surface-2 p-3 text-sm">{res.tips.map((t, i) => <li key={i}>{tips[t.tone] ?? '•'} {t.text}</li>)}</ul>}
          <p className="mt-3 text-[11px] text-fg-3">{L('هذه تقديرات من صورة وقد تختلف عن الواقع.', 'These are photo-based estimates and may differ from reality.')}</p>
        </div>
      )}
    </Modal>
  );
}

/** Meal detail with portion rescaling (v4 feature): changing grams rescales all nutrients proportionally. */
function MealDetail({ m, onClose }: { m: Meal; onClose: () => void }) {
  const { L } = useI18n();
  const photo = useRecord<{ data_url: string }>(m.data.photo_id);
  const [edit, setEdit] = useState(false);
  const [grams, setGrams] = useState(m.data.grams ?? 0);
  const rescale = async () => {
    if (!m.data.grams || !grams || grams === m.data.grams) return;
    const f = grams / m.data.grams;
    const r = (v?: number | null) => (v == null ? v : Math.round(v * f));
    await update<MealData>(m.id, { data: { grams, calories: r(m.data.calories)!, protein: r(m.data.protein)!, carbs: r(m.data.carbs)!, fat: r(m.data.fat)!, fiber: r(m.data.fiber), sugar: r(m.data.sugar), sodium: r(m.data.sodium) } });
    toast(L('عُدّلت الكمية', 'Portion updated'));
    onClose();
  };
  const range = (m.data.extra?.weightG as { low: number; high: number } | undefined);
  if (edit) return <MealEditor initial={m.data} day={m.date!} edit={m} onClose={onClose} />;
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={m.data.name}
      footer={<>
        <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(m.id); onClose(); undoToast(L('حُذفت', 'Deleted'), async () => { if (p) await revertTo(p as Rec); }); }}><Trash2 size={17} /></IconButton>
        <Button variant="ghost" onClick={() => setEdit(true)}>{L('تعديل', 'Edit')}</Button>
      </>}>
      {photo?.data.data_url && <img src={photo.data.data_url} alt="" className="mb-3 max-h-64 w-full rounded-md object-cover" />}
      <div className="grid grid-cols-4 gap-3"><Stat label="kcal" value={Math.round(m.data.calories)} /><Stat label="P" value={`${Math.round(m.data.protein)}g`} /><Stat label="C" value={`${Math.round(m.data.carbs)}g`} /><Stat label="F" value={`${Math.round(m.data.fat)}g`} /></div>
      {(m.data.fiber != null || m.data.sugar != null || m.data.sodium != null) && <p className="num mt-2 text-sm text-fg-2">{L('ألياف', 'Fiber')} {m.data.fiber ?? '—'}g · {L('سكر', 'Sugar')} {m.data.sugar ?? '—'}g · {L('صوديوم', 'Sodium')} {m.data.sodium ?? '—'}mg</p>}
      {m.data.estimated && <p className="mt-2 text-[12px] text-fg-3">{L('قيم تقديرية', 'Estimated values')}{m.data.confidence != null ? ` · ${L('الثقة', 'confidence')} ${m.data.confidence}%` : ''}{range ? ` · ${range.low}–${range.high}g` : ''}</p>}
      {!!m.data.grams && (
        <div className="mt-4 flex items-end gap-2 rounded-md bg-surface-2 p-3">
          <Input className="flex-1" type="number" label={L('الكمية الفعلية (جرام)', 'Actual portion (g)')} value={grams} onChange={(e) => setGrams(Number(e.target.value) || 0)} />
          <Button onClick={rescale} disabled={grams === m.data.grams}>{L('أعد الحساب', 'Rescale')}</Button>
        </div>
      )}
    </Modal>
  );
}
