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

// ── أدوات بيانات المستخدم (لعمليات الأصدقاء على السيرفر) ──
async function getDataById(env, id) {
  const row = await env.DB.prepare('SELECT data FROM users WHERE id = ?').bind(id).first();
  try { return JSON.parse(row?.data || '{}'); } catch { return {}; }
}
async function saveDataById(env, id, data) {
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE users SET data = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(data), now, id).run();
}
async function findUserByCode(env, code) {
  if (!code) return null;
  const { results } = await env.DB.prepare('SELECT id, data FROM users').all();
  for (const r of (results || [])) {
    try {
      const d = JSON.parse(r.data || '{}');
      if (d.friend_code === code) return { id: r.id, data: d };
    } catch {}
  }
  return null;
}
function arrPush(arr, v) { arr = Array.isArray(arr) ? arr : []; if (!arr.includes(v)) arr.push(v); return arr; }
function arrDrop(arr, v) { return (Array.isArray(arr) ? arr : []).filter(x => x !== v); }

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

      // ════════ Google Sign-In ════════
      if (path === 'auth/google') {
        const idToken = (body.idToken || '').trim();
        if (!idToken) return json({ error: 'no token' }, 400);

        // Verify the Google ID token server-side
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (!verifyRes.ok) return json({ error: 'فشل التحقق من Google' }, 401);
        const info = await verifyRes.json();

        // Reject tokens with errors or wrong audience
        if (info.error_description) return json({ error: info.error_description }, 401);
        if (info.aud !== env.GOOGLE_CLIENT_ID) return json({ error: 'invalid audience' }, 401);

        const googleId   = info.sub;
        const email      = (info.email  || '').trim().toLowerCase();
        const name       = (info.name   || email.split('@')[0] || 'مستخدم').trim();
        const picture    = info.picture || null;
        const now        = new Date().toISOString();

        // 1. Look up by google_id first
        let user = await env.DB.prepare(
          'SELECT id, email, name FROM users WHERE google_id = ?'
        ).bind(googleId).first();

        // 2. Fallback: match by email (links an existing email/password account)
        if (!user && email) {
          user = await env.DB.prepare(
            'SELECT id, email, name FROM users WHERE email = ?'
          ).bind(email).first();
        }

        if (!user) {
          // New user — create account (no password)
          const id = uid();
          await env.DB.prepare(
            `INSERT INTO users
               (id, email, name, google_id, profile_picture, last_login_at, password_hash, data, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, email, name, googleId, picture, now, 'google:', '{}', now).run();
          user = { id, email, name };
        } else {
          // Existing user — link google_id + refresh profile
          await env.DB.prepare(
            `UPDATE users
             SET google_id = ?, profile_picture = ?, last_login_at = ?, updated_at = ?
             WHERE id = ?`
          ).bind(googleId, picture, now, now, user.id).run();
        }

        // Create session
        const t = token();
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
        ).bind(t, user.id, now, new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()).run();

        return json({
          ok: true,
          token: t,
          user: { id: user.id, email, name, profile_picture: picture }
        });
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

      // ════════ كل المستخدمين (للأصدقاء) — حقول عامة فقط ════════
      // لا نرسل المصاريف/الأوزان/الملاحظات/التغذية. فقط ما تحتاجه شاشة الأصدقاء.
      if (path === 'users') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const todayKey = new Date().toISOString().slice(0, 10);
        const { results } = await env.DB.prepare('SELECT name, data, updated_at FROM users').all();
        const users = (results || []).map(r => {
          let d = {};
          try { d = JSON.parse(r.data || '{}'); } catch {}
          // أرسل إنجاز اليوم فقط (لا كامل السجل التاريخي)
          const doneToday = (d.done && d.done[todayKey]) ? { [todayKey]: d.done[todayKey] } : {};
          return {
            name: r.name,
            updated_at: r.updated_at,
            friend_code: d.friend_code || null,
            display_name: d.display_name || null,
            avatar_emoji: d.avatar_emoji || null,
            avatar_color: d.avatar_color || null,
            avatar_photo: d.avatar_photo || null,
            status_note: d.status_note || null,
            habits_list: Array.isArray(d.habits_list) ? d.habits_list : [],
            done: doneToday,
          };
        });
        return json({ users });
      }

      // ════════ طلب صداقة (على السيرفر — لا يكشف بيانات الطرف الآخر) ════════
      if (path === 'friend/request') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const code = (body.code || '').trim().toUpperCase();
        if (!code) return json({ error: 'code required' }, 400);

        const myData = await getDataById(env, user.id);
        const myCode = myData.friend_code;
        if (!myCode) return json({ error: 'no friend code' }, 400);
        if (code === myCode) return json({ error: 'self' }, 400);
        if ((myData.friends || []).includes(code)) return json({ ok: true, already: true });

        const target = await findUserByCode(env, code);
        if (!target) return json({ error: 'not found' }, 404);

        // متبادل؟ الطرف الآخر أرسل لي طلباً مسبقاً → صداقة فورية
        const mutual = (target.data.sent_requests || []).includes(myCode);
        if (mutual) {
          myData.friends = arrPush(myData.friends, code);
          myData.incoming_requests = arrDrop(myData.incoming_requests, code);
          target.data.friends = arrPush(target.data.friends, myCode);
          target.data.sent_requests = arrDrop(target.data.sent_requests, myCode);
        } else {
          myData.sent_requests = arrPush(myData.sent_requests, code);
          target.data.incoming_requests = arrPush(target.data.incoming_requests, myCode);
        }
        await saveDataById(env, user.id, myData);
        await saveDataById(env, target.id, target.data);
        return json({ ok: true, mutual, name: target.data.display_name || target.data.friend_code });
      }

      // ════════ قبول طلب صداقة ════════
      if (path === 'friend/accept') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const code = (body.code || '').trim().toUpperCase();
        if (!code) return json({ error: 'code required' }, 400);

        const myData = await getDataById(env, user.id);
        const myCode = myData.friend_code;
        myData.friends = arrPush(myData.friends, code);
        myData.incoming_requests = arrDrop(myData.incoming_requests, code);
        await saveDataById(env, user.id, myData);

        const target = await findUserByCode(env, code);
        if (target) {
          target.data.friends = arrPush(target.data.friends, myCode);
          target.data.sent_requests = arrDrop(target.data.sent_requests, myCode);
          await saveDataById(env, target.id, target.data);
        }
        return json({ ok: true, name: target?.data?.display_name || code });
      }

      // ════════ رفض طلب صداقة ════════
      if (path === 'friend/reject') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const code = (body.code || '').trim().toUpperCase();
        if (!code) return json({ error: 'code required' }, 400);

        const myData = await getDataById(env, user.id);
        const myCode = myData.friend_code;
        myData.incoming_requests = arrDrop(myData.incoming_requests, code);
        await saveDataById(env, user.id, myData);

        const target = await findUserByCode(env, code);
        if (target) {
          target.data.sent_requests = arrDrop(target.data.sent_requests, myCode);
          await saveDataById(env, target.id, target.data);
        }
        return json({ ok: true });
      }

      // ════════ إزالة صديق (من الطرفين) ════════
      if (path === 'friend/remove') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);
        const code = (body.code || '').trim().toUpperCase();
        if (!code) return json({ error: 'code required' }, 400);

        const myData = await getDataById(env, user.id);
        const myCode = myData.friend_code;
        myData.friends = arrDrop(myData.friends, code);
        await saveDataById(env, user.id, myData);

        const target = await findUserByCode(env, code);
        if (target) {
          target.data.friends = arrDrop(target.data.friends, myCode);
          await saveDataById(env, target.id, target.data);
        }
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

      // ════════ سجّل حدث مزامنة صحية ════════
      if (path === 'health/sync-log') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);

        const platform = (body.platform || '').toLowerCase();
        if (!['healthkit', 'health_connect'].includes(platform)) {
          return json({ error: 'invalid platform' }, 400);
        }

        const now = new Date().toISOString();
        const id = uid();

        // Upsert sync state row
        await env.DB.prepare(`
          INSERT INTO health_sync
            (id, user_id, platform, last_sync_at, last_pull_cursor, status,
             records_pushed, records_pulled, error_msg, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, platform) DO UPDATE SET
            last_sync_at     = excluded.last_sync_at,
            last_pull_cursor = COALESCE(excluded.last_pull_cursor, last_pull_cursor),
            status           = excluded.status,
            error_msg        = excluded.error_msg,
            records_pushed   = records_pushed + excluded.records_pushed,
            records_pulled   = records_pulled + excluded.records_pulled,
            updated_at       = excluded.updated_at
        `).bind(
          id,
          user.id,
          platform,
          body.synced_at || now,
          body.pull_cursor || null,
          body.status || 'idle',
          body.pushed  || 0,
          body.pulled  || 0,
          body.error   || null,
          now,
          now
        ).run();

        // Persist server-side dedup hashes sent from client
        const hashes = Array.isArray(body.dedup_hashes) ? body.dedup_hashes.slice(0, 200) : [];
        if (hashes.length) {
          const stmt = env.DB.prepare(`
            INSERT OR IGNORE INTO sync_dedup (record_hash, user_id, data_type, source, synced_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          await env.DB.batch(
            hashes.map(h => stmt.bind(h.hash, user.id, h.type || 'unknown', h.source || platform, now))
          );
        }

        return json({ ok: true });
      }

      // ════════ حالة المزامنة ════════
      if (path === 'health/status') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);

        const { results } = await env.DB.prepare(
          'SELECT platform, last_sync_at, status, records_pushed, records_pulled, error_msg FROM health_sync WHERE user_id = ?'
        ).bind(user.id).all();

        return json({ sync: results || [] });
      }

      // ════════ التحقق من التكرار على السيرفر ════════
      if (path === 'health/check-dedup') {
        const user = await getUserFromToken(env, req);
        if (!user) return json({ error: 'unauthorized' }, 401);

        const hashes = Array.isArray(body.hashes) ? body.hashes.slice(0, 500) : [];
        if (!hashes.length) return json({ seen: [] });

        const placeholders = hashes.map(() => '?').join(',');
        const { results } = await env.DB.prepare(
          `SELECT record_hash FROM sync_dedup WHERE user_id = ? AND record_hash IN (${placeholders})`
        ).bind(user.id, ...hashes).all();

        return json({ seen: (results || []).map(r => r.record_hash) });
      }

      // ════════ صور التمارين — proxy مع Cloudflare edge cache ════════
      if (path === 'exercise-image') {
        if (req.method !== 'GET') return new Response('', { status: 405 });

        const exId  = (url.searchParams.get('id')  || '').trim();
        const res   = (url.searchParams.get('res') || '180').trim();
        const key   = (env.EXERCISEDB_KEY || '').trim();

        if (!exId || !key) return new Response('', { status: 204 });

        // Check Cloudflare's cache first
        const cacheKey = new Request(
          `https://exercisedb-img-cache/${exId}_${res}`,
          { method: 'GET' }
        );
        const cache = caches.default;
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        try {
          const imgRes = await fetch(
            `https://exercisedb.p.rapidapi.com/image?exerciseId=${encodeURIComponent(exId)}&resolution=${res}`,
            { headers: {
                'x-rapidapi-key':  key,
                'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
                'Content-Type': 'application/json'
              }
            }
          );
          if (!imgRes.ok) return new Response('', { status: 204 });

          const ct  = imgRes.headers.get('Content-Type') || 'image/gif';
          const buf = await imgRes.arrayBuffer();

          const resp = new Response(buf, {
            status: 200,
            headers: {
              'Content-Type':  ct,
              'Cache-Control': 'public, max-age=604800', // 7 أيام
              'Access-Control-Allow-Origin': '*',
            }
          });
          // Store in Cloudflare edge cache
          await cache.put(cacheKey, resp.clone());
          return resp;
        } catch {
          return new Response('', { status: 204 });
        }
      }

      // ════════ بيانات التمارين — proxy لـ ExerciseDB عبر RapidAPI ════════
      if (path === 'exercises') {
        if (req.method !== 'GET') return json({ error: 'GET only' }, 405);

        const target   = url.searchParams.get('target')   || '';
        const bodyPart = url.searchParams.get('bodyPart') || '';
        const limit    = Math.min(20, parseInt(url.searchParams.get('limit') || '15', 10));

        const key = (env.EXERCISEDB_KEY || '').trim();
        if (!key) {
          // المفتاح غير مضاف بعد — أعد مصفوفة فارغة بدل خطأ 5xx
          return json([]);
        }

        const base = 'https://exercisedb.p.rapidapi.com';
        const apiPath = target
          ? `/exercises/target/${encodeURIComponent(target)}?limit=${limit}&offset=0`
          : bodyPart
          ? `/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=${limit}&offset=0`
          : null;

        if (!apiPath) return json({ error: 'target or bodyPart required' }, 400);

        try {
          const res = await fetch(`${base}${apiPath}`, {
            headers: {
              'x-rapidapi-key':  key,
              'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
            }
          });
          if (!res.ok) return json([]);          // رجّع فارغ — الـ client يعرض خطأ نظيف
          const data = await res.json();
          return json(Array.isArray(data) ? data : []);
        } catch {
          return json([]);
        }
      }

      return json({ error: 'not found: ' + path }, 404);

    } catch (e) {
      return json({ error: 'server error: ' + e.message }, 500);
    }
  }
};
