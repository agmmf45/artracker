import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/session';
import { bad, HttpError, nowIso } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif'], ['application/pdf', 'pdf'],
]);
const KINDS = new Set(['avatar', 'meal', 'attachment', 'progress']);
const MAX = 8 * 1024 * 1024;

/** Magic-byte sniffing so a renamed file cannot pretend to be an image. */
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  return null;
}

export const files = new Hono<AppEnv>();
files.use('*', requireAuth);

files.get('/status', (c) => c.json({ available: !!c.env.FILES }));

files.post('/', async (c) => {
  const user = c.get('user');
  if (!c.env.FILES) throw new HttpError(503, 'storage_unavailable', 'تخزين الملفات غير مفعّل بعد');
  await rateLimit(c.env, `upload:${user.id}`, 60, 3600);
  const kind = c.req.query('kind') ?? 'attachment';
  if (!KINDS.has(kind)) throw bad('invalid_kind');
  const buf = new Uint8Array(await c.req.arrayBuffer());
  if (!buf.length || buf.length > MAX) throw new HttpError(413, 'too_large', 'الحد الأقصى 8MB');
  const mime = sniff(buf);
  if (!mime || !ALLOWED.has(mime)) throw bad('unsupported_type', 'نوع الملف غير مدعوم');
  const id = crypto.randomUUID();
  const key = `u/${user.id}/${kind}/${id}.${ALLOWED.get(mime)}`;
  await c.env.FILES.put(key, buf, { httpMetadata: { contentType: mime } });
  await c.env.DB.prepare('INSERT INTO files (user_id, id, r2_key, mime, size, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(user.id, id, key, mime, buf.length, kind, nowIso()).run();
  return c.json({ id, mime, size: buf.length, url: `/api/v2/files/${id}` });
});

files.get('/:id', async (c) => {
  const user = c.get('user');
  if (!c.env.FILES) throw new HttpError(503, 'storage_unavailable');
  const row = await c.env.DB.prepare('SELECT r2_key, mime FROM files WHERE user_id = ? AND id = ?').bind(user.id, c.req.param('id'))
    .first<{ r2_key: string; mime: string }>();
  if (!row) throw new HttpError(404, 'not_found');
  const obj = await c.env.FILES.get(row.r2_key);
  if (!obj) throw new HttpError(404, 'not_found');
  return new Response(obj.body, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': row.mime === 'application/pdf' ? 'attachment' : 'inline',
    },
  });
});

files.delete('/:id', async (c) => {
  const user = c.get('user');
  const row = await c.env.DB.prepare('SELECT r2_key FROM files WHERE user_id = ? AND id = ?').bind(user.id, c.req.param('id')).first<{ r2_key: string }>();
  if (!row) return c.json({ ok: true });
  await c.env.FILES?.delete(row.r2_key);
  await c.env.DB.prepare('DELETE FROM files WHERE user_id = ? AND id = ?').bind(user.id, c.req.param('id')).run();
  return c.json({ ok: true });
});
