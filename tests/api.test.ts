/**
 * Integration tests against a running Worker with a local D1:
 *   npx wrangler dev --port 8787   (after: npm run db:migrate:local)
 *   API_URL=http://127.0.0.1:8787 npx vitest run tests/api.test.ts
 * Skipped automatically when API_URL is not set.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API = process.env.API_URL;
const d = API ? describe : describe.skip;

class Client {
  cookie = '';
  async call(path: string, body?: unknown, opts: { method?: string; csrf?: boolean } = {}) {
    const res = await fetch(`${API}/api${path}`, {
      method: opts.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...(opts.csrf === false ? {} : { 'X-Daqeeq': '1' }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json };
  }
}

const rnd = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const rec = (id: string, type: string, data: object, updated_at = now()) => ({
  id, type, data, parent_id: null, date: null, status: null, private: 0, created_at: updated_at, updated_at, deleted_at: null,
});

d('auth', () => {
  it('rejects weak passwords and unknown logins with a generic message', async () => {
    const a = new Client();
    expect((await a.call('/auth/signup', { email: `${rnd()}@t.dev`, password: '123' })).status).toBe(400);
    const r = await a.call('/auth/login', { email: `${rnd()}@nobody.dev`, password: 'whatever123' });
    expect(r.status).toBe(401);
    expect(r.json.message).toBe('الإيميل أو كلمة السر غير صحيحة');
  });

  it('signs up, keeps an HttpOnly session, and logs out', async () => {
    const a = new Client();
    const email = `${rnd()}@t.dev`;
    const s = await a.call('/auth/signup', { email, password: 'password-123' });
    expect(s.status).toBe(200);
    expect(a.cookie).toMatch(/^dq_session=/);
    expect((await a.call('/auth/session')).json.user.email).toBe(email);
    await a.call('/auth/logout', {});
    expect((await a.call('/auth/session')).status).toBe(401);
  });

  it('blocks cookie-authenticated writes without the app header (CSRF)', async () => {
    const a = new Client();
    await a.call('/auth/signup', { email: `${rnd()}@t.dev`, password: 'password-123' });
    const r = await a.call('/v2/sync/push', { mutations: [] }, { csrf: false });
    expect(r.status).toBe(403);
  });
});

d('sync + isolation between two accounts', () => {
  const A = new Client();
  const B = new Client();
  beforeAll(async () => {
    await A.call('/auth/signup', { email: `${rnd()}@a.dev`, password: 'password-123' });
    await B.call('/auth/signup', { email: `${rnd()}@b.dev`, password: 'password-123' });
  });

  it('push is idempotent and pull returns the record once', async () => {
    const r = rec('task-1', 'task', { title: 'ذاكر' });
    const m = { mutations: [{ mid: 'mid-aaaaaaaa', record: r }] };
    expect((await A.call('/v2/sync/push', m)).status).toBe(200);
    expect((await A.call('/v2/sync/push', m)).status).toBe(200);
    const pull = await A.call('/v2/sync/pull?since=0');
    const tasks = pull.json.records.filter((x: any) => x.id === 'task-1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].data.title).toBe('ذاكر');
  });

  it('account B cannot read, overwrite or delete account A records', async () => {
    // B writes the same id: it lands in B's own namespace, A is untouched
    await B.call('/v2/sync/push', { mutations: [{ mid: 'mid-bbbbbbbb', record: rec('task-1', 'task', { title: 'hacked' }, '2999-01-01T00:00:00.000Z') }] });
    const a = await A.call('/v2/sync/pull?since=0');
    expect(a.json.records.find((x: any) => x.id === 'task-1').data.title).toBe('ذاكر');
    const b = await B.call('/v2/sync/pull?since=0');
    expect(b.json.records.every((x: any) => x.data.title !== 'ذاكر')).toBe(true);
  });

  it('last writer wins on updated_at; older pushes are reported as conflicts', async () => {
    const newer = rec('task-2', 'task', { title: 'new' }, '2030-01-02T00:00:00.000Z');
    const older = rec('task-2', 'task', { title: 'old' }, '2030-01-01T00:00:00.000Z');
    await A.call('/v2/sync/push', { mutations: [{ mid: 'mid-cccccccc', record: newer }] });
    const res = await A.call('/v2/sync/push', { mutations: [{ mid: 'mid-dddddddd', record: older }] });
    expect(res.json.conflicts[0].data.title).toBe('new');
  });

  it('xp ledger rows are append-only (no duplicate or overwritten XP)', async () => {
    const x = rec('xp:task:t1:complete:0', 'xp', { amount: 10 });
    await A.call('/v2/sync/push', { mutations: [{ mid: 'mid-xp000001', record: x }] });
    await A.call('/v2/sync/push', { mutations: [{ mid: 'mid-xp000002', record: { ...x, data: { amount: 9999 }, updated_at: '2999-01-01T00:00:00.000Z' } }] });
    const pull = await A.call('/v2/sync/pull?since=0');
    const xp = pull.json.records.filter((r: any) => r.type === 'xp');
    expect(xp).toHaveLength(1);
    expect(xp[0].data.amount).toBe(10);
  });

  it('friend accept requires a pending request', async () => {
    const fa = await A.call('/v2/friends');
    const fb = await B.call('/v2/friends');
    expect((await B.call('/v2/friends/accept', { code: fa.json.code })).status).toBe(404);
    await A.call('/v2/friends/request', { code: fb.json.code });
    expect((await B.call('/v2/friends/accept', { code: fa.json.code })).status).toBe(200);
    expect((await A.call('/v2/friends')).json.friends).toHaveLength(1);
  });

  it('the removed /users endpoint no longer lists other accounts', async () => {
    const r = await A.call('/users', {});
    expect(r.json.users).toEqual([]);
  });
});
