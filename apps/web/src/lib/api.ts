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

/** Calls the API with the current session token. Browser only. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(data.session && { Authorization: `Bearer ${data.session.access_token}` }),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'Request failed.', e?.details);
  }
  return body as T;
}
