import { useRef, useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { create, update } from '@/core/repo';
import { api, ApiError } from '@/core/api';
import { blankCourse, type Course, type CourseData, type Session } from '../model';
import { COURSE_COLORS } from '../shared';

interface ReadCourse { name: string; code: string | null; credits: number | null; instructor?: string | null; confidence?: number }
interface ReadSession { course: string; code: string | null; day: number; start: string; end: string; kind?: 'lecture' | 'lab' | 'clinical'; room: string | null; confidence?: number }
type Kind = 'courses' | 'schedule';
interface Row { key: string; title: string; sub: string; color: string; exists: boolean; unsure: boolean; isNew?: boolean }

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[\s\-_.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const time = (t: string) => (/^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, '0') : t);

async function compress(file: File, max = 1600, q = 0.82): Promise<{ media_type: 'image/jpeg'; data: string }> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return { media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', q).split(',')[1] };
}

/**
 * "Set up your semester from a photo": the AI reads a course list or a timetable; the user ticks what
 * to add (existing items are recognised and skipped, unclear ones are flagged), then courses are
 * created and lectures are written into each course's schedule — which is what Day and Week show.
 */
export function PhotoImport({ courses, semesterId, compact }: { courses: Course[]; semesterId: string | null; compact?: boolean }) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [readC, setReadC] = useState<ReadCourse[]>([]);
  const [readS, setReadS] = useState<ReadSession[]>([]);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState('');
  const aiOn = settings.privacy.ai.enabled;
  const days = lang === 'ar' ? DAYS_AR : DAYS_EN;

  const match = (name: string, code: string | null) => courses.find((c) => (code && norm(c.data.code) && norm(c.data.code) === norm(code)) || norm(c.data.name) === norm(name));

  const choose = (k: Kind) => { setKind(k); setErr(''); setDone(''); fileRef.current?.click(); };
  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !kind) return;
    setBusy(true); setErr('');
    try {
      const imgs = await Promise.all([...files].slice(0, 3).map((f) => compress(f)));
      setPreview(`data:image/jpeg;base64,${imgs[0].data}`);
      const known = courses.map((c) => (c.data.code ? `${c.data.code} ${c.data.name}` : c.data.name));
      const r = await api<{ result: { courses?: ReadCourse[]; sessions?: ReadSession[] } }>('/ai/study_import', { input: { kind, known, images: imgs } });
      const p: Record<string, boolean> = {};
      if (kind === 'courses') {
        const cs = (r.result.courses ?? []).filter((c) => c.name);
        cs.forEach((c, i) => { p[`c${i}`] = !match(c.name, c.code); });
        setReadC(cs); setReadS([]);
      } else {
        const ss = (r.result.sessions ?? []).filter((x) => x.course && x.day >= 0 && x.day <= 6 && /^\d{1,2}:\d{2}$/.test(x.start));
        ss.forEach((x, i) => {
          const c = match(x.course, x.code);
          const dup = !!c && c.data.schedule.some((se) => se.day === x.day && time(se.start) === time(x.start));
          p[`s${i}`] = !dup;
        });
        setReadS(ss); setReadC([]);
      }
      setPick(p);
    } catch (e) {
      setKind(null);
      setErr(e instanceof ApiError && e.code === 'ai_unavailable' ? L('قراءة الصور غير مفعّلة على الخادم حالياً.', 'Photo reading isn’t enabled on the server yet.') : e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const rows: Row[] = kind === 'courses'
    ? readC.map((c, i) => { const ex = !!match(c.name, c.code); return { key: `c${i}`, title: c.name, sub: [c.code, c.credits ? L(`${c.credits} س`, `${c.credits} cr`) : null, c.instructor].filter(Boolean).join(' · '), color: ex ? 'var(--text-3)' : COURSE_COLORS[(courses.length + i) % COURSE_COLORS.length], exists: ex, unsure: (c.confidence ?? 100) < 70 }; })
    : readS.map((x, i) => {
      const c = match(x.course, x.code);
      const ex = !!c && c.data.schedule.some((se) => se.day === x.day && time(se.start) === time(x.start));
      const kindTxt = x.kind === 'lab' ? L('معمل', 'lab') : x.kind === 'clinical' ? L('سريري', 'clinical') : L('محاضرة', 'lecture');
      return { key: `s${i}`, title: `${c?.data.name ?? x.course} — ${days[x.day]} ${time(x.start)}–${time(x.end)}`, sub: [kindTxt, x.room ?? L('القاعة؟', 'room?')].join(' · '), color: c?.data.color ?? 'var(--study)', exists: ex, unsure: (x.confidence ?? 100) < 70 || !x.room, isNew: !c };
    });
  const count = Object.values(pick).filter(Boolean).length;

  const add = async () => {
    setBusy(true);
    try {
      let nc = 0; let ns = 0;
      const created = new Map<string, Course>();
      const colorAt = (k: number) => COURSE_COLORS[(courses.length + k) % COURSE_COLORS.length];
      if (kind === 'courses') {
        for (const [i, c] of readC.entries()) {
          if (!pick[`c${i}`] || match(c.name, c.code)) continue;
          await create<CourseData>('course', blankCourse({ name: c.name, code: c.code ?? '', credits: c.credits ?? 3, instructor: c.instructor ?? '', color: colorAt(nc), semester_id: semesterId }), { parent_id: semesterId });
          nc++;
        }
        setDone(nc ? L(`انضافت ${nc} مادة. صوّر جدولك الحين عشان تنزل محاضراتها.`, `${nc} courses added. Now photograph your timetable to place their lectures.`) : L('كل المواد موجودة عندك من قبل.', 'All of these courses already exist.'));
      } else {
        const bucket = new Map<string, { course: Course | null; name: string; code: string | null; sessions: Session[] }>();
        for (const [i, x] of readS.entries()) {
          if (!pick[`s${i}`]) continue;
          const c = match(x.course, x.code) ?? null;
          const k = c?.id ?? `new:${norm(x.code) || norm(x.course)}`;
          if (!bucket.has(k)) bucket.set(k, { course: c, name: x.course, code: x.code, sessions: [] });
          bucket.get(k)!.sessions.push({ day: x.day, start: time(x.start), end: time(x.end), kind: x.kind ?? 'lecture', room: x.room ?? undefined });
        }
        for (const [k, b] of bucket) {
          if (b.course) {
            const fresh = b.sessions.filter((se) => !b.course!.data.schedule.some((o) => o.day === se.day && o.start === se.start));
            if (fresh.length) await update<CourseData>(b.course.id, { data: { schedule: [...b.course.data.schedule, ...fresh] } });
            ns += fresh.length;
          } else {
            const rec = await create<CourseData>('course', blankCourse({ name: b.name, code: b.code ?? '', color: colorAt(nc), semester_id: semesterId, schedule: b.sessions }), { parent_id: semesterId });
            created.set(k, rec); nc++; ns += b.sessions.length;
          }
        }
        setDone(L(`نزلت ${ns} محاضرات في الجدول${nc ? ` وانضافت ${nc} مادة جديدة` : ''} — وتطلع كمان في جدول يومك وأسبوعك.`, `${ns} lectures placed${nc ? ` and ${nc} new courses added` : ''} — they also show on your Day and Week.`));
      }
      setKind(null); setReadC([]); setReadS([]); setPick({}); setPreview(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const review = kind && (readC.length > 0 || readS.length > 0);
  return (
    <section className="rounded-lg border-2 border-fg bg-surface p-4 shadow-[0_5px_0_var(--text)] sm:p-5" aria-label={L('جهّز فصلك بصورة', 'Set up your semester from a photo')}>
      <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-[16px] font-bold">✨ {L('جهّز فصلك بصورة', 'Set up your semester from a photo')}
        <span className="text-[12.5px] font-medium text-fg-2">{L('الذكاء الاصطناعي يقرأ، وأنت تأكد قبل لا ينضاف شي', 'AI reads it; you confirm before anything is added')}</span></h2>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      {!aiOn ? (
        <p className="text-[13.5px]">{L('هذي الميزة ترسل صورة الجدول للمساعد الذكي، فتحتاج تفعيله أول: ', 'This sends the photo to the AI assistant, so turn it on first: ')}
          <Link to="/settings/privacy" className="font-bold text-accent-ink">{L('الإعدادات › الخصوصية', 'Settings › Privacy')}</Link></p>
      ) : review ? (
        <div className="flex gap-4">
          {preview && <img src={preview} alt="" className="hidden h-44 w-32 shrink-0 rounded-sm border border-line object-cover sm:block" />}
          <div className="min-w-0 flex-1">
            <p className="font-bold">{kind === 'courses' ? L(`قريت ${rows.length} مواد من الصورة`, `Read ${rows.length} courses`) : L(`قريت ${rows.length} محاضرات من الصورة`, `Read ${rows.length} sessions`)}</p>
            <p className="mb-2 text-[12.5px] text-fg-2">{L('علّم اللي تبيه. اللي عليه «تأكد» راجعه.', 'Tick what to add. Check anything marked “check”.')}</p>
            <ul>
              {rows.map((r) => (
                <li key={r.key} className="flex min-h-10 items-center gap-2 border-b border-dashed border-line text-[14px]">
                  <button type="button" disabled={r.exists} onClick={() => setPick((p) => ({ ...p, [r.key]: !p[r.key] }))} aria-pressed={!!pick[r.key]} aria-label={r.title}
                    className={clsx('grid size-6 shrink-0 place-items-center rounded-[7px] border-[1.5px] text-[13px] font-bold', pick[r.key] ? 'border-study-ink bg-study-ink text-surface' : 'border-line-strong bg-surface', r.exists && 'opacity-35')}>{pick[r.key] ? '✓' : ''}</button>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="min-w-0 flex-1"><b>{r.title}</b> <span className="text-[12px] text-fg-2">{r.sub}{r.isNew ? L(' · مادة جديدة تنضاف', ' · new course') : ''}</span></span>
                  <span className={clsx('shrink-0 rounded-full px-2 text-[11.5px] font-bold', r.exists ? 'bg-surface-2 text-fg-2' : r.unsure ? 'bg-[color-mix(in_oklab,var(--reward)_40%,var(--surface))]' : 'bg-[color-mix(in_oklab,var(--study)_40%,var(--surface))] text-study-ink')}>
                    {r.exists ? L('موجودة', 'exists') : r.unsure ? L('تأكد', 'check') : L('جديدة', 'new')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void add()} disabled={!count || busy} className="h-10 rounded-full bg-fg px-5 text-sm font-bold text-bg disabled:opacity-40">{L(`أضف المحدد (${count})`, `Add selected (${count})`)}</button>
              <button onClick={() => { setKind(null); setReadC([]); setReadS([]); setPreview(null); }} className="h-10 rounded-full border border-line px-4 text-sm font-bold">{L('إلغاء', 'Cancel')}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className={clsx('grid gap-2.5', !compact && 'sm:grid-cols-2')}>
          {([['courses', '📷', 'صوّر موادك', 'Photograph your courses', 'إشعار التسجيل أو قائمة المواد — كل مادة تنضاف باسمها ورمزها وساعاتها', 'Registration slip or course list — each course added by name, code and credits'],
             ['schedule', '🗓', 'صوّر جدولك', 'Photograph your timetable', 'الجدول من البوابة أو ورقة — كل محاضرة تنزل في يومها ووقتها وقاعتها', 'From the portal or paper — each lecture placed by day, time and room']] as const).map(([k, ic, ar, en, arH, enH]) => (
            <button key={k} onClick={() => choose(k)} disabled={busy} className="flex items-center gap-3 rounded-md border-[1.5px] border-dashed border-line-strong bg-bg/40 p-3 text-start hover:border-solid hover:border-fg disabled:opacity-50">
              <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-surface-2 text-[22px]">{busy && kind === k ? '⏳' : ic}</span>
              <span><b className="block text-[15px]">{busy && kind === k ? L('جاري القراءة…', 'Reading…') : L(ar, en)}</b><span className="text-[12.5px] text-fg-2">{L(arH, enH)}</span></span>
            </button>
          ))}
        </div>
      )}
      {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
      {done && <p className="mt-3 rounded-sm bg-[color-mix(in_oklab,var(--success)_18%,var(--surface))] p-2.5 text-[14px] font-bold text-success">✓ {done}</p>}
      <p className="mt-2 text-[11.5px] text-fg-3">🔒 {L('الصورة تنرسل للمساعد الذكي للقراءة بس، وما تنحفظ.', 'The photo goes to the AI only to read it; it isn’t stored.')}</p>
    </section>
  );
}
