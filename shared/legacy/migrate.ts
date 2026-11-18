/**
 * Converts the v4 JSON blob (users.data / myData) into v5 records.
 *
 * Guarantees
 * - Pure function: no I/O. The Worker snapshots the blob before calling this.
 * - Deterministic ids (`lg:<kind>:<legacyId>`): running it twice yields the same ids, and the
 *   server inserts with ON CONFLICT DO NOTHING, so re-running never duplicates anything.
 * - Lossless where it matters: unknown fields on legacy items are kept under `data.legacy`.
 */
import type { RecordEnvelope, RecordType } from '../records';
import { PRIVATE_TYPES } from '../records';

type Any = Record<string, any>;

export interface MigrationResult {
  records: RecordEnvelope[];
  counts: Partial<Record<RecordType, number>>;
  skipped: string[];
  profile: Any;
  settings: Any;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function safeId(v: unknown): string {
  return String(v ?? '').replace(/[^\w:.-]/g, '_').slice(0, 100) || 'x';
}

function isDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v);
}

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : d;
}

function isoFromMs(ms: unknown, fallback: string): string {
  const n = num(ms, NaN);
  if (!Number.isFinite(n) || n < 946684800000 /* 2000-01-01 */) return fallback;
  return new Date(n).toISOString();
}

