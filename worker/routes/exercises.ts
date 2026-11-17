import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/session';
import { bad } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';

/** ExerciseDB (RapidAPI) proxy. Auth + rate limit protect the paid key; inputs are allow-listed. */
export const exercises = new Hono<AppEnv>();
exercises.use('*', requireAuth);

const SLUG = /^[a-z ]{2,40}$/;
const HOST = 'exercisedb.p.rapidapi.com';

exercises.get('/', async (c) => {
  const key = (c.env.EXERCISEDB_KEY ?? '').trim();
  if (!key) return c.json({ available: false, items: [] });
  await rateLimit(c.env, `exdb:${c.get('user').id}`, 120, 3600);
  const target = (c.req.query('target') ?? '').toLowerCase();
  const bodyPart = (c.req.query('bodyPart') ?? '').toLowerCase();
  const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') ?? 15) || 15));
  const kind = target ? 'target' : bodyPart ? 'bodyPart' : null;
  const val = target || bodyPart;
  if (!kind || !SLUG.test(val)) throw bad('target_or_bodypart_required');
  const res = await fetch(`https://${HOST}/exercises/${kind}/${encodeURIComponent(val)}?limit=${limit}&offset=0`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
  });
  if (!res.ok) return c.json({ available: true, items: [] });
  const data = await res.json();
  return c.json({ available: true, items: Array.isArray(data) ? data : [] });
});

exercises.get('/image', async (c) => {
  const key = (c.env.EXERCISEDB_KEY ?? '').trim();
  const id = c.req.query('id') ?? '';
  const res = c.req.query('res') ?? '180';
  if (!key || !/^\d{1,6}$/.test(id) || !['180', '360'].includes(res)) return new Response(null, { status: 204 });
  const cacheKey = new Request(`https://exdb-img-cache.local/${id}_${res}`);
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  await rateLimit(c.env, `exdbimg:${c.get('user').id}`, 300, 3600);
  const img = await fetch(`https://${HOST}/image?exerciseId=${id}&resolution=${res}`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
  });
  const type = img.headers.get('Content-Type') ?? '';
  if (!img.ok || !type.startsWith('image/')) return new Response(null, { status: 204 });
  const out = new Response(await img.arrayBuffer(), {
    headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff' },
  });
  await cache.put(cacheKey, out.clone());
  return out;
});
