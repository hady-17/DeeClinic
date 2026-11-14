import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { AppError } from './errors.js';
import { logger } from './logger.js';
import { getSupabase } from './supabase.js';

export interface RateLimitStore {
  /** Counts one hit in the current fixed window and returns the total so far. */
  hit(key: string, windowSeconds: number): Promise<number>;
  reset(key: string): Promise<void>;
}

/** Shared across serverless instances, because the count lives in Postgres. */
export const dbStore: RateLimitStore = {
  async hit(key, windowSeconds) {
    const { data, error } = await getSupabase().rpc('rate_limit_hit', {
      p_key: key,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data as number;
  },
  async reset(key) {
    const { error } = await getSupabase().from('rate_limits').delete().eq('key', key);
    if (error) throw error;
  },
};

/** For tests and local use. Counts are per process only. */
export class MemoryStore implements RateLimitStore {
  private counts = new Map<string, number>();
  async hit(key: string, windowSeconds: number) {
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const k = `${key}|${window}`;
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    return n;
  }
  async reset(key: string) {
    for (const k of this.counts.keys()) if (k.startsWith(`${key}|`)) this.counts.delete(k);
  }
}

const memory = new MemoryStore();
export const defaultStore = (): RateLimitStore =>
  process.env.NODE_ENV === 'test' ? memory : dbStore;

/** Keys are hashed so emails and IPs never sit in the table in clear text. */
export const keyOf = (name: string, value: string) =>
  `${name}:${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;

export async function checkLimit(opts: {
  name: string;
  value: string;
  limit: number;
  windowSeconds: number;
  store?: RateLimitStore;
}): Promise<void> {
  const store = opts.store ?? defaultStore();
  const count = await store.hit(keyOf(opts.name, opts.value), opts.windowSeconds);
  if (count > opts.limit) {
    const err = AppError.tooManyRequests();
    err.retryAfter = opts.windowSeconds;
    throw err;
  }
}

/**
 * Limits requests per key. Protective endpoints fail closed (if the counter is
 * unreachable the request is refused). The general limiter fails open, so a
 * database blip does not take the whole app down.
 */
export function rateLimit(opts: {
  name: string;
  limit: number;
  windowSeconds: number;
  key?: (req: Request) => string;
  failOpen?: boolean;
  store?: RateLimitStore;
}): RequestHandler {
  const keyFor = opts.key ?? ((req) => req.ip ?? 'unknown');
  return async (req, res, next) => {
    try {
      await checkLimit({
        name: opts.name,
        value: keyFor(req),
        limit: opts.limit,
        windowSeconds: opts.windowSeconds,
        store: opts.store,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (!opts.failOpen) throw err;
      logger.warn({ err, limiter: opts.name }, 'Rate limiter unavailable, allowing request');
    }
    next();
  };
}
