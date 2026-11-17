import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, FileJson, FileSpreadsheet, FileText, CalendarDays, History } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { api } from '@/core/api';
import { useAuth } from '@/core/auth';
import { useTrash } from '@/core/hooks';
import { db } from '@/core/db';
import { purge, restore } from '@/core/repo';
import { toast } from '@/core/toast';
import { toIcs } from '@/core/ics';
import { commitImport, download, exportCsv, exportJson, exportNotesMarkdown, previewImport, undoLastImport, type ImportPreview } from '@/core/portability';
import { confirm, Modal, prompt } from '@/design/overlay';
import { Button, Card, EmptyState, PageHeader, Section } from '@/design/ui';
import { syncNow } from '@/core/sync';
import type { EventData } from '@/modules/shared/domain';

export default function DataSettings() {
  const { L } = useI18n();
  const { user } = useAuth();
  const trash = useTrash();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setPreview(await previewImport(await f.text())); } catch (e) { toast((e as Error).message, { tone: 'error' }); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const reimport = async () => {
    try {
      const r = await api<{ total: number }>('/v2/sync/migrate', {});
      await syncNow();
      toast(L(`تمت المزامنة مع بيانات النسخة السابقة (${r.total} عنصر، بدون تكرار)`, `Synced with previous-version data (${r.total} items, no duplicates)`));
    } catch (e) { toast((e as Error).message, { tone: 'error' }); }
  };

  const deleteAccount = async () => {
    const ok = await confirm(L('حذف الحساب نهائياً؟', 'Delete your account permanently?'), { message: L('سيُحذف كل شيء من الخادم ولا يمكن التراجع. صدّر نسخة احتياطية أولاً.', 'Everything is removed from the server and cannot be undone. Export a backup first.'), danger: true, okText: L('متابعة', 'Continue') });
    if (!ok) return;
    const typed = await prompt(L('اكتب DELETE للتأكيد', 'Type DELETE to confirm'), { placeholder: 'DELETE' });
    if (typed !== 'DELETE') return;
    const pw = user?.has_password ? await prompt(L('كلمة السر', 'Password'), { type: 'password' }) : null;
    try {
      await api('/v2/account/delete', { confirm: 'DELETE', password: pw ?? undefined });
      localStorage.removeItem('dq_last_user');
      location.href = '/';
    } catch (e) { toast((e as Error).message, { tone: 'error' }); }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('البيانات', 'Data')} subtitle={L('بياناتك ملكك: صدّرها أو استوردها أو احذفها متى ما تبي.', 'Your data is yours: export, import or delete it any time.')} />

      <Section title={L('تصدير', 'Export')}>
        <Card className="grid gap-2 p-4 sm:grid-cols-2">
          <Button icon={<FileJson size={16} />} onClick={exportJson}>{L('نسخة احتياطية كاملة (JSON)', 'Full backup (JSON)')}</Button>
          <Button icon={<FileText size={16} />} onClick={exportNotesMarkdown}>{L('الملاحظات (Markdown)', 'Notes (Markdown)')}</Button>
          <Button icon={<CalendarDays size={16} />} onClick={async () => {
            const evs = await db().records.where('type').equals('event').filter((r) => !r.deleted_at).toArray();
            download('daqeeq-calendar.ics', toIcs(evs.map((e) => ({ id: e.id, data: e.data as unknown as EventData }))), 'text/calendar');
          }}>{L('التقويم (ICS)', 'Calendar (ICS)')}</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => exportCsv('task', ['title', 'priority', 'category', 'start', 'due', 'completed_at', 'tags'])}>{L('المهام (CSV)', 'Tasks (CSV)')}</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => exportCsv('txn', ['kind', 'amount', 'description', 'category', 'wallet_id'])}>{L('المعاملات المالية (CSV)', 'Transactions (CSV)')}</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => exportCsv('habit_log', ['habit_id', 'value', 'note'])}>{L('سجل العادات (CSV)', 'Habit log (CSV)')}</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => exportCsv('workout', ['name', 'duration_min', 'exercises'])}>{L('التمارين (CSV)', 'Workouts (CSV)')}</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => exportCsv('meal', ['meal_type', 'name', 'calories', 'protein', 'carbs', 'fat'])}>{L('الوجبات (CSV)', 'Meals (CSV)')}</Button>
          <Button icon={<Download size={16} />} onClick={() => { location.href = '/api/v2/account/legacy'; }}>{L('بياناتك من النسخة السابقة (v4)', 'Your previous-version data (v4)')}</Button>
        </Card>
      </Section>

      <Section title={L('استيراد', 'Import')}>
        <Card className="p-4">
          <p className="mb-3 text-sm text-fg-2">{L('استورد نسخة احتياطية من دقيق. نعرض لك ما سيُضاف قبل التنفيذ، ولا نستبدل أي عنصر موجود.', 'Import a Daqeeq backup. You see what will be added first; existing items are never replaced.')}</p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>{L('اختر ملف JSON', 'Choose JSON file')}</Button>
            <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={async () => { const n = await undoLastImport(); toast(n ? L(`أُلغي آخر استيراد (${n})`, `Last import undone (${n})`) : L('لا يوجد استيراد سابق', 'Nothing to undo')); }}>{L('تراجع عن آخر استيراد', 'Undo last import')}</Button>
            <Button variant="ghost" icon={<History size={16} />} onClick={reimport}>{L('أعد جلب بيانات النسخة السابقة', 'Re-sync previous-version data')}</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </Card>
      </Section>

      <Section title={L('سلة المحذوفات', 'Trash')}>
        {!trash?.length ? <EmptyState title={L('السلة فاضية', 'Trash is empty')} /> : (
          <Card className="divide-y divide-line">
            {trash.slice(0, 50).map((r) => {
              const d = r.data as Record<string, unknown>;
              return (
                <div key={r.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="rounded-xs bg-surface-2 px-1.5 text-[11px] text-fg-3">{r.type}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{String(d.title ?? d.name ?? d.description ?? d.label ?? r.id)}</span>
                  <Button size="sm" variant="ghost" onClick={() => restore(r.id)}>{L('استعادة', 'Restore')}</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={async () => { if (await confirm(L('حذف نهائي؟ لا يمكن التراجع.', 'Delete forever? This cannot be undone.'), { danger: true })) await purge(r.id); }}>{L('نهائي', 'Forever')}</Button>
                </div>
              );
            })}
          </Card>
        )}
      </Section>

      <Section title={L('منطقة الخطر', 'Danger zone')}>
        <Card className="p-4" style={{ borderColor: 'var(--danger)' }}>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={deleteAccount}>{L('حذف الحساب وكل البيانات', 'Delete account and all data')}</Button>
        </Card>
      </Section>

      <Modal open={!!preview} onOpenChange={(v) => !v && setPreview(null)} title={L('معاينة الاستيراد', 'Import preview')}
        footer={<>
          <Button variant="ghost" onClick={() => setPreview(null)}>{L('إلغاء', 'Cancel')}</Button>
          <Button variant="primary" disabled={!preview?.valid.length} onClick={async () => { const n = await commitImport(preview!); setPreview(null); toast(L(`أُضيف ${n} عنصر`, `${n} items added`)); }}>{L('استيراد', 'Import')} {preview?.valid.length}</Button>
        </>}>
        {preview && (
          <div className="space-y-2 text-sm">
            <p>{L('سيُضاف:', 'Will add:')} <b className="num">{preview.valid.length}</b></p>
            <ul className="grid grid-cols-2 gap-1 text-fg-2">{Object.entries(preview.byType).map(([t, n]) => <li key={t}>{t}: <span className="num">{n}</span></li>)}</ul>
            {preview.duplicates > 0 && <p className="text-fg-2">{L(`${preview.duplicates} عنصر موجود مسبقاً — سيُتجاهل.`, `${preview.duplicates} already exist — skipped.`)}</p>}
            {preview.invalid > 0 && <p className="text-warning">{L(`${preview.invalid} عنصر غير صالح — سيُتجاهل.`, `${preview.invalid} invalid — skipped.`)}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
