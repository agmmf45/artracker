const enc = new TextEncoder();

export function randomHex(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (both inputs are same-alphabet encodings). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Same scheme as v4 (salt:base64(PBKDF2-SHA256, 100k, 256 bits)) so existing passwords keep working.
async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(8);
  return `${salt}:${await pbkdf2(password, salt, 100_000)}`;
}

export async function verifyPassword(password: string, record: string | null | undefined): Promise<boolean> {
  const [salt, hash] = (record ?? '').split(':');
  if (!salt || !hash) return false;
  return safeEqual(await pbkdf2(password, salt, 100_000), hash);
}

export function hasPassword(record: string | null | undefined): boolean {
  return !!record && !record.startsWith('google:') && record.includes(':');
}
