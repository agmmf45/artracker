import type { Txn, Wallet } from '@/modules/shared/domain';
import { normalizeDigits } from '@/core/capture/parse';

/**
 * Balance (fixes the v4 double-subtraction bug):
 *   balance = initial + income − expense − transfers out + transfers in
 * "saving" expenses (money set aside from a regular wallet) leave the wallet but are not counted as spending.
 */
export function walletBalance(w: Wallet, txns: Txn[]): number {
  let b = w.data.initial_balance || 0;
  for (const t of txns) {
    const a = t.data.amount || 0;
    if (t.data.wallet_id === w.id) {
      if (t.data.kind === 'income') b += a;
      else if (t.data.kind === 'expense' || t.data.kind === 'transfer') b -= a;
    }
    if (t.data.kind === 'transfer' && t.data.to_wallet_id === w.id) b += a;
  }
  return b;
}

export function isSpending(t: Txn): boolean {
  return t.data.kind === 'expense' && !t.data.saving;
}

export function monthKey(d: string): string {
  return d.slice(0, 7);
}

export interface ParsedTxn { description: string; amount: number; kind: 'expense' | 'income' | 'saving'; category: string | null; date: string | null }

const CATS: Array<[RegExp, string]> = [
  [/مطعم|كوفي|قهوة|كافيه|ستاربكس|ماكدونالدز|برجر|البيك|هنقرستيشن|جاهز|مرسول|طلبات|coffee|cafe|restaurant|food|kfc|mcdonald|starbucks|hungerstation|jahez/i, '🍔 أكل'],
  [/بنزين|محطة|ساسكو|الدريس|أوبر|كريم|uber|careem|fuel|petrol|aldrees|sasco/i, '🚗 مواصلات'],
  [/فاتورة|stc|موبايلي|زين|كهرباء|مياه|bill|mobily|zain|electric/i, '📋 فواتير'],
  [/صيدلية|النهدي|الدواء|مستشفى|عيادة|pharmacy|nahdi|hospital|clinic/i, '💊 صحة'],
  [/نتفلكس|شاهد|سينما|بلايستيشن|ستيم|netflix|shahid|cinema|steam|playstation/i, '🎮 ترفيه'],
  [/بنده|الدانوب|كارفور|لولو|أمازون|نون|العثيم|panda|danube|carrefour|lulu|amazon|noon|othaim|tamimi|التميمي/i, '🛒 تسوق'],
];

/**
 * Offline bank-SMS / free-text parser used when the AI assistant is off or unavailable.
 * Handles common Saudi bank formats: "شراء بقيمة 25.50 SAR لدى STARBUCKS", "POS 120 SAR at …", "إيداع راتب 8000 ريال".
 */
export function parseExpensesLocally(text: string): ParsedTxn[] {
  const out: ParsedTxn[] = [];
  const norm = normalizeDigits(text);
  // bank SMS: one message per blank-line-separated block; free text: one item per line
  const looksLikeSms = /شراء|بطاقة|مدى|نقاط البيع|رصيد|POS|card|purchase|حوالة/i.test(norm);
  const blocks = (looksLikeSms ? norm.split(/\n\s*\n/) : norm.split(/\n|،|؛|,(?!\d)/)).map((s) => s.trim()).filter(Boolean);
  for (const b of blocks) {
    const amt = /(?:SAR|ر\.?\s?س|ريال|SR)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:SAR|ر\.?\s?س|ريال|SR|ر)\b|(?:بقيمة|بمبلغ|مبلغ|amount|amt)[:\s]*([\d,]+(?:\.\d{1,2})?)|(?:^|\s)([\d]+(?:\.\d{1,2})?)(?=\s|$)/i.exec(b);
    if (!amt) continue;
    const amount = Number((amt[1] ?? amt[2] ?? amt[3] ?? amt[4]).replace(/,/g, ''));
    if (!amount || amount > 10_000_000) continue;
    const income = /إيداع|راتب|حوالة واردة|استلام|deposit|salary|credited|received/i.test(b);
    const saving = /ادخار|ادخرت|وفرت|saving/i.test(b);
    const merchant = /(?:لدى|من|عند|في|at|from|@)\s*[:\-]?\s*([^\n\d:]{2,40}?)(?:\s+(?:في|بتاريخ|on|بطاقة|card)|[\n.,]|$)/i.exec(b)?.[1]?.trim();
    const date = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(b) ?? /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/.exec(b);
    let iso: string | null = null;
    if (date) {
      if (date[1].length === 4) iso = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
      else { const y = date[3].length === 2 ? `20${date[3]}` : date[3]; iso = `${y}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`; }
      if (Number.isNaN(Date.parse(iso))) iso = null;
    }
    const desc = (merchant || b.replace(amt[0], '').replace(/شراء|عملية|بطاقة|مدى|POS|purchase/gi, '').trim()).slice(0, 60) || (income ? 'إيداع' : 'مصروف');
    let category: string | null = null;
    for (const [re, c] of CATS) if (re.test(b)) { category = c; break; }
    out.push({ description: desc, amount, kind: income ? 'income' : saving ? 'saving' : 'expense', category: income ? null : category ?? '📦 أخرى', date: iso });
  }
  return out;
}
