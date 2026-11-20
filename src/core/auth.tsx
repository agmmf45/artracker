import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { closeAndDeleteDb, db, openDbWithin } from './db';
import { resetSyncStatus, setAuthLostHandler, startSyncLoop, syncNow } from './sync';

export interface User {
  id: string;
  email: string;
  name: string | null;
  profile_picture: string | null;
  has_password: boolean;
  has_google: boolean;
  migrated?: boolean;
}

type Phase = 'loading' | 'signed-out' | 'migrating' | 'ready' | 'stuck';
/** what startup is waiting on — shown on the splash if it takes long */
export type BootStep = 'account' | 'storage' | 'data';

interface AuthCtx {
  phase: Phase;
  step: BootStep;
  user: User | null;
  migration: { total: number; counts: Record<string, number>; skipped: string[] } | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  google: (credential: string) => Promise<void>;
  logout: (opts?: { force?: boolean }) => Promise<{ pending: number } | void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
};

const LAST_USER = 'dq_last_user';
const readLastUser = (): User | null => { try { const v = localStorage.getItem(LAST_USER); return v ? (JSON.parse(v) as User) : null; } catch { return null; } };

/** An abort signal that fires after `ms` (AbortSignal.timeout isn't in every phone browser yet). */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** v4 kept a bearer token in localStorage; convert it to an HttpOnly cookie session once. */
async function adoptLegacyToken() {
  const t = localStorage.getItem('artrk_token');
  if (!t) return;
  try {
    await api('/auth/adopt', {}, { headers: { Authorization: `Bearer ${t}` }, signal: timeoutSignal(8_000) });
  } catch { /* expired or offline: user signs in again */ }
  localStorage.removeItem('artrk_token');
  // v4's cached copy of the data (artrk_data_v1_*) is intentionally left in place, never deleted.
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [step, setStep] = useState<BootStep>('account');
  const [user, setUser] = useState<User | null>(null);
  const [migration, setMigration] = useState<AuthCtx['migration']>(null);
  const booted = useRef(false);

  const enter = useCallback(async (u: User) => {
    setStep('storage');
    if (!(await openDbWithin(u.id, 8_000))) { setPhase('stuck'); return; }
    localStorage.setItem(LAST_USER, JSON.stringify({ id: u.id, email: u.email, name: u.name }));
    setUser(u);
    if (u.migrated === false) {
      setPhase('migrating');
      try {
        const res = await api<{ total: number; counts: Record<string, number>; skipped: string[] }>('/v2/sync/migrate', {});
        setMigration(res);
      } catch (e) {
        console.warn('migration failed', e);
      }
    }
    const empty = (await db().records.count()) === 0;
    setStep('data');
    if (empty) await syncNow(); // first load on this device: wait for data before showing the app
    else void syncNow();
    startSyncLoop();
    setPhase('ready');
  }, []);

  const signOutLocal = useCallback(async () => {
    localStorage.removeItem(LAST_USER);
    await closeAndDeleteDb();
    resetSyncStatus();
    setUser(null);
    setPhase('signed-out');
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    setAuthLostHandler(() => { void signOutLocal(); });
    (async () => {
      await adoptLegacyToken();
      const last = readLastUser();
      if (last) {
        // local-first: open this device's copy right away; the sign-in check runs in the background
        setStep('storage');
        if (!(await openDbWithin(last.id, 8_000))) { setPhase('stuck'); return; }
        setUser(last);
        startSyncLoop();
        setPhase('ready');
        try {
          const res = await api<{ user: User }>('/auth/session', undefined, { signal: timeoutSignal(20_000) });
          if (res.user.id !== last.id || res.user.migrated === false) await enter(res.user);
          else { setUser(res.user); void syncNow(); }
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await signOutLocal();
          // offline or slow: keep working on this device's copy; sync catches up later
        }
        return;
      }
      // first visit on this device: the server decides
      try {
        const res = await api<{ user: User }>('/auth/session', undefined, { signal: timeoutSignal(15_000) });
        await enter(res.user);
      } catch {
        setPhase('signed-out');
      }
    })();
  }, [enter, signOutLocal]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ user: User }>('/auth/login', { email, password });
    const s = await api<{ user: User }>('/auth/session');
    await enter({ ...res.user, ...s.user });
  }, [enter]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    await api('/auth/signup', { email, password, name });
    const s = await api<{ user: User }>('/auth/session');
    await enter(s.user);
  }, [enter]);

  const google = useCallback(async (credential: string) => {
    await api('/auth/google', { idToken: credential });
    const s = await api<{ user: User }>('/auth/session');
    await enter(s.user);
  }, [enter]);

  const logout = useCallback(async (opts: { force?: boolean } = {}) => {
    try { await syncNow(); } catch { /* ignore */ }
    const pending = await db().outbox.count().catch(() => 0);
    if (pending && !opts.force) return { pending };
    try { await api('/auth/logout', {}); } catch { /* offline: cookie expires anyway */ }
    await signOutLocal();
  }, [signOutLocal]);

  const refreshUser = useCallback(async () => {
    const s = await api<{ user: User }>('/auth/session');
    setUser(s.user);
  }, []);

  return <Ctx.Provider value={{ phase, step, user, migration, login, signup, google, logout, refreshUser }}>{children}</Ctx.Provider>;
}
