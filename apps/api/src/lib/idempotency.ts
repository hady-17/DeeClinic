import type { Request, Response } from 'express';
import { getSupabase } from './supabase.js';

const TTL_MS = 24 * 3600 * 1000;

interface Result {
  status: number;
  body: unknown;
}

/**
 * Makes a POST safe to retry. If the request carries an Idempotency-Key and the same
 * user already used it on this route in the last 24 hours, the stored response is
 * returned instead of running the handler again. Only successful results are stored.
 */
export async function withIdempotency(
  req: Request,
  res: Response,
  run: () => Promise<Result>,
): Promise<void> {
  const header = req.header('idempotency-key')?.trim();
  if (!header) {
    const r = await run();
    res.status(r.status).json(r.body);
    return;
  }

  const supabase = getSupabase();
  const key = `${req.user!.id}:${header.slice(0, 200)}`;
  const route = `${req.method} ${req.baseUrl}${req.route.path}`;

  const { data: existing, error } = await supabase
    .from('idempotency_keys')
    .select('response, status_code, created_at')
    .eq('key', key)
    .eq('route', route)
    .maybeSingle();
  if (error) throw error;
  if (existing && Date.now() - new Date(existing.created_at as string).getTime() < TTL_MS) {
    res.status(existing.status_code as number).json(existing.response);
    return;
  }

  const r = await run();
  if (r.status >= 200 && r.status < 300) {
    const { error: saveError } = await supabase.from('idempotency_keys').upsert(
      { key, route, response: r.body, status_code: r.status, created_at: new Date().toISOString() },
      { onConflict: 'key,route' },
    );
    if (saveError) throw saveError;
  }
  res.status(r.status).json(r.body);
}
