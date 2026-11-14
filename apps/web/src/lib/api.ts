import { createClient } from './supabase/client';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** crypto.randomUUID only exists in secure contexts (https or localhost). */
export function newKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Turns an API error into one readable sentence, including field problems. */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
    const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues ?? [];
    if (issues.length) return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('. ');
  }
  return err instanceof Error ? err.message : fallback;
}

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'Request failed.', e?.details);
  }
  return body as T;
}

/** For calls made before anyone is signed in: login and "forgot password". */
export const publicApi = <T>(path: string, init: RequestInit = {}) => request<T>(path, init);

/**
 * Calls the API with the current session token. If the server says the session is
 * over (expired, or the account was deactivated), the browser signs out and goes to login.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  try {
    return await request<T>(path, init, data.session?.access_token);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.code === 'ACCOUNT_DISABLED')) {
      await supabase.auth.signOut();
      if (!window.location.pathname.startsWith('/login')) {
        // A full page load on purpose: it clears all in-memory state after the session ends
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/login?reason=${err.code === 'ACCOUNT_DISABLED' ? 'disabled' : 'expired'}`);
      }
    }
    throw err;
  }
}
