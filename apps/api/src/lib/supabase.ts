import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env.js';

let client: SupabaseClient | undefined;

/**
 * A throwaway client for checking a user's credentials. Uses the publishable key and
 * a fresh instance each time, so one person's session never leaks into another request.
 */
export function createAuthClient(): SupabaseClient {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Service-role client. Server only: it bypasses row-level security. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
