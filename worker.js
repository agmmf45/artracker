// ── دقيق — Cloudflare Worker (/api/* handler) ──────────────────
// باقي الطلبات (index.html، الأصول) تُخدَّم من ASSETS تلقائياً
// run_worker_first: ["/api/*"]  →  هذا الملف يعالج طلبات API فقط

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

const err = (msg, s = 400) => json({ ok: false, error: msg }, s);

// ── تشفير كلمة السر (PBKDF2 — Web Crypto API) ──────────────────
const enc = new TextEncoder();

async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key  = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
  const b64  = (u8) => btoa(String.fromCharCode(...u8));
  return b64(salt) + ':' + b64(new Uint8Array(bits));
}

async function verifyPassword(pw, stored) {
  try {
    const [saltB64, hashB64] = stored.split(':');
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const key  = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
    const computed = btoa(String.fromCharCode(...new Uint8Array(bits)));
    return computed === hashB64;
  } catch { return false; }
}

function makeToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── مساعدات D1 ──────────────────────────────────────────────────
const getUser   = (DB, email) => DB.prepare('SELECT * FROM users WHERE email=?').bind(email.toLowerCase()).first();
const getUserId = (DB, id)    => DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();

async function authUser(DB, authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const tok  = authHeader.slice(7);
  const sess = await DB.prepare('SELECT * FROM sessions WHERE token=? AND expires_at>?').bind(tok, Date.now()).first();
  return sess ? getUserId(DB, sess.user_id) : null;
}

const EXP = () => Date.now() + 30 * 86_400_000; // 30 يوم

async function createSession(DB, userId) {
  const tok = makeToken();
  await DB.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)')
          .bind(tok, userId, Date.now(), EXP()).run();
  return tok;
}

function safeUser(u) { return { id: u.id, email: u.email, name: u.name, data: u.data }; }

function emptyData(name) {
  return JSON.stringify({
    display_name: name,
    code: Math.random().toString(36).slice(2, 8).toUpperCase(),
    habits_list: [], done: {}, todos: [],
    wallets: [], transactions: [], expenses: [],
    _trophies: {}, notes: {}, reminders: [],
    fitness: {}, nutrition: {},
  });
}

// ── الراوتر ─────────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const { pathname: path } = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);

    const DB = env.DB;
    if (!DB) return err('DB binding missing — check wrangler.jsonc', 500);

    let body = {};
    try { body = await req.json(); } catch {}

    // ── /api/register ─────────────────────────────────────────
    if (path === '/api/register') {
      const { email, password, name } = body;
      if (!email || !password) return err('البريد وكلمة السر مطلوبان');
      if (await getUser(DB, email))  return err('هذا البريد مسجّل مسبقاً');

      const id            = crypto.randomUUID();
      const password_hash = await hashPassword(password);
      const displayName   = name || email.split('@')[0];

      await DB.prepare(
        'INSERT INTO users (id,email,password_hash,name,data,updated_at) VALUES (?,?,?,?,?,?)'
      ).bind(id, email.toLowerCase(), password_hash, displayName, emptyData(displayName), Date.now()).run();

      const tok = await createSession(DB, id);
      const user = await getUserId(DB, id);
      return json({ ok: true, token: tok, user: safeUser(user) });
    }

    // ── /api/login ────────────────────────────────────────────
    if (path === '/api/login') {
      const { email, password } = body;
      if (!email || !password) return err('البريد وكلمة السر مطلوبان');
      const user = await getUser(DB, email);
      if (!user) return err('البريد أو كلمة السر غلط');
      if (!(await verifyPassword(password, user.password_hash))) return err('البريد أو كلمة السر غلط');

      const tok = await createSession(DB, user.id);
      return json({ ok: true, token: tok, user: safeUser(user) });
    }

    // ── /api/check ────────────────────────────────────────────
    if (path === '/api/check') {
      const user = await authUser(DB, req.headers.get('Authorization'));
      if (!user) return err('غير مصادَق', 401);
      const tok = await createSession(DB, user.id);
      return json({ ok: true, token: tok, user: safeUser(user) });
    }

    // ── /api/save ─────────────────────────────────────────────
    if (path === '/api/save') {
      const user = await authUser(DB, req.headers.get('Authorization'));
      if (!user) return err('غير مصادَق', 401);
      const { data } = body;
      if (!data) return err('data مطلوب');
      const raw = typeof data === 'string' ? data : JSON.stringify(data);
      await DB.prepare('UPDATE users SET data=?,updated_at=? WHERE id=?').bind(raw, Date.now(), user.id).run();
      return json({ ok: true });
    }

    // ── /api/users ────────────────────────────────────────────
    if (path === '/api/users') {
      const user = await authUser(DB, req.headers.get('Authorization'));
      if (!user) return err('غير مصادَق', 401);
      const all = await DB.prepare('SELECT id,email,name,data FROM users').all();
      return json({ ok: true, users: all.results });
    }

    // ── /api/reset ────────────────────────────────────────────
    if (path === '/api/reset') {
      const user = await authUser(DB, req.headers.get('Authorization'));
      if (!user) return err('غير مصادَق', 401);
      const { password } = body;
      if (!password) return err('كلمة السر مطلوبة');
      if (!(await verifyPassword(password, user.password_hash))) return err('كلمة السر غلط');
      await DB.prepare('UPDATE users SET data=?,updated_at=? WHERE id=?').bind(emptyData(user.name), Date.now(), user.id).run();
      return json({ ok: true });
    }

    return err('مسار غير موجود', 404);
  },
};
