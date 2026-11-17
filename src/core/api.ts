export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const OFFLINE_MSG = 'لا يوجد اتصال بالإنترنت';

/** Same-origin JSON API call. Session travels in an HttpOnly cookie; X-Daqeeq blocks CSRF. */
export async function api<T = unknown>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Daqeeq': '1', ...(init.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, 'offline', OFFLINE_MSG);
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? 'error', json?.message ?? `خطأ (${res.status})`);
  }
  return json as T;
}

export async function uploadFile(file: Blob, kind: 'avatar' | 'meal' | 'attachment' | 'progress'): Promise<{ id: string; url: string }> {
  const res = await fetch(`/api/v2/files?kind=${kind}`, {
    method: 'POST', credentials: 'same-origin', headers: { 'X-Daqeeq': '1' }, body: file,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error ?? 'error', json?.message ?? 'تعذر رفع الملف');
  return json;
}
