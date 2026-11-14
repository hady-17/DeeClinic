/**
 * Reads how a session was started (password, emailed link, ...) from the token.
 * The token has already been verified by Supabase; this only inspects its claims.
 */
export function sessionMethods(token: string): string[] {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    const amr = payload.amr as { method?: string }[] | undefined;
    return (amr ?? []).map((a) => a.method ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

/** True when the session came from a password login and nothing else. */
export const isPasswordOnlySession = (token: string) => {
  const methods = sessionMethods(token);
  return methods.length > 0 && methods.every((m) => m === 'password');
};
