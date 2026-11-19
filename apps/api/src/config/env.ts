import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Publishable key. Used only to verify user credentials, never for data access. */
  SUPABASE_ANON_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  /**
   * A secret mixed into every passcode before hashing. It lives only in the environment, so a
   * leaked database alone cannot be used to guess six-digit passcodes. If it is lost or changed,
   * every passcode stops working and each owner and manager sets a new one.
   */
  PASSCODE_PEPPER: z.string().min(32).optional(),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parsed lazily so routes that need no secrets (like /health) work without them. */
export function getEnv(): Env {
  if (!cached) {
    const e = process.env;
    // Supabase's newer names (SECRET / PUBLISHABLE) work as well as the older ones.
    const result = schema.safeParse({
      ...e,
      SUPABASE_SERVICE_ROLE_KEY: e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SECRET_KEY,
      SUPABASE_ANON_KEY: e.SUPABASE_ANON_KEY || e.SUPABASE_PUBLISHABLE_KEY,
    });
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Invalid environment configuration: ${fields}`);
    }
    cached = result.data;
  }
  return cached;
}
