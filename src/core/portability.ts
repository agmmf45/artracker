import { RECORD_TYPES, recordEnvelopeSchema, type Rec, type RecordType } from '@shared/records';
import { db, setMeta, getMeta } from './db';
import { bulk } from './repo';
import { newMid } from './ids';
import { scheduleSync } from './sync';

/** Exports, imports and file downloads. Imports never overwrite existing records silently. */

export function download(name: string, content: string | Blob, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportJson(): Promise<void> {
  const records = (await db().records.toArray()).filter((r) => r.status !== 'purged');
  const payload = { format: 'daqeeq-export', version: 5, exported_at: new Date().toISOString(), records };
  download(`daqeeq-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 1), 'application/json');
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(type: RecordType, columns: string[]): Promise<void> {
  const rows = (await db().records.where('type').equals(type).filter((r) => !r.deleted_at).toArray());
  const head = ['id', 'date', 'status', ...columns];
  const lines = [head.join(',')];
  for (const r of rows) lines.push([r.id, r.date, r.status, ...columns.map((c) => (r.data as Record<string, unknown>)[c])].map(csvCell).join(','));
  download(`daqeeq-${type}-${new Date().toISOString().slice(0, 10)}.csv`, `${String.fromCharCode(0xfeff)}${lines.join('\n')}`, 'text/csv;charset=utf-8');
}

export async function exportNotesMarkdown(): Promise<void> {
  const notes = await db().records.where('type').equals('note').filter((r) => !r.deleted_at).toArray();
  const md = notes.map((n) => {
    const d = n.data as { title?: string; body?: string; tags?: string[] };
    return `# ${d.title || 'Untitled'}\n\n${d.tags?.length ? `${d.tags.map((t) => `#${t}`).join(' ')}\n\n` : ''}${d.body ?? ''}\n`;
  }).join('\n---\n\n');
  download(`daqeeq-notes-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown;charset=utf-8');
}

export interface ImportPreview {
  valid: Rec[];
  invalid: number;
  duplicates: number;
  byType: Partial<Record<RecordType, number>>;
}

export async function previewImport(text: string): Promise<ImportPreview> {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'daqeeq-export' || !Array.isArray(parsed.records)) throw new Error('هذا ليس ملف نسخة احتياطية من دقيق');
  const existing = new Set(await db().records.toCollection().primaryKeys());
  const valid: Rec[] = [];
  let invalid = 0;
  let duplicates = 0;
  const byType: ImportPreview['byType'] = {};
  for (const r of parsed.records) {
    const ok = recordEnvelopeSchema.safeParse(r);
    if (!ok.success || !RECORD_TYPES.includes(r.type)) { invalid++; continue; }
    if (existing.has(r.id)) { duplicates++; continue; }
    if (r.status === 'purged') continue;
    valid.push({ ...ok.data, rev: 0 } as Rec);
    byType[r.type as RecordType] = (byType[r.type as RecordType] ?? 0) + 1;
  }
  return { valid, invalid, duplicates, byType };
}

/** Adds only records that don't exist yet. Remembers the batch so it can be undone. */
export async function commitImport(p: ImportPreview): Promise<number> {
  const d = db();
  const now = new Date().toISOString();
  await bulk(async () => {
    for (const r of p.valid) {
      await d.records.put({ ...r, updated_at: now, rev: 0 });
      await d.outbox.put({ id: r.id, mid: newMid(), ts: Date.now() });
    }
  });
  await setMeta('last_import', { at: now, ids: p.valid.map((r) => r.id) });
  scheduleSync(100);
  return p.valid.length;
}

export async function undoLastImport(): Promise<number> {
  const last = await getMeta<{ at: string; ids: string[] } | null>('last_import', null);
  if (!last) return 0;
  const d = db();
  const now = new Date().toISOString();
  await bulk(async () => {
    for (const id of last.ids) {
      const r = await d.records.get(id);
      if (r && !r.deleted_at && r.type !== 'xp' && r.type !== 'redemption') {
        await d.records.put({ ...r, deleted_at: now, updated_at: now });
        await d.outbox.put({ id, mid: newMid(), ts: Date.now() });
      }
    }
  });
  await setMeta('last_import', null);
  scheduleSync(100);
  return last.ids.length;
}