export function migrateLegacyBlob(blob: Any, nowIso: string): MigrationResult {
  const out: RecordEnvelope[] = [];
  const counts: Partial<Record<RecordType, number>> = {};
  const skipped: string[] = [];

  const add = (
    type: RecordType,
    id: string,
    data: Any,
    opts: { parent_id?: string | null; date?: string | null; status?: string | null; created_at?: string } = {},
  ) => {
    out.push({
      id,
      type,
      data,
      parent_id: opts.parent_id ?? null,
      date: opts.date ?? null,
      status: opts.status ?? null,
      private: PRIVATE_TYPES.has(type) ? 1 : 0,
      created_at: opts.created_at ?? nowIso,
      updated_at: nowIso,
      deleted_at: null,
    });
    counts[type] = (counts[type] ?? 0) + 1;
  };

  const b: Any = blob && typeof blob === 'object' ? blob : {};

  // ── profile & settings singletons ──
  const profile: Any = {
    display_name: b.display_name ?? null,
    avatar_emoji: b.avatar_emoji ?? null,
    avatar_color: b.avatar_color ?? null,
    avatar_photo: typeof b.avatar_photo === 'string' && b.avatar_photo.length < 150_000 ? b.avatar_photo : null,
    status_note: b.status_note ?? null,
  };
  if (typeof b.avatar_photo === 'string' && b.avatar_photo.length >= 150_000) skipped.push('avatar_photo: too large');

  const nutri: Any = b.nutrition ?? {};
  const settings: Any = {
    legacyTheme: b.theme ?? null,
    finance: { monthlyBudget: num(b.budget, 0) || null, currency: 'SAR' },
    health: {
      calorieGoal: num(nutri.goal, 0) || 2000,
      proteinGoal: num(nutri.pGoal, 0) || null,
      carbGoal: num(nutri.cGoal, 0) || null,
      fatGoal: num(nutri.fGoal, 0) || null,
      waterGoal: num(nutri.waterGoal, 0) || 2000,
    },
  };

  // ── habits ──
  const habits: Any[] = Array.isArray(b.habits_list) ? b.habits_list : [];
  const habitIds = new Map<string, string>();
  habits.forEach((h, i) => {
    if (!h || h.id == null) return;
    const id = `lg:habit:${safeId(h.id)}`;
    habitIds.set(String(h.id), id);
    add('habit', id, {
      name: String(h.name ?? 'عادة'),
      icon: h.icon ?? '✅',
      kind: 'check',
      target: 1,
      unit: null,
      schedule: { type: 'daily' },
      subtasks: Array.isArray(h.subtasks) ? h.subtasks.map((s: Any) => ({ id: String(s.id), name: String(s.name ?? '') })) : [],
      order: i,
      category: null,
    }, { status: h.archived ? 'archived' : 'active' });
  });

  const habitNotes: Any = b.habit_notes ?? {};
  const done: Any = b.done ?? {};
  for (const [date, map] of Object.entries<Any>(done)) {
    if (!isDate(date) || !map || typeof map !== 'object') continue;
    for (const [key, val] of Object.entries(map)) {
      if (key.includes('_sub_')) continue;
      const hid = habitIds.get(key);
      if (!hid) continue;
      const subs: Record<string, boolean> = {};
      for (const [k2, v2] of Object.entries(map)) {
        if (k2.startsWith(`${key}_sub_`) && v2) subs[k2.slice(key.length + 5)] = true;
      }
      if (!val && !Object.keys(subs).length) continue;
      add('habit_log', `lg:hl:${date}:${safeId(key)}`, {
        habit_id: hid,
        value: val ? 1 : 0,
        subtasks: subs,
        note: habitNotes[`${date}:${key}`] ?? null,
      }, { parent_id: hid, date, status: val ? 'done' : 'partial' });
    }
  }

  // ── tasks ──
  const prio: Any = { high: 3, normal: 2, low: 1 };
  const todos: Any[] = Array.isArray(b.todos) ? b.todos : [];
  todos.forEach((t) => {
    if (!t || t.id == null) return;
    const created = isoFromMs(t.createdAt ?? t.id, nowIso);
    add('task', `lg:task:${safeId(t.id)}`, {
      title: String(t.text ?? ''),
      notes: '',
      priority: prio[t.priority] ?? 2,
      category: t.cat ?? null,
      tags: [],
      due: isDate(t.due) ? t.due.slice(0, 10) : null,
      due_time: null,
      subtasks: [],
      completed_at: t.done ? isoFromMs(t.doneAt, nowIso) : null,
      source: 'legacy',
    }, { date: isDate(t.due) ? t.due.slice(0, 10) : null, status: t.done ? 'done' : 'todo', created_at: created });
  });

  // ── finance ──
  let wallets: Any[] = Array.isArray(b.wallets) ? [...b.wallets] : [];
  let txns: Any[] = Array.isArray(b.transactions) ? [...b.transactions] : [];
  const expenses: Any[] = Array.isArray(b.expenses) ? b.expenses : [];
  if (expenses.length && !b._migrated && !txns.length) {
    // v3 data that never went through initWallets()
    wallets = [{ id: 'w_default', name: 'المحفظة الرئيسية', icon: '💰', balance: num(b.budget) }, ...wallets];
    txns = expenses.map((e) => ({ id: e.id, walletId: 'w_default', type: 'spend', amount: e.amount, desc: e.name, cat: e.cat, date: e.date }));
  }
  const walletIds = new Map<string, string>();
  const walletType = new Map<string, string>();
  wallets.forEach((w, i) => {
    if (!w || w.id == null) return;
    const id = `lg:wallet:${safeId(w.id)}`;
    walletIds.set(String(w.id), id);
    walletType.set(String(w.id), w.type === 'savings' ? 'savings' : 'regular');
    add('wallet', id, {
      name: String(w.name ?? 'محفظة'),
      icon: w.icon ?? '💰',
      kind: w.type === 'savings' ? 'savings' : 'regular',
      initial_balance: num(w.balance),
      goal: num(w.goal) || null,
      currency: 'SAR',
      order: i,
    });
  });

  // pair save↔transfer by linkId: one v5 transfer replaces both legacy rows
  const transferByLink = new Map<string, Any>();
  for (const t of txns) if (t?.type === 'transfer' && t.linkId) transferByLink.set(String(t.linkId), t);
  const consumed = new Set<unknown>();

  for (const t of txns) {
    if (!t || t.id == null || consumed.has(t)) continue;
    const wid = walletIds.get(String(t.walletId));
    if (!wid) { skipped.push(`txn ${t.id}: unknown wallet`); continue; }
    const date = isDate(t.date) ? t.date.slice(0, 10) : nowIso.slice(0, 10);
    const base = { amount: Math.abs(num(t.amount)), description: String(t.desc ?? ''), category: t.cat ?? null };
    const id = `lg:txn:${safeId(t.id)}`;
    if (t.type === 'spend') {
      add('txn', id, { ...base, kind: 'expense', wallet_id: wid }, { date, parent_id: wid });
    } else if (t.type === 'add') {
      add('txn', id, { ...base, kind: 'income', wallet_id: wid }, { date, parent_id: wid });
    } else if (t.type === 'save') {
      const isSavings = walletType.get(String(t.walletId)) === 'savings';
      const pair = t.linkId ? transferByLink.get(String(t.linkId)) : undefined;
      if (isSavings && pair && walletIds.get(String(pair.walletId))) {
        consumed.add(pair);
        add('txn', id, { ...base, kind: 'transfer', wallet_id: walletIds.get(String(pair.walletId)), to_wallet_id: wid }, { date, parent_id: walletIds.get(String(pair.walletId)) });
      } else if (isSavings) {
        add('txn', id, { ...base, kind: 'income', wallet_id: wid, saving: true }, { date, parent_id: wid });
      } else {
        // money set aside from a regular wallet (left the wallet, not a purchase)
        add('txn', id, { ...base, kind: 'expense', wallet_id: wid, saving: true }, { date, parent_id: wid });
      }
    } else if (t.type === 'transfer') {
      const to = walletIds.get(String(t.transferTo));
      if (t.linkId && txns.some((x) => x !== t && x?.linkId === t.linkId && x.type === 'save')) continue; // handled by the save side
      add('txn', id, { ...base, kind: to ? 'transfer' : 'expense', wallet_id: wid, to_wallet_id: to ?? null }, { date, parent_id: wid });
    } else {
      skipped.push(`txn ${t.id}: unknown type ${t.type}`);
    }
  }

  // ── journal (daily notes) ──
  for (const [key, text] of Object.entries<unknown>(b.daily_notes ?? {})) {
    if (!isDate(key) || typeof text !== 'string' || !text.trim()) continue;
    const date = key.slice(0, 10);
    const time = /_(\d{2}:\d{2})$/.exec(key)?.[1] ?? null;
    add('journal', `lg:journal:${safeId(key)}`, { body: text, time, mood: null, energy: null, prompts: {} }, { date });
  }

  // ── calendar reminders → all-day events ──
  for (const [date, list] of Object.entries<Any>(b.cal_reminders ?? {})) {
    if (!isDate(date) || !Array.isArray(list)) continue;
    list.forEach((text, i) => {
      if (typeof text !== 'string' || !text.trim()) return;
      add('event', `lg:event:${date}:${i}`, { title: text, all_day: true, start: date, end: date, category: 'personal' }, { date });
    });
  }

  // ── reminders ──
  (Array.isArray(b.reminders) ? b.reminders : []).forEach((r: Any) => {
    if (!r || r.id == null) return;
    add('reminder', `lg:reminder:${safeId(r.id)}`, {
      label: String(r.label ?? ''),
      time: typeof r.time === 'string' ? r.time : '08:00',
      days: Array.isArray(r.days) ? r.days.filter((d: unknown) => Number.isInteger(d)) : [0, 1, 2, 3, 4, 5, 6],
    }, { status: r.enabled === false ? 'off' : 'on' });
  });

  // ── achievements (trophies) ──
  for (const [key, v] of Object.entries<Any>(b._trophies ?? {})) {
    add('achievement', `lg:ach:${safeId(key)}`, { key, legacy: true }, { date: isoFromMs(v?.unlockedAt, nowIso) });
  }

  // ── fitness ──
  const fit: Any = b.fitness ?? {};
  const programIds = new Map<string, string>();
  (Array.isArray(fit.programs) ? fit.programs : []).forEach((p: Any) => {
    if (!p || p.id == null) return;
    const id = `lg:program:${safeId(p.id)}`;
    programIds.set(String(p.id), id);
    add('program', id, { name: String(p.name ?? 'برنامج'), days: Array.isArray(p.days) ? p.days : [] });
  });
  (Array.isArray(fit.workouts) ? fit.workouts : []).forEach((w: Any) => {
    if (!w || w.id == null) return;
    const date = isDate(w.date) ? w.date.slice(0, 10) : nowIso.slice(0, 10);
    add('workout', `lg:workout:${safeId(w.id)}`, {
      name: String(w.name ?? 'تمرين'),
      program_id: w.programId != null ? programIds.get(String(w.programId)) ?? null : null,
      started_at: isoFromMs(w.startTime, `${date}T12:00:00.000Z`),
      duration_min: num(w.duration),
      exercises: Array.isArray(w.exercises) ? w.exercises : [],
      calories: w.calories ?? null,
      distance: w.distance ?? null,
      source: w.source ?? null,
    }, { date, status: 'done' });
  });
  (Array.isArray(fit.bodyweight) ? fit.bodyweight : []).forEach((e: Any, i: number) => {
    if (!e || !isDate(e.date) || !num(e.w)) return;
    add('measurement', `lg:bw:${e.date.slice(0, 10)}:${i}`, { kind: 'weight', value: num(e.w), unit: 'kg', source: e.source ?? null }, { date: e.date.slice(0, 10) });
  });
  for (const [name, pr] of Object.entries<Any>(fit.prs ?? {})) {
    if (!pr) continue;
    add('pr', `lg:pr:${safeId(name)}`, { exercise: name, weight: num(pr.weight), reps: num(pr.reps) }, { date: isDate(pr.date) ? pr.date : null });
  }

  // ── nutrition ──
  const photos: Any = nutri.mealPhotos ?? {};
  const photoIds = new Map<string, string>();
  for (const [aid, url] of Object.entries<unknown>(photos)) {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) continue;
    if (url.length > 1_100_000) { skipped.push(`meal photo ${aid}: too large`); continue; }
    const id = `lg:photo:${safeId(aid)}`;
    photoIds.set(aid, id);
    add('blob', id, { kind: 'meal_photo', data_url: url });
  }
  for (const [date, items] of Object.entries<Any>(nutri.log ?? {})) {
    if (!isDate(date) || !Array.isArray(items)) continue;
    items.forEach((m: Any, i: number) => {
      if (!m) return;
      const { id: legacyId, type, name, cal, p, c, f, analysisId, ...rest } = m;
      add('meal', `lg:meal:${date}:${safeId(legacyId ?? i)}`, {
        meal_type: type ?? 'snack',
        name: String(name ?? ''),
        calories: num(cal),
        protein: num(p),
        carbs: num(c),
        fat: num(f),
        estimated: m.source === 'ai_vision',
        photo_id: analysisId ? photoIds.get(String(analysisId)) ?? null : null,
        analysis_id: analysisId ?? null,
        extra: rest,
      }, { date });
    });
  }
  const waterLog: Any = nutri.waterLog ?? {};
  const waterTotals: Any = nutri.water ?? {};
  const waterDates = new Set([...Object.keys(waterLog), ...Object.keys(waterTotals)]);
  for (const date of waterDates) {
    if (!isDate(date)) continue;
    const entries = Array.isArray(waterLog[date]) ? waterLog[date] : [];
    if (entries.length) {
      entries.forEach((e: Any, i: number) => {
        if (!num(e?.ml)) return;
        add('water_log', `lg:water:${date}:${i}`, { ml: num(e.ml), time: typeof e.time === 'string' ? e.time : null }, { date });
      });
    } else if (num(waterTotals[date])) {
      add('water_log', `lg:water:${date}:total`, { ml: num(waterTotals[date]), time: null }, { date });
    }
  }

  return { records: out, counts, skipped, profile, settings };
}
