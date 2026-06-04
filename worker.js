// ════════════════════════════════════════════════
//  ARTRK — Cloudflare Worker API (D1 backend)
//  يعالج: التسجيل، الدخول، الجلسة، حفظ/تحميل البيانات، الأصدقاء
// ════════════════════════════════════════════════

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const SESSION_DAYS = 60; // مدة بقاء الجلسة قبل أن تنتهي

// ── أدوات مساعدة ──
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

function uid() {
  return crypto.randomUUID();
}

function token() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

// تشفير كلمة السر باستخدام PBKDF2 (آمن)
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function makePasswordRecord(password) {
  const salt = token().slice(0, 16);
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

async function verifyPassword(password, record) {
  const [salt, hash] = (record || '').split(':');
  if (!salt || !hash) return false;
  const test = await hashPassword(password, salt);
  return test === hash;
}

// التحقق من الجلسة عبر التوكن
async function getUserFromToken(env, req) {
  const auth = req.headers.get('Authorization') || '';
  const t = auth.replace('Bearer ', '').trim();
  if (!t) return null;
  const row = await env.DB.prepare(
    'SELECT s.user_id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).bind(t).first();
  if (!row) return null;
  return { id: row.user_id, email: row.email, name: row.name };
}

// ── المعالج الرئيسي ──
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\//, '');

    // CORS preflight (في حال احتجته)
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    let body = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch { body = {}; }
    }

    try {
      // ════════ التسجيل ════════
      if (path === 'signup') {
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const name = (body.name || email).trim();
        if (!email || !password) return json({ error: 'الإيميل وكلمة السر مطلوبة' }, 400);
        if (password.length < 6) return json({ error: 'كلمة السر 6 أحرف على الأقل' }, 400);

        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) return json({ error: 'الإيميل مسجّل مسبقاً' }, 409);

        const id = uid();
        const pwRecord = await makePasswordRecord(password);
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, name, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, email, pwRecord, name, '{}', now).run();

        const t = token();
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
        ).bind(t, id, now, new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()).run();

        return json({ token: t, user: { id, email, name } });
      }

      // ════════ الدخول ════════
      if (path === 'login') {
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';
        if (!email || !password) return json({ error: 'الإيميل وكلمة السر مطلوبة' }, 400);

        const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!u) return json({ error: 'الإيميل غير مسجّل' }, 404);

        const ok = await verifyPassword(password, u.password_hash);
        if (!ok) return json({ error: 'كلمة السر غلط' }, 401);

        const t = token();
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
        ).bind(t, u.id, now, new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()).run();

        return json({ token: t, user: { id: u.id, email: u.email, name: u.name } });
      }

      // ════════ فحص الجلسة ════════
      if (path === 'session') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'no session' }, 401);
        return json({ user });
      }

      // ════════ الخروج ════════
      if (path === 'logout') {
        const auth = req.headers.get('Authorization') || '';
        const t = auth.replace('Bearer ', '').trim();
        if (t) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(t).run();
        return json({ ok: true });
      }

      // ════════ تحميل بيانات المستخدم ════════
      if (path === 'load') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const row = await env.DB.prepare('SELECT data FROM users WHERE id = ?').bind(user.id).first();
        let data = {};
        try { data = JSON.parse(row?.data || '{}'); } catch { data = {}; }
        return json({ data });
      }

      // ════════ حفظ بيانات المستخدم ════════
      if (path === 'save') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const data = body.data || {};
        const name = body.name || user.name || user.email;
        const now = new Date().toISOString();
        await env.DB.prepare(
          'UPDATE users SET data = ?, name = ?, updated_at = ? WHERE id = ?'
        ).bind(JSON.stringify(data), name, now, user.id).run();
        return json({ ok: true });
      }

      // ════════ كل المستخدمين (للأصدقاء) ════════
      if (path === 'users') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const { results } = await env.DB.prepare('SELECT name, data, updated_at FROM users').all();
        const users = (results || []).map(r => {
          let d = {};
          try { d = JSON.parse(r.data || '{}'); } catch {}
          return { name: r.name, ...d, updated_at: r.updated_at };
        });
        return json({ users });
      }

      // ════════ معرّف مستخدم عبر كود الصديق ════════
      if (path === 'user-by-code') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const code = body.code || '';
        const { results } = await env.DB.prepare('SELECT id, data FROM users').all();
        const found = (results || []).find(r => {
          try { return JSON.parse(r.data || '{}').friend_code === code; } catch { return false; }
        });
        return json({ id: found?.id || null });
      }

      // ════════ تحديث بيانات صديق (لقبول الطلبات) ════════
      if (path === 'update-user') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const targetId = body.targetId;
        const data = body.data || {};
        if (!targetId) return json({ error: 'targetId required' }, 400);
        const now = new Date().toISOString();
        await env.DB.prepare(
          'UPDATE users SET data = ?, updated_at = ? WHERE id = ?'
        ).bind(JSON.stringify(data), now, targetId).run();
        return json({ ok: true });
      }

      // ════════ تغيير كلمة السر ════════
      if (path === 'change-password') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const newPassword = body.newPassword || '';
        if (newPassword.length < 6) return json({ error: 'كلمة السر 6 أحرف على الأقل' }, 400);
        const pwRecord = await makePasswordRecord(newPassword);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(pwRecord, user.id).run();
        return json({ ok: true });
      }

      return json({ error: 'not found: ' + path }, 404);

    } catch (e) {
      return json({ error: 'server error: ' + e.message }, 500);
    }
  }
};
