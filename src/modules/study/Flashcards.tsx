import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Layers, Play, Upload, Download, Trash2, Sparkles, ArrowRight, ArrowLeft, Pencil } from 'lucide-react';
import type { Rec } from '@shared/records';
import type { Grade } from 'ts-fsrs';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { bulk, create, remove, update } from '@/core/repo';
import { todayKey } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { api } from '@/core/api';
import { download } from '@/core/portability';
import { toast } from '@/core/toast';
import { confirm, Modal, prompt } from '@/design/overlay';
import { Button, Card, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Stat, Textarea } from '@/design/ui';
import { Markdown } from '@/modules/shared/markdown';
import { cloze, fmtInterval, isDue, newSrs, previewIntervals, RATINGS, review, type SrsState } from './srs';
import { CourseSelect, courseLabel, useCourses } from './shared';
import type { LectureData } from './model';

interface DeckData { name: string; course_id: string | null; lecture_id?: string | null }
interface CardData { deck_id: string; type: 'basic' | 'cloze'; front: string; back: string; image_url: string | null; tags: string[]; srs: SrsState; lecture_id?: string | null }
type CardRec = Rec<CardData>;

export default function Flashcards() {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const decks = useRecords<DeckData>('deck');
  const cards = useRecords<CardData>('flashcard');
  const lectures = useRecords<LectureData>('lecture');
  const courses = useCourses();
  const [params] = useSearchParams();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [studying, setStudying] = useState<CardRec[] | null>(null);
  const [editCard, setEditCard] = useState<CardRec | 'new' | null>(null);
  const [newDeck, setNewDeck] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const lectureFilter = params.get('lecture');

  const dueOf = (id?: string) => (cards ?? []).filter((c) => (!id || c.data.deck_id === id) && isDue(c.data.srs, now));
  const deck = (decks ?? []).find((d) => d.id === deckId);
  const deckCards = (cards ?? []).filter((c) => c.data.deck_id === deckId && (!lectureFilter || c.data.lecture_id === lectureFilter));
  const reviewsToday = useRecords<{ card_id: string; rating: number }>('card_review');
  const todayCount = (reviewsToday ?? []).filter((r) => r.date === todayKey()).length;

  const exportDeck = () => {
    if (!deck) return;
    const rows = deckCards.map((c) => [c.data.front, c.data.back, c.data.tags.join(' ')].map((x) => x.replace(/\t/g, ' ').replace(/\n/g, '<br>')).join('\t'));
    download(`${deck.data.name}.txt`, rows.join('\n'), 'text/plain;charset=utf-8');
  };
  const importDeck = async (f?: File) => {
    if (!f || !deckId) return;
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
    const sep = lines[0]?.includes('\t') ? '\t' : ',';
    const existing = new Set(deckCards.map((c) => c.data.front.trim()));
    let added = 0;
    await bulk(async () => {
      for (const l of lines.slice(0, 5000)) {
        const [front, back = '', tags = ''] = l.split(sep).map((x) => x.replace(/<br\s*\/?>/gi, '\n').replace(/^"|"$/g, '').trim());
        if (!front || existing.has(front)) continue;
        await create<CardData>('flashcard', { deck_id: deckId, type: /\{\{c\d+::/.test(front) ? 'cloze' : 'basic', front, back, image_url: null, tags: tags ? tags.split(/\s+/) : [], srs: newSrs() }, { parent_id: deckId });
        existing.add(front); added++;
      }
    });
    toast(L(`استوردنا ${added} بطاقة (المكرر تُجوهل)`, `Imported ${added} cards (duplicates skipped)`));
    if (fileRef.current) fileRef.current.value = '';
  };
  const aiGenerate = async () => {
    if (!deckId) return;
    const text = await prompt(L('الصق نص الملاحظات أو المحاضرة', 'Paste lecture or note text'), { placeholder: '…' });
    if (!text?.trim()) return;
    try {
      const r = await api<{ result: { cards: Array<{ type: 'basic' | 'cloze'; front: string; back: string }> } }>('/ai/flashcards', { input: { text, count: 15 } });
      const list = r.result.cards ?? [];
      if (!(await confirm(L(`أضيف ${list.length} بطاقة؟`, `Add ${list.length} cards?`), { message: list.slice(0, 8).map((c) => `• ${c.front}`).join('\n') }))) return;
      for (const c of list) await create<CardData>('flashcard', { deck_id: deckId, type: c.type === 'cloze' ? 'cloze' : 'basic', front: c.front, back: c.back ?? '', image_url: null, tags: ['ai'], srs: newSrs() }, { parent_id: deckId });
    } catch (e) { toast((e as Error).message, { tone: 'error' }); }
  };

  if (studying) return <ReviewSession cards={studying} onDone={() => setStudying(null)} />;

  if (deck) {
    const due = deckCards.filter((c) => isDue(c.data.srs, now));
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-3" icon={lang === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />} onClick={() => setDeckId(null)}>{L('المجموعات', 'Decks')}</Button>
        <PageHeader title={deck.data.name} subtitle={`${courseLabel(courses.find((c) => c.id === deck.data.course_id))} · ${deckCards.length} ${L('بطاقة', 'cards')}`}
          actions={<>
            <IconButton label={L('استيراد (Anki txt / CSV)', 'Import (Anki txt / CSV)')} onClick={() => fileRef.current?.click()}><Upload size={18} /></IconButton>
            <IconButton label={L('تصدير', 'Export')} onClick={exportDeck}><Download size={18} /></IconButton>
            {settings.privacy.ai.enabled && <IconButton label={L('أنشئ بالذكاء', 'Generate with AI')} onClick={aiGenerate}><Sparkles size={18} /></IconButton>}
            <IconButton tone="danger" label={L('حذف المجموعة', 'Delete deck')} onClick={async () => { if (await confirm(L('حذف المجموعة وبطاقاتها؟', 'Delete deck and its cards?'), { danger: true })) { for (const c of deckCards) await remove(c.id); await remove(deck.id); setDeckId(null); } }}><Trash2 size={18} /></IconButton>
            <Button icon={<Plus size={16} />} onClick={() => setEditCard('new')}>{L('بطاقة', 'Card')}</Button>
            <Button variant="primary" icon={<Play size={16} />} disabled={!due.length} onClick={() => setStudying(due.sort(() => Math.random() - 0.5))}>{L(`راجع ${due.length}`, `Review ${due.length}`)}</Button>
          </>} />
        <input ref={fileRef} type="file" accept=".txt,.csv,.tsv" className="sr-only" onChange={(e) => importDeck(e.target.files?.[0])} />
        {!deckCards.length ? <EmptyState icon={<Layers size={28} />} title={L('أضف بطاقات أو استورد من Anki', 'Add cards or import from Anki')} hint={L('ملف نصي: سؤال<TAB>جواب<TAB>وسوم، أو CSV.', 'Text file: front<TAB>back<TAB>tags, or CSV.')} /> : (
          <Card className="divide-y divide-line">
            {deckCards.map((c) => (
              <button key={c.id} onClick={() => setEditCard(c)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate text-sm">{c.data.type === 'cloze' ? cloze(c.data.front).question : c.data.front}</span>
                <span className="num text-[11px] text-fg-3">{isDue(c.data.srs, now) ? L('مستحقة', 'due') : fmtInterval((Date.parse(c.data.srs.due) - now.getTime()) / 60000, lang)}</span>
                <Pencil size={14} className="text-fg-3" />
              </button>
            ))}
          </Card>
        )}
        {editCard && <CardEditor deckId={deck.id} card={editCard === 'new' ? null : editCard} lectures={(lectures ?? []).filter((l) => !deck.data.course_id || l.data.course_id === deck.data.course_id)} defaultLecture={lectureFilter} onClose={() => setEditCard(null)} />}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={L('البطاقات', 'Flashcards')} subtitle={L('تكرار متباعد بخوارزمية FSRS المفتوحة.', 'Spaced repetition with the open FSRS algorithm.')}
        actions={<><Button icon={<Plus size={16} />} onClick={() => setNewDeck(true)}>{L('مجموعة', 'Deck')}</Button><Button variant="primary" icon={<Play size={16} />} disabled={!dueOf().length} onClick={() => setStudying(dueOf().sort(() => Math.random() - 0.5))}>{L(`راجع الكل (${dueOf().length})`, `Review all (${dueOf().length})`)}</Button></>} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label={L('مستحقة الآن', 'Due now')} value={dueOf().length} /></Card>
        <Card className="p-4"><Stat label={L('راجعت اليوم', 'Reviewed today')} value={todayCount} /></Card>
        <Card className="p-4"><Stat label={L('إجمالي البطاقات', 'Total cards')} value={cards?.length ?? 0} /></Card>
      </div>
      {!decks?.length ? <EmptyState icon={<Layers size={30} />} title={L('أنشئ أول مجموعة بطاقات', 'Create your first deck')} hint={L('مجموعة لكل مقرر أو محاضرة.', 'One deck per course or lecture.')} action={<Button variant="primary" onClick={() => setNewDeck(true)}>{L('مجموعة جديدة', 'New deck')}</Button>} /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => {
            const total = (cards ?? []).filter((c) => c.data.deck_id === d.id).length;
            const due = dueOf(d.id).length;
            return (
              <button key={d.id} onClick={() => setDeckId(d.id)} className="card p-4 text-start hover:border-line-strong">
                <div className="text-[12px] text-fg-3">{courseLabel(courses.find((c) => c.id === d.data.course_id))}</div>
                <div className="text-lg font-bold">{d.data.name}</div>
                <div className="mt-2 flex gap-3 text-sm"><span className="num">{total} {L('بطاقة', 'cards')}</span>{due > 0 && <span className="num font-bold text-study">{due} {L('مستحقة', 'due')}</span>}</div>
              </button>
            );
          })}
        </div>
      )}
      {newDeck && <DeckCreator onClose={() => setNewDeck(false)} onCreated={setDeckId} />}
    </div>
  );
}

