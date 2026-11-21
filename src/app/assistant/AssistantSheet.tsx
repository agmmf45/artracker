import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, RotateCcw, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { api, ApiError } from '@/core/api';
import { toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Switch } from '@/design/ui';
import { buildContext } from './context';
import { apply, asText, describe, undo, type Proposal } from './actions';
import { noticed, type Notice } from './noticed';

interface Card { p: Proposal; state: 'pending' | 'added' | 'skipped'; ids?: string[] }
interface Msg { role: 'user' | 'assistant'; text: string; cards?: Card[] }

const KEY = 'dq_assistant_v1';
const load = (): Msg[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; msgs: Msg[] } | null; return v && Date.now() - v.at < 12 * 3600e3 ? v.msgs : []; } catch { return []; } };
const keep = (msgs: Msg[]) => { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), msgs: msgs.slice(-30) })); } catch { /* storage off */ } };

/**
 * ✦ The app-wide assistant: what it noticed today, a chat, and proposed changes as cards that are
 * saved only when you tap "Add" (and can be undone). It reads a snapshot of your data built on this
 * device, limited to what Settings › Privacy allows.
 */
export function AssistantSheet({ open, onOpenChange, onQuickAdd }: { open: boolean; onOpenChange: (v: boolean) => void; onQuickAdd: () => void }) {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const ai = settings.privacy.ai;
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Notice[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { keep(msgs); requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'end' })); }, [msgs]);
  useEffect(() => { if (open) void noticed(settings).then(setNotes).catch(() => setNotes([])); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (q: string) => {
    const ask = q.trim();
    if (!ask || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: ask }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const transcript = next.slice(-16).map((m) => ({
        role: m.role,
        text: [m.text, ...(m.cards ?? []).map((c) => asText(c.p, c.state))].filter(Boolean).join('\n') || '…',
      }));
      while (transcript.length && transcript[0].role !== 'user') transcript.shift();
      const context = await buildContext(settings, locale);
      const r = await api<{ text: string; actions: Proposal[] }>('/ai/assistant', { messages: transcript, context });
      setMsgs((m) => [...m, { role: 'assistant', text: r.text || (r.actions.length ? L('جهّزت لك هذا:', 'Here you go:') : '…'), cards: r.actions.map((p) => ({ p, state: 'pending' })) }]);
    } catch (e) {
      const msg = e instanceof ApiError && e.code === 'ai_unavailable' ? L('المساعد غير مفعّل على الخادم.', 'The assistant isn’t enabled on the server.')
        : e instanceof ApiError && e.status === 0 ? L('أنت بدون اتصال — جرّب بعدين.', 'You’re offline — try again later.')
        : e instanceof ApiError && e.status === 429 ? L('وصلت حد الاستخدام لهالساعة، جرّب بعد شوي.', 'Usage limit for this hour reached — try again soon.')
        : e instanceof Error ? e.message : String(e);
      setMsgs((m) => [...m, { role: 'assistant', text: `⚠️ ${msg}` }]);
    } finally { setBusy(false); }
  };

  const act = async (mi: number, ci: number, add: boolean) => {
    const card = msgs[mi].cards![ci];
    if (!add) { setMsgs((m) => m.map((x, i) => (i !== mi ? x : { ...x, cards: x.cards!.map((c, j) => (j === ci ? { ...c, state: 'skipped' } : c)) }))); return; }
    try {
      const ids = await apply(card.p, settings);
      setMsgs((m) => m.map((x, i) => (i !== mi ? x : { ...x, cards: x.cards!.map((c, j) => (j === ci ? { ...c, state: 'added', ids } : c)) })));
      toast(L('انضاف ✓', 'Added ✓'), { action: { label: L('تراجع', 'Undo'), run: async () => { await undo(ids); setMsgs((m) => m.map((x, i) => (i !== mi ? x : { ...x, cards: x.cards!.map((c, j) => (j === ci ? { ...c, state: 'pending', ids: undefined } : c)) }))); } } });
    } catch (e) { toast(e instanceof Error ? e.message : String(e), { tone: 'error' }); }
  };

  const chips = [L('خطّط يومي', 'Plan my day'), L('رتّب أسبوعي', 'Plan my week'), L('وش فاتني؟', 'What did I miss?'), L('لخّص أسبوعي', 'Sum up my week')];

  const body = !ai.enabled ? (
    <div className="flex flex-col gap-4 py-2">
      <p className="text-[15px] leading-relaxed">{L('المساعد يقرأ يومك ومهامك ودراستك عشان يقترح ويرتب معك. ما يغيّر شي إلا إذا ضغطت «أضف».', 'The assistant reads your day, tasks and studies to suggest and plan with you. Nothing changes unless you tap “Add”.')}</p>
      <div className="flex flex-col gap-2 rounded-md border border-line p-3">
        <Switch checked={ai.health} onChange={(v) => void updateSettings({ privacy: { ai: { health: v } } })} label={L('يشوف صحتي (ماء، نوم، تمارين)', 'Can see my health (water, sleep, workouts)')} />
        <Switch checked={ai.finance} onChange={(v) => void updateSettings({ privacy: { ai: { finance: v } } })} label={L('يشوف مصاريفي', 'Can see my spending')} />
        <Switch checked={ai.journal} onChange={(v) => void updateSettings({ privacy: { ai: { journal: v } } })} label={L('يقرأ يومياتي', 'Can read my journal')} />
      </div>
      <p className="text-[12.5px] text-fg-3">{L('يُرسل ملخص بياناتك مع كل سؤال لخدمة Claude من Anthropic، ولا يُستخدم لتدريب النماذج. تقدر تغيّر هذا من الإعدادات › الخصوصية.', 'A summary of your data is sent with each question to Anthropic’s Claude and isn’t used for training. Change this in Settings › Privacy.')}</p>
      <button onClick={() => void updateSettings({ privacy: { ai: { enabled: true } } })} className="h-11 rounded-full bg-fg text-[15px] font-bold text-bg">{L('فعّل المساعد', 'Turn on the assistant')}</button>
    </div>
  ) : (
    <div className="flex flex-col gap-3 pb-2">
      {!msgs.length && (
        <>
          <p className="nb-title text-[24px] leading-tight">{new Date().getHours() < 12 ? L('صباح الخير', 'Good morning') : L('مساء الخير', 'Good evening')}</p>
          {notes.length > 0 && <p className="-mt-1 text-[13.5px] text-fg-2">{L('شفت كم شي:', 'A few things I noticed:')}</p>}
          {notes.map((n) => (
            <div key={n.key} className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-line bg-surface p-3">
              <div className="flex items-center gap-2 text-[12.5px] font-bold text-fg-2"><span className="size-2 rounded-full" style={{ background: n.color }} />{L(n.area[0], n.area[1])}</div>
              <p className="text-[14.5px] leading-relaxed">{L(n.text[0], n.text[1])}</p>
              <div className="flex flex-wrap gap-1.5">
                {n.quick && <button onClick={async () => { await n.quick!.run(); setNotes((x) => x.filter((y) => y.key !== n.key)); toast(L('تم ✓', 'Done ✓')); }} className="h-9 rounded-full bg-fg px-4 text-[13px] font-bold text-bg">{L(n.quick.label[0], n.quick.label[1])}</button>}
                {n.ask && <button onClick={() => void send(L(n.ask![0], n.ask![1]))} className={clsx('h-9 rounded-full px-4 text-[13px] font-bold', n.quick ? 'bg-surface-2' : 'bg-fg text-bg')}>{L(n.askLabel?.[0] ?? 'ساعدني', n.askLabel?.[1] ?? 'Help me')}</button>}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => <button key={c} onClick={() => void send(c)} className="h-9 rounded-full border-[1.5px] border-line bg-surface px-3.5 text-[13px] font-semibold hover:bg-surface-2">{c}</button>)}
          </div>
        </>
      )}
      {msgs.map((m, mi) => (
        <div key={mi} className={clsx('flex flex-col gap-2', m.role === 'user' ? 'items-start' : 'items-end')}>
          <div className={clsx('max-w-[88%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-[14.5px] leading-relaxed', m.role === 'user' ? 'rounded-es-[4px] bg-fg text-bg' : 'rounded-ee-[4px] border-[1.5px] border-line bg-surface')}>{m.text}</div>
          {(m.cards ?? []).map((c, ci) => {
            const d = describe(c.p, locale);
            return (
              <div key={ci} className={clsx('w-[88%] rounded-[14px] border-[1.5px] p-3', c.state === 'added' ? 'border-[color-mix(in_oklab,var(--success)_45%,var(--border))] bg-[color-mix(in_oklab,var(--success)_10%,var(--surface))]' : c.state === 'skipped' ? 'border-line opacity-55' : 'border-line-strong bg-surface')}>
                <div className="flex items-start gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold" aria-hidden="true">{d.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-bold">{d.title}</div>
                    {d.lines.map((l, k) => <div key={k} className="text-[12.5px] text-fg-2">{l}</div>)}
                  </div>
                </div>
                {c.state === 'pending' && (
                  <div className="mt-2.5 flex gap-1.5">
                    <button onClick={() => void act(mi, ci, true)} className="inline-flex h-9 items-center gap-1 rounded-full bg-fg px-4 text-[13px] font-bold text-bg"><Check size={15} />{c.p.name === 'add_plan' ? L('أضفها كلها', 'Add all') : L('أضف', 'Add')}</button>
                    <button onClick={() => void act(mi, ci, false)} className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 px-3.5 text-[13px] font-bold"><X size={15} />{L('تجاهل', 'Skip')}</button>
                  </div>
                )}
                {c.state === 'added' && <div className="mt-1.5 text-[12.5px] font-bold text-success">✓ {L('انضاف', 'Added')}</div>}
              </div>
            );
          })}
        </div>
      ))}
      {busy && <div className="self-end rounded-[16px] border-[1.5px] border-line bg-surface px-4 py-2.5 text-[14px] text-fg-2" aria-live="polite"><span className="inline-block animate-pulse">{L('يفكّر…', 'Thinking…')}</span></div>}
      <div ref={end} />
    </div>
  );

  const footer = ai.enabled ? (
    <div className="flex w-full flex-col gap-1.5">
      <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex w-full items-center gap-2 rounded-full border-[1.5px] border-line bg-surface ps-4 pe-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder={L('اكتب أي شي… «ذكرني أشتري حليب بكرة 5»', 'Ask anything… “remind me to buy milk tomorrow at 5”')} aria-label={L('اكتب للمساعد', 'Message the assistant')}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3" />
        <button type="submit" disabled={busy || !text.trim()} aria-label={L('إرسال', 'Send')} className="grid size-10 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-40"><Send size={17} className="rtl:-scale-x-100" /></button>
      </form>
      <div className="flex items-center justify-between text-[12.5px] font-semibold text-fg-3">
        <button type="button" onClick={() => { onOpenChange(false); onQuickAdd(); }} className="px-1 py-1 hover:text-fg-2">+ {L('إضافة سريعة بدون مساعد', 'Quick add without the assistant')}</button>
        {msgs.length > 0 && <button type="button" onClick={() => setMsgs([])} className="inline-flex items-center gap-1 px-1 py-1 hover:text-fg-2"><RotateCcw size={13} />{L('محادثة جديدة', 'New chat')}</button>}
      </div>
    </div>
  ) : undefined;

  return (
    <Modal open={open} onOpenChange={onOpenChange} panel
      title={<span className="inline-flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-fg text-reward"><Sparkles size={16} /></span>{L('مساعد دقيق', 'Daqeeq assistant')}</span>}
      description={L('يقترح ويرتّب معك — وما يغيّر شي إلا بموافقتك', 'Suggests and plans with you — changes nothing without your OK')}
      footer={footer}>
      {body}
    </Modal>
  );
}
