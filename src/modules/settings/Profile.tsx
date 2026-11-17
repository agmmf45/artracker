import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/hooks';
import { useAuth } from '@/core/auth';
import { upsert } from '@/core/repo';
import { toast } from '@/core/toast';
import { confirm } from '@/design/overlay';
import { Button, Card, Input, PageHeader, Switch } from '@/design/ui';
import { Avatar } from '@/modules/shared/Avatar';

const EMOJIS = ['😊', '😎', '🦁', '🐯', '🦊', '🐼', '🦉', '🌙', '⭐', '🔥', '🌿', '🎯', '🧠', '💪', '📚', '🦷'];
const COLORS = ['#E9E3F5', '#DCE8F5', '#DDF0E5', '#F6EBD7', '#F5DFDA', '#E2E5EA', '#2F2B44', '#1F3A4E'];

async function resizeImage(file: File, size = 300): Promise<string> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  const s = Math.min(bmp.width, bmp.height);
  c.width = size; c.height = size;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.82);
}

export default function ProfileSettings() {
  const { L } = useI18n();
  const profile = useProfile();
  const { user, logout } = useAuth();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { setName(profile.display_name ?? ''); setNote(profile.status_note ?? ''); }, [profile.display_name, profile.status_note]);

  const save = (p: Record<string, unknown>) => upsert('profile', 'profile', p);

  const doLogout = async () => {
    const r = await logout();
    if (r && r.pending) {
      const ok = await confirm(L('بعض التغييرات لم تُرفع بعد', 'Some changes are not synced yet'), {
        message: L(`${r.pending} تغيير محفوظ على هذا الجهاز فقط. الخروج الآن يحذفها. اتصل بالإنترنت أولاً إذا أمكن.`, `${r.pending} changes exist only on this device. Signing out now discards them. Connect to the internet first if you can.`),
        okText: L('اخرج على أي حال', 'Sign out anyway'), danger: true,
      });
      if (ok) await logout({ force: true });
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('الملف الشخصي', 'Profile')} subtitle={user?.email} />
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar profile={profile} size={72} />
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-sm border border-line px-3 py-2 text-sm font-bold hover:bg-surface-2">
              {L('صورة', 'Photo')}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { await save({ avatar_photo: await resizeImage(f) }); } catch { toast(L('تعذر قراءة الصورة', 'Could not read the image'), { tone: 'error' }); }
              }} />
            </label>
            {profile.avatar_photo && <Button variant="ghost" onClick={() => save({ avatar_photo: null })}>{L('إزالة الصورة', 'Remove photo')}</Button>}
          </div>
        </div>
        {!profile.avatar_photo && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">{EMOJIS.map((e) => <button key={e} aria-label={e} onClick={() => save({ avatar_emoji: e })} className={`size-9 rounded-full text-lg ${profile.avatar_emoji === e ? 'ring-2 ring-life' : 'bg-surface-2'}`}>{e}</button>)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{COLORS.map((c) => <button key={c} aria-label={c} onClick={() => save({ avatar_color: c })} className={`size-7 rounded-full border border-line ${profile.avatar_color === c ? 'ring-2 ring-life' : ''}`} style={{ background: c }} />)}</div>
          </>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input label={L('الاسم الظاهر', 'Display name')} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => save({ display_name: name.trim() || null })} />
          <Input label={L('حالتي (تظهر لأصدقائك)', 'Status (visible to friends)')} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} onBlur={() => save({ status_note: note.trim() || null })} />
        </div>
        <Switch checked={profile.share_progress !== false} onChange={(v) => save({ share_progress: v })} label={L('شارك مستواي وسلسلتي مع أصدقائي', 'Share my level and streak with friends')} hint={L('لا نشارك أي مهام أو ملاحظات أو بيانات صحية أو مالية أبداً.', 'Tasks, notes, health and money are never shared.')} />
      </Card>
      <Button variant="secondary" icon={<LogOut size={16} />} onClick={doLogout}>{L('تسجيل الخروج', 'Sign out')}</Button>
      <p className="mt-2 text-[12px] text-fg-3">{L('الخروج يحذف النسخة المحلية من هذا الجهاز لحماية خصوصيتك. بياناتك تبقى محفوظة في حسابك.', 'Signing out removes the local copy from this device for privacy. Your data stays in your account.')}</p>
    </div>
  );
}