function DeckCreator({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { L } = useI18n();
  const [name, setName] = useState('');
  const [course, setCourse] = useState<string | null>(null);
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('مجموعة جديدة', 'New deck')}
      footer={<><Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" disabled={!name.trim()} onClick={async () => { const r = await create<DeckData>('deck', { name: name.trim(), course_id: course }, { parent_id: course }); onCreated(r.id); onClose(); }}>{L('إنشاء', 'Create')}</Button></>}>
      <div className="space-y-3"><Input label={L('الاسم', 'Name')} value={name} onChange={(e) => setName(e.target.value)} autoFocus /><CourseSelect label={L('المقرر', 'Course')} value={course} onChange={setCourse} /></div>
    </Modal>
  );
}

function CardEditor({ deckId, card, lectures, defaultLecture, onClose }: { deckId: string; card: CardRec | null; lectures: Array<Rec<LectureData>>; defaultLecture: string | null; onClose: () => void }) {
  const { L } = useI18n();
  const [type, setType] = useState<CardData['type']>(card?.data.type ?? 'basic');
  const [front, setFront] = useState(card?.data.front ?? '');
  const [back, setBack] = useState(card?.data.back ?? '');
  const [img, setImg] = useState(card?.data.image_url ?? '');
  const [lecture, setLecture] = useState<string | null>(card?.data.lecture_id ?? defaultLecture);
  const save = async (again: boolean) => {
    if (!front.trim()) return;
    if (type === 'cloze' && !/\{\{c\d+::/.test(front)) { toast(L('استخدم {{c1::الإجابة}} في بطاقة الإكمال', 'Use {{c1::answer}} in a cloze card'), { tone: 'error' }); return; }
    const data = { type, front: front.trim(), back: back.trim(), image_url: img.trim() || null, lecture_id: lecture };
    if (card) await update<CardData>(card.id, { data });
    else await create<CardData>('flashcard', { deck_id: deckId, tags: [], srs: newSrs(), ...data }, { parent_id: deckId });
    if (again && !card) { setFront(''); setBack(''); setImg(''); } else onClose();
  };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={card ? L('تعديل البطاقة', 'Edit card') : L('بطاقة جديدة', 'New card')}
      footer={<>
        {card && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { await remove(card.id); onClose(); }}><Trash2 size={17} /></IconButton>}
        {!card && <Button variant="ghost" onClick={() => save(true)}>{L('حفظ وإضافة أخرى', 'Save & add another')}</Button>}
        <Button variant="primary" onClick={() => save(false)}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="space-y-3">
        <Segmented value={type} onChange={setType} options={[{ value: 'basic', label: L('سؤال وجواب', 'Q & A') }, { value: 'cloze', label: L('إكمال فراغ', 'Cloze') }]} />
        <Textarea label={type === 'cloze' ? L('النص مع {{c1::الإجابة}}', 'Text with {{c1::answer}}') : L('الوجه (سؤال)', 'Front (question)')} value={front} onChange={(e) => setFront(e.target.value)} autoFocus />
        <Textarea label={type === 'cloze' ? L('ملاحظة إضافية (اختياري)', 'Extra (optional)') : L('الظهر (جواب)', 'Back (answer)')} value={back} onChange={(e) => setBack(e.target.value)} />
        <Input type="url" dir="ltr" label={L('رابط صورة (اختياري)', 'Image URL (optional)')} value={img} onChange={(e) => setImg(e.target.value)} />
        <Select label={L('المحاضرة', 'Lecture')} value={lecture ?? ''} onChange={(e) => setLecture(e.target.value || null)}><option value="">—</option>{lectures.map((l) => <option key={l.id} value={l.id}>{l.data.title}</option>)}</Select>
      </div>
    </Modal>
  );
}

function ReviewSession({ cards, onDone }: { cards: CardRec[]; onDone: () => void }) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const [queue, setQueue] = useState(cards);
  const [shown, setShown] = useState(false);
  const [count, setCount] = useState(0);
  const c = queue[0];
  const intervals = useMemo(() => (c ? previewIntervals(c.data.srs) : {}), [c]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!c) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setShown(true); }
      if (shown && ['1', '2', '3', '4'].includes(e.key)) void rate(RATINGS[Number(e.key) - 1].r);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rate = async (r: Grade) => {
    if (!c) return;
    const next = review(c.data.srs, r);
    await update<CardData>(c.id, { data: { srs: next } });
    await create('card_review', { card_id: c.id, rating: r }, { date: todayKey(), parent_id: c.id });
    const n = count + 1;
    setCount(n);
    const rest = queue.slice(1);
    // "Again" cards come back in this session
    setQueue(r === 1 ? [...rest, { ...c, data: { ...c.data, srs: next } }] : rest);
    setShown(false);
    if (n === 10) await grantXp(`flashcards:${todayKey()}`, 'flashcards', settings, L('مراجعة بطاقات', 'Flashcard review'));
  };

  if (!c) return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div><div className="text-4xl">🎉</div><p className="mt-3 text-xl font-black">{L('خلصت المراجعة', 'Review complete')}</p><p className="num mt-1 text-fg-2">{count} {L('بطاقة', 'cards')}</p><Button className="mt-5" variant="primary" onClick={onDone}>{L('رجوع', 'Back')}</Button></div>
    </div>
  );
  const isCloze = c.data.type === 'cloze';
  const q = isCloze ? cloze(c.data.front).question : c.data.front;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center text-sm text-fg-2"><span className="num flex-1">{L('متبقي', 'Left')} {queue.length}</span><Button size="sm" variant="ghost" onClick={onDone}>{L('إنهاء', 'End')}</Button></div>
      <Card className="min-h-72 p-6 md:p-10">
        <div className="text-xl"><Markdown text={q} /></div>
        {c.data.image_url && <img src={c.data.image_url} alt="" className="mt-4 max-h-64 rounded-md" referrerPolicy="no-referrer" />}
        {shown && <div className="anim-in mt-6 border-t border-line pt-6 text-lg"><Markdown text={isCloze ? `${cloze(c.data.front).answer}${c.data.back ? `\n\n${c.data.back}` : ''}` : c.data.back} /></div>}
      </Card>
      <div className="mt-4">
        {!shown ? <Button variant="primary" size="lg" className="w-full" onClick={() => setShown(true)}>{L('أظهر الجواب', 'Show answer')} <span className="text-[11px] opacity-70">(Space)</span></Button> : (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((x, i) => (
              <button key={x.r} onClick={() => rate(x.r)} className="rounded-md border border-line bg-surface py-3 text-center hover:bg-surface-2" style={{ borderBottom: `3px solid ${x.tone}` }}>
                <div className="font-bold">{L(x.ar, x.en)}</div><div className="num text-[11px] text-fg-3">{fmtInterval(intervals[x.r] ?? 0, lang)} · {i + 1}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
