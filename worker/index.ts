import { Hono } from 'hono';
import type { AppEnv } from './env';
import { HttpError } from './lib/http';
import { auth } from './routes/auth';
import { sync } from './routes/sync';
import { friends } from './routes/friends';
import { account } from './routes/account';
import { files } from './routes/files';
import { ai } from './routes/ai';
import { exercises } from './routes/exercises';
import { legacy } from './routes/legacy';

const app = new Hono<AppEnv>().basePath('/api');

app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', c.res.headers.get('Cache-Control') ?? 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.get('/health', (c) => c.json({ ok: true, version: 5 }));

app.route('/auth', auth);
app.route('/v2/sync', sync);
app.route('/v2/friends', friends);
app.route('/v2/account', account);
app.route('/v2/files', files);
app.route('/ai', ai);
app.route('/exercises', exercises);
app.route('/', legacy); // v4 paths (session, load, save) for clients still running the old page
app.route('/', auth); // v4 aliases: /api/login, /api/signup, /api/logout

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.code, message: err.message }, err.status as 400);
  }
  console.error('unhandled', err);
  // never leak internal error messages
  return c.json({ error: 'server_error', message: 'حدث خطأ في الخادم' }, 500);
});

export default app;
