import type { Context } from 'hono';
import type { AppEnv } from '../env';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const bad = (code: string, message?: string) => new HttpError(400, code, message);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'سجّل دخولك من جديد');
export const notFound = (code = 'not_found') => new HttpError(404, code);

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'local';
}

export async function readJson<T = unknown>(c: Context<AppEnv>, maxBytes = 2_000_000): Promise<T> {
  const len = Number(c.req.header('Content-Length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large');
  const text = await c.req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large');
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw bad('invalid_json');
  }
}

export const nowIso = () => new Date().toISOString();
