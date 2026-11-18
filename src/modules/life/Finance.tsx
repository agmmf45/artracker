import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Wallet as WalletIcon, PiggyBank, Sparkles, Trash2, Pencil, ChevronLeft, ChevronRight, Printer, Search, ArrowLeftRight, Archive } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecords, useSettings } from '@/core/hooks';
import { bulk, create, remove, revertTo, update } from '@/core/repo';
import { fmtDate, rangeKeys, todayKey } from '@/core/dates';
import { api } from '@/core/api';
import { toast, undoToast } from '@/core/toast';
import { confirm, Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Stat, Textarea } from '@/design/ui';
import { Bars, Donut, Legend } from '@/design/charts';
import type { Txn, TxnData, Wallet, WalletData } from '@/modules/shared/domain';
import { isSpending, monthKey, parseExpensesLocally, walletBalance, type ParsedTxn } from './finance/model';

const VIZ = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)', 'var(--text-3)'];
const ICONS = ['💰', '💳', '🏦', '👛', '💵', '🎯', '🏠', '✈️', '🎓', '🚗'];

export default function Finance() {
  const { L, locale, fmtNum } = useI18n();
  const settings = useSettings();
  const wallets = useRecords<WalletData>('wallet') as Wallet[] | undefined;
  const txns = useRecords<TxnData>('txn') as Txn[] | undefined;
  const budgets = useRecords<{ category: string; amount: number }>('budget');
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [walletFilter, setWalletFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [editWallet, setEditWallet] = useState<Wallet | 'new' | null>(null);
  const [txnOpen, setTxnOpen] = useState<{ t: Txn | null; kind?: TxnData['kind']; walletId?: string } | null>(null);
  const [ai, setAi] = useState<{ text: string; auto: boolean } | null>(null);
  const [report, setReport] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const cur = settings.currency;
  const money = (n: number) => `${fmtNum(Math.round(n * 100) / 100, { maximumFractionDigits: 2 })} ${cur}`;

  // Bank SMS hand-off (?sms=…&auto=1 from an iOS Shortcut — kept from v4)
  useEffect(() => {
    const sms = sessionStorage.getItem('_pendingSMS');
    if (sms) {
      const auto = sessionStorage.getItem('_pendingAuto') === '1';
      sessionStorage.removeItem('_pendingSMS'); sessionStorage.removeItem('_pendingAuto');
      setAi({ text: sms, auto });
    }
    if (params.get('ai')) { params.delete('ai'); setParams(params, { replace: true }); setAi({ text: '', auto: false }); }
  }, [params, setParams]);

  const active = (wallets ?? []).filter((w) => !!w.data.archived === showArchived).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const all = txns ?? [];
  const inMonth = all.filter((t) => monthKey(t.date ?? '') === month);
  const spentMonth = inMonth.filter(isSpending).reduce((s, t) => s + t.data.amount, 0);
  const incomeMonth = inMonth.filter((t) => t.data.kind === 'income' && !t.data.saving).reduce((s, t) => s + t.data.amount, 0);
  const savedMonth = inMonth.filter((t) => t.data.saving || (t.data.kind === 'transfer' && (wallets ?? []).find((w) => w.id === t.data.to_wallet_id)?.data.kind === 'savings')).reduce((s, t) => s + t.data.amount, 0);
  const totalBalance = (wallets ?? []).filter((w) => !w.data.archived && w.data.kind === 'regular').reduce((s, w) => s + walletBalance(w, all), 0);
  const totalSaved = (wallets ?? []).filter((w) => !w.data.archived && w.data.kind === 'savings').reduce((s, w) => s + walletBalance(w, all), 0);
  const budget = settings.finance.monthlyBudget;

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of inMonth.filter(isSpending)) m.set(t.data.category ?? L('أخرى', 'Other'), (m.get(t.data.category ?? L('أخرى', 'Other')) ?? 0) + t.data.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [inMonth, L]);
  const days = rangeKeys(`${month}-01`, new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate());
  const daily = days.map((d) => ({ label: d.slice(8), value: inMonth.filter((t) => t.date === d && isSpending(t)).reduce((s, t) => s + t.data.amount, 0) }));
  const list = inMonth.filter((t) => (!walletFilter || t.data.wallet_id === walletFilter || t.data.to_wallet_id === walletFilter) && (!q || `${t.data.description} ${t.data.category ?? ''}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.created_at.localeCompare(a.created_at));
  const shiftMonth = (n: number) => { const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const wName = (id?: string | null) => (wallets ?? []).find((w) => w.id === id)?.data.name ?? '—';

  const deleteTxn = async (t: Txn) => {
    const prev = await remove(t.id);
    undoToast(L('حُذفت المعاملة', 'Transaction deleted'), async () => { if (prev) await revertTo(prev as Rec); });
  };
  const deleteWallet = async (w: Wallet) => {
    const linked = all.filter((t) => t.data.wallet_id === w.id || t.data.to_wallet_id === w.id);
    if (!(await confirm(L(`حذف «${w.data.name}»؟`, `Delete “${w.data.name}”?`), { message: L(`تُحذف معها ${linked.length} معاملة (يمكن التراجع). الأفضل غالباً الأرشفة.`, `Its ${linked.length} transactions go with it (undoable). Archiving is usually better.`), danger: true }))) return;
    const prevs: Rec[] = [];
    await bulk(async () => { for (const t of linked) { const p = await remove(t.id); if (p) prevs.push(p); } const p = await remove(w.id); if (p) prevs.push(p); });
    setEditWallet(null);
    undoToast(L('حُذفت المحفظة', 'Wallet deleted'), async () => { for (const p of prevs) await revertTo(p); });
  };

  return (
    <div>
      <PageHeader title={L('المال', 'Finance')} subtitle={L('بدون ربط بنكي — بياناتك عندك.', 'No bank connection — your data stays yours.')}
        actions={<>
          <IconButton label={L('تقرير الشهر', 'Monthly report')} onClick={() => setReport(true)}><Printer size={18} /></IconButton>
          <Button icon={<Sparkles size={16} />} onClick={() => setAi({ text: '', auto: false })}>{L('سجّل من نص / رسالة بنك', 'From text / bank SMS')}</Button>
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => setTxnOpen({ t: null })}>{L('معاملة', 'Transaction')}</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={L('الرصيد', 'Balance')} value={money(totalBalance)} tone={totalBalance < 0 ? 'var(--danger)' : undefined} /></Card>
        <Card className="p-4"><Stat label={L('مصروف الشهر', 'Spent this month')} value={money(spentMonth)} sub={budget ? `${Math.round((spentMonth / budget) * 100)}% ${L('من الميزانية', 'of budget')}` : undefined} />{budget ? <Bar className="mt-2" value={spentMonth} max={budget} color={spentMonth > budget ? 'var(--danger)' : 'var(--life)'} /> : null}</Card>
        <Card className="p-4"><Stat label={L('دخل الشهر', 'Income this month')} value={money(incomeMonth)} /></Card>
        <Card className="p-4"><Stat label={L('المدّخر', 'Savings')} value={money(totalSaved)} sub={`+${money(savedMonth)} ${L('هذا الشهر', 'this month')}`} tone="var(--success)" /></Card>
      </div>

      {/* wallets */}
      <div className="mb-2 flex items-center gap-2"><h2 className="flex-1 text-[13px] font-bold text-fg-2">{L('المحافظ', 'Wallets')}</h2><Chip active={showArchived} onClick={() => setShowArchived(!showArchived)}><Archive size={12} />{L('المؤرشفة', 'Archived')}</Chip><Button size="sm" icon={<Plus size={14} />} onClick={() => setEditWallet('new')}>{L('محفظة', 'Wallet')}</Button></div>
      {!active.length ? <EmptyState icon={<WalletIcon size={28} />} title={L('أنشئ محفظتك الأولى', 'Create your first wallet')} hint={L('محفظة عادية للصرف، ومحفظة ادخار بهدف.', 'A regular wallet for spending, a savings wallet with a goal.')} action={<Button variant="primary" onClick={() => setEditWallet('new')}>{L('محفظة جديدة', 'New wallet')}</Button>} /> : (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {active.map((w) => {
            const bal = walletBalance(w, all);
            const savings = w.data.kind === 'savings';
            return (
              <div key={w.id} className={clsx('card relative p-4', walletFilter === w.id && 'ring-2 ring-accent')} style={savings ? { background: 'color-mix(in oklab, var(--success) 10%, var(--surface))' } : undefined}>
                <button className="block w-full text-start" onClick={() => setWalletFilter(walletFilter === w.id ? '' : w.id)}>
                  <div className="flex items-center gap-2"><span className="text-2xl">{w.data.icon}</span><span className="min-w-0 flex-1 truncate font-bold">{w.data.name}</span>{savings && <PiggyBank size={15} className="text-success" />}</div>
                  <div className={clsx('num mt-2 text-xl font-black', bal < 0 && 'text-danger')}>{money(bal)}</div>
                  {savings && w.data.goal ? <><Bar className="mt-2" value={bal} max={w.data.goal} color="var(--success)" /><div className="num mt-1 text-[11px] text-fg-3">{Math.min(100, Math.round((bal / w.data.goal) * 100))}% {L('من', 'of')} {money(w.data.goal)}</div></> : null}
                </button>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="subtle" onClick={() => setTxnOpen({ t: null, kind: savings ? 'transfer' : 'expense', walletId: w.id })}>{savings ? L('إيداع', 'Deposit') : L('صرف', 'Spend')}</Button>
                  <IconButton size="sm" label={L('تعديل', 'Edit')} onClick={() => setEditWallet(w)}><Pencil size={14} /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* month */}
      <div className="mb-3 flex items-center gap-2">
        <IconButton label={L('الشهر السابق', 'Previous month')} onClick={() => shiftMonth(-1)}><ChevronRight size={18} className="ltr:rotate-180" /></IconButton>
        <div className="min-w-32 text-center font-bold">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))}</div>
        <IconButton label={L('الشهر التالي', 'Next month')} onClick={() => shiftMonth(1)}><ChevronLeft size={18} className="ltr:rotate-180" /></IconButton>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">{L('الصرف اليومي', 'Daily spending')}</div><Bars data={daily} height={120} color="var(--life)" format={(v) => money(v)} /></Card>
        <Card className="p-4">
          <div className="mb-2 text-[13px] font-bold text-fg-2">{L('حسب التصنيف', 'By category')}</div>
          {!byCat.length ? <p className="text-sm text-fg-3">{L('لا صرف هذا الشهر', 'No spending this month')}</p> : (
            <div className="flex items-center gap-4">
              <Donut size={110} parts={byCat.slice(0, 7).map(([c, v], i) => ({ label: c, value: v, color: VIZ[i] }))} center={<span className="num text-[12px] font-bold">{fmtNum(Math.round(spentMonth))}</span>} />
              <div className="min-w-0 flex-1"><Legend items={byCat.slice(0, 7).map(([c, v], i) => {
                const b = (budgets ?? []).find((x) => x.data.category === c)?.data.amount;
                return { label: b ? `${c} (${Math.round((v / b) * 100)}%)` : c, color: VIZ[i], value: fmtNum(Math.round(v)) };
              })} /></div>
            </div>
          )}
          <BudgetEditor budget={budget} onChange={(v) => updateSettings({ finance: { monthlyBudget: v } })} />
        </Card>
      </div>

      {/* transactions */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[13px] font-bold text-fg-2">{L('المعاملات', 'Transactions')} {walletFilter && `· ${wName(walletFilter)}`}</h2>
        <div className="relative w-56"><Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-3" /><input className="field h-9 min-h-0 ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('بحث', 'Search')} /></div>
      </div>
      {!list.length ? <EmptyState title={L('لا معاملات في هذا الشهر', 'No transactions this month')} /> : (
        <Card className="divide-y divide-line">
          {list.map((t) => {
            const sign = t.data.kind === 'income' ? '+' : t.data.kind === 'transfer' ? '⇄' : '−';
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-7 text-center text-lg">{t.data.kind === 'transfer' ? <ArrowLeftRight size={16} className="mx-auto text-fg-3" /> : (t.data.category?.split(' ')[0] ?? '•')}</span>
                <button className="min-w-0 flex-1 text-start" onClick={() => setTxnOpen({ t })}>
                  <div className="truncate text-sm font-bold">{t.data.description || t.data.category || '—'}</div>
                  <div className="text-[12px] text-fg-3">{fmtDate(t.date!, locale, { day: 'numeric', month: 'short' })} · {t.data.kind === 'transfer' ? `${wName(t.data.wallet_id)} → ${wName(t.data.to_wallet_id)}` : wName(t.data.wallet_id)}{t.data.saving ? ` · ${L('ادخار', 'saving')}` : ''}</div>
                </button>
                <span className={clsx('num text-sm font-black', t.data.kind === 'income' ? 'text-success' : t.data.kind === 'transfer' ? 'text-fg-2' : '')}>{sign}{fmtNum(t.data.amount)}</span>
                <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => deleteTxn(t)}><Trash2 size={14} /></IconButton>
              </div>
            );
          })}
        </Card>
      )}

      {editWallet && <WalletEditor w={editWallet === 'new' ? null : editWallet} onClose={() => setEditWallet(null)} onDelete={deleteWallet} />}
      {txnOpen && <TxnEditor t={txnOpen.t} kind={txnOpen.kind} walletId={txnOpen.walletId ?? (walletFilter || undefined)} wallets={(wallets ?? []).filter((w) => !w.data.archived)} onClose={() => setTxnOpen(null)} />}
      {ai && <AiExpense initial={ai.text} auto={ai.auto} wallets={(wallets ?? []).filter((w) => !w.data.archived)} onClose={() => setAi(null)} />}
      {report && <MonthReport month={month} txns={inMonth} spent={spentMonth} income={incomeMonth} saved={savedMonth} byCat={byCat} onClose={() => setReport(false)} money={money} />}
    </div>
  );
}

function BudgetEditor({ budget, onChange }: { budget: number | null; onChange: (v: number | null) => void }) {
  const { L } = useI18n();
  const [v, setV] = useState(budget ? String(budget) : '');
  useEffect(() => setV(budget ? String(budget) : ''), [budget]);
  return (
    <div className="mt-4 flex items-end gap-2 border-t border-line pt-3">
      <Input className="flex-1" type="number" min={0} label={L('ميزانية الشهر', 'Monthly budget')} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onChange(v ? Number(v) : null)} />
    </div>
  );
}

function WalletEditor({ w, onClose, onDelete }: { w: Wallet | null; onClose: () => void; onDelete: (w: Wallet) => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const [d, setD] = useState<WalletData>(w?.data ?? { name: '', icon: '💰', kind: 'regular', initial_balance: 0, goal: null, currency: settings.currency, order: Date.now() });
  const set = (p: Partial<WalletData>) => setD((x) => ({ ...x, ...p }));
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={w ? L('تعديل المحفظة', 'Edit wallet') : L('محفظة جديدة', 'New wallet')}
      footer={<>
        {w && <div className="me-auto flex gap-1"><IconButton tone="danger" label={L('حذف', 'Delete')} onClick={() => onDelete(w)}><Trash2 size={17} /></IconButton><IconButton label={w.data.archived ? L('استعادة', 'Unarchive') : L('أرشفة', 'Archive')} onClick={async () => { await update<WalletData>(w.id, { data: { archived: !w.data.archived } }); onClose(); }}><Archive size={17} /></IconButton></div>}
        <Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" onClick={async () => { if (!d.name.trim()) return; if (w) await update<WalletData>(w.id, { data: d }); else await create<WalletData>('wallet', d); onClose(); }}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="space-y-3">
        <Segmented value={d.kind} onChange={(v) => set({ kind: v })} options={[{ value: 'regular', label: L('عادية', 'Regular') }, { value: 'savings', label: L('ادخار', 'Savings') }]} />
        <Input label={L('الاسم', 'Name')} value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!w} />
        <div className="flex flex-wrap gap-1.5">{ICONS.map((i) => <button key={i} onClick={() => set({ icon: i })} aria-label={i} className={clsx('size-9 rounded-sm text-xl', d.icon === i && 'bg-surface-2 ring-1 ring-line-strong')}>{i}</button>)}</div>
        <Input type="number" label={L('الرصيد الابتدائي', 'Starting balance')} value={d.initial_balance} onChange={(e) => set({ initial_balance: Number(e.target.value) || 0 })} />
        {d.kind === 'savings' && <Input type="number" label={L('هدف الادخار', 'Savings goal')} value={d.goal ?? ''} onChange={(e) => set({ goal: e.target.value ? Number(e.target.value) : null })} />}
      </div>
    </Modal>
  );
}

function TxnEditor({ t, kind, walletId, wallets, onClose }: { t: Txn | null; kind?: TxnData['kind']; walletId?: string; wallets: Wallet[]; onClose: () => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const regular = wallets.filter((w) => w.data.kind === 'regular');
  const target = wallets.find((w) => w.id === walletId);
  const [d, setD] = useState<TxnData>(t?.data ?? {
    kind: kind ?? 'expense', amount: 0, description: '', category: settings.categories.expenses[0] ?? null,
    wallet_id: kind === 'transfer' && target?.data.kind === 'savings' ? (regular[0]?.id ?? '') : (walletId ?? regular[0]?.id ?? wallets[0]?.id ?? ''),
    to_wallet_id: kind === 'transfer' && target?.data.kind === 'savings' ? target.id : null,
  });
  const [date, setDate] = useState(t?.date ?? todayKey());
  const set = (p: Partial<TxnData>) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!d.amount || d.amount <= 0) { toast(L('أدخل مبلغاً صحيحاً', 'Enter a valid amount'), { tone: 'error' }); return; }
    if (!d.wallet_id) { toast(L('أنشئ محفظة أولاً', 'Create a wallet first'), { tone: 'error' }); return; }
    if (d.kind === 'transfer' && (!d.to_wallet_id || d.to_wallet_id === d.wallet_id)) { toast(L('اختر محفظتين مختلفتين', 'Pick two different wallets'), { tone: 'error' }); return; }
    const data = { ...d, category: d.kind === 'expense' ? d.category : null, to_wallet_id: d.kind === 'transfer' ? d.to_wallet_id : null };
    if (t) await update<TxnData>(t.id, { data, date, parent_id: d.wallet_id });
    else await create<TxnData>('txn', data, { date, parent_id: d.wallet_id });
    onClose();
  };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={t ? L('تعديل المعاملة', 'Edit transaction') : L('معاملة جديدة', 'New transaction')}
      footer={<><Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button></>}>
      <div className="space-y-3">
        <Segmented value={d.kind} onChange={(v) => set({ kind: v, to_wallet_id: v === 'transfer' ? (wallets.find((w) => w.id !== d.wallet_id)?.id ?? null) : null })} options={[{ value: 'expense', label: L('صرف', 'Expense') }, { value: 'income', label: L('دخل', 'Income') }, { value: 'transfer', label: L('تحويل/ادخار', 'Transfer/Save') }]} />
        <Input type="number" inputMode="decimal" label={L('المبلغ', 'Amount')} value={d.amount || ''} onChange={(e) => set({ amount: Number(e.target.value) })} autoFocus className="[&_input]:text-xl [&_input]:font-black" />
        <Input label={L('الوصف', 'Description')} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        {d.kind === 'expense' && <div className="flex flex-wrap gap-1.5">{settings.categories.expenses.map((c) => <Chip key={c} active={d.category === c} onClick={() => set({ category: c })}>{c}</Chip>)}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Select label={d.kind === 'transfer' ? L('من', 'From') : L('المحفظة', 'Wallet')} value={d.wallet_id} onChange={(e) => set({ wallet_id: e.target.value })}>{wallets.map((w) => <option key={w.id} value={w.id}>{w.data.icon} {w.data.name}</option>)}</Select>
          {d.kind === 'transfer' ? <Select label={L('إلى', 'To')} value={d.to_wallet_id ?? ''} onChange={(e) => set({ to_wallet_id: e.target.value })}>{wallets.filter((w) => w.id !== d.wallet_id).map((w) => <option key={w.id} value={w.id}>{w.data.icon} {w.data.name}</option>)}</Select>
            : <Input type="date" label={L('التاريخ', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />}
        </div>
        {d.kind === 'transfer' && <Input type="date" label={L('التاريخ', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />}
        {d.kind === 'expense' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={!!d.saving} onChange={(e) => set({ saving: e.target.checked })} />{L('مبلغ مُجنَّب للادخار (لا يُحسب صرفاً)', 'Money set aside (not counted as spending)')}</label>}
      </div>
    </Modal>
  );
}

/** "Log from text" — AI when enabled + consented, otherwise an offline parser. Always previewed before saving. */
function AiExpense({ initial, auto, wallets, onClose }: { initial: string; auto: boolean; wallets: Wallet[]; onClose: () => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const [text, setText] = useState(initial);
  const [wallet, setWallet] = useState(wallets.find((w) => w.data.kind === 'regular')?.id ?? wallets[0]?.id ?? '');
  const [items, setItems] = useState<Array<ParsedTxn & { on: boolean }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const useAi = settings.privacy.ai.enabled && settings.privacy.ai.finance;

  const analyze = async () => {
    if (!text.trim()) return;
    setBusy(true); setMessage(null);
    try {
      let parsed: ParsedTxn[] = [];
      if (useAi) {
        try {
          const r = await api<{ result: { transactions: Array<{ description: string; amount: number; kind: string; category: string | null; date: string | null }>; message?: string } }>('/ai/expense_parse', { input: { text, categories: settings.categories.expenses }, consent: true, today: todayKey() });
          parsed = (r.result.transactions ?? []).map((t) => ({ description: t.description, amount: Math.abs(Number(t.amount) || 0), kind: (['income', 'saving'].includes(t.kind) ? t.kind : 'expense') as ParsedTxn['kind'], category: t.category, date: t.date }));
          setMessage(r.result.message ?? null);
        } catch (e) {
          setMessage(`${(e as Error).message} — ${L('استخدمنا التحليل المحلي', 'used the offline parser')}`);
          parsed = parseExpensesLocally(text);
        }
      } else parsed = parseExpensesLocally(text);
      setItems(parsed.filter((p) => p.amount > 0).map((p) => ({ ...p, on: true })));
    } finally { setBusy(false); }
  };
  useEffect(() => { if (auto && initial) void analyze(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    if (!wallet) { toast(L('أنشئ محفظة أولاً', 'Create a wallet first'), { tone: 'error' }); return; }
    const chosen = (items ?? []).filter((i) => i.on);
    const savings = wallets.find((w) => w.data.kind === 'savings');
    for (const i of chosen) {
      const date = i.date && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : todayKey();
      const data: TxnData = i.kind === 'saving' && savings
        ? { kind: 'transfer', amount: i.amount, description: i.description, category: null, wallet_id: wallet, to_wallet_id: savings.id }
        : { kind: i.kind === 'income' ? 'income' : 'expense', amount: i.amount, description: i.description, category: i.kind === 'expense' ? i.category : null, wallet_id: wallet, saving: i.kind === 'saving' };
      await create<TxnData>('txn', data, { date, parent_id: wallet });
    }
    toast(L(`سُجّلت ${chosen.length} معاملة`, `${chosen.length} transactions logged`));
    onClose();
  };

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('تسجيل من نص أو رسالة بنك', 'Log from text or bank SMS')} wide
      description={useAi ? L('يُرسل النص للمساعد الذكي بموافقتك (الإعدادات › الخصوصية).', 'Text is sent to the AI assistant with your consent (Settings › Privacy).') : L('تحليل محلي على جهازك — لا يُرسل شيء.', 'Parsed locally on your device — nothing is sent.')}
      footer={items ? <><Button variant="ghost" onClick={() => setItems(null)}>{L('رجوع', 'Back')}</Button><Button variant="primary" disabled={!items.some((i) => i.on)} onClick={apply}>{L('سجّل المحدد', 'Log selected')}</Button></> : <Button variant="primary" loading={busy} onClick={analyze}>{L('حلّل', 'Analyze')}</Button>}>
      {!items ? (
        <div className="space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={L('الصق رسالة البنك، أو اكتب: قهوة 15، بنزين 80، راتب 8000', 'Paste a bank SMS, or type: coffee 15, fuel 80, salary 8000')} className="[&_textarea]:min-h-36" autoFocus />
          <Select label={L('المحفظة', 'Wallet')} value={wallet} onChange={(e) => setWallet(e.target.value)}>{wallets.map((w) => <option key={w.id} value={w.id}>{w.data.icon} {w.data.name}</option>)}</Select>
        </div>
      ) : (
        <div>
          {message && <p className="mb-3 rounded-sm bg-surface-2 px-3 py-2 text-sm">{message}</p>}
          {!items.length ? <p className="text-sm text-fg-2">{L('ما لقينا مبالغ في النص.', 'No amounts found in the text.')}</p> : (
            <ul className="divide-y divide-line">
              {items.map((i, k) => (
                <li key={k} className="flex flex-wrap items-center gap-2 py-2">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={i.on} onChange={() => setItems(items.map((x, j) => (j === k ? { ...x, on: !x.on } : x)))} aria-label={i.description} />
                  <input className="field h-9 min-h-0 flex-1 py-1" value={i.description} onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)))} />
                  <input type="number" className="field h-9 min-h-0 w-24 py-1" value={i.amount} onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, amount: Number(e.target.value) } : x)))} aria-label={L('المبلغ', 'Amount')} />
                  <select className="field h-9 min-h-0 w-28 py-0" value={i.kind} onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, kind: e.target.value as ParsedTxn['kind'] } : x)))} aria-label={L('النوع', 'Type')}>
                    <option value="expense">{L('صرف', 'Expense')}</option><option value="income">{L('دخل', 'Income')}</option><option value="saving">{L('ادخار', 'Saving')}</option>
                  </select>
                  {i.kind === 'expense' && <select className="field h-9 min-h-0 w-32 py-0" value={i.category ?? ''} onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, category: e.target.value } : x)))} aria-label={L('التصنيف', 'Category')}>{settings.categories.expenses.map((c) => <option key={c}>{c}</option>)}</select>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Printable monthly report (replaces the v4 PDF export; "Save as PDF" from the print dialog). */
function MonthReport({ month, txns, spent, income, saved, byCat, onClose, money }: { month: string; txns: Txn[]; spent: number; income: number; saved: number; byCat: Array<[string, number]>; onClose: () => void; money: (n: number) => string }) {
  const { L, locale } = useI18n();
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('تقرير الشهر', 'Monthly report')} wide footer={<Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>{L('طباعة / حفظ PDF', 'Print / Save as PDF')}</Button>}>
      <div className="print-area space-y-4">
        <h2 className="text-xl font-black">{L('تقرير مالي', 'Financial report')} — {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))}</h2>
        <div className="grid grid-cols-3 gap-3"><Stat label={L('الدخل', 'Income')} value={money(income)} /><Stat label={L('الصرف', 'Spending')} value={money(spent)} /><Stat label={L('الادخار', 'Saved')} value={money(saved)} /></div>
        <table className="w-full text-sm"><thead><tr className="border-b border-line text-start"><th className="py-1 text-start">{L('التصنيف', 'Category')}</th><th className="py-1 text-end">{L('المبلغ', 'Amount')}</th></tr></thead>
          <tbody>{byCat.map(([c, v]) => <tr key={c} className="border-b border-line"><td className="py-1">{c}</td><td className="num py-1 text-end">{money(v)}</td></tr>)}</tbody></table>
        <table className="w-full text-[12px]"><tbody>{[...txns].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).map((t) => <tr key={t.id} className="border-b border-line"><td className="py-0.5">{t.date}</td><td>{t.data.description}</td><td>{t.data.category ?? ''}</td><td className="num text-end">{t.data.kind === 'income' ? '+' : t.data.kind === 'transfer' ? '⇄' : '−'}{t.data.amount}</td></tr>)}</tbody></table>
      </div>
    </Modal>
  );
}
