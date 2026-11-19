/**
 * WEB_ORIGIN lists the web addresses allowed to call the API, separated by commas:
 *
 *   https://app.deeclinic.com, https://deeclinic-*.vercel.app
 *
 * A `*` matches part of a name, which covers Vercel's preview addresses. The first address that has
 * no `*` is the main one, used in links sent by email (password reset and invites).
 */
export function parseOrigins(value: string | undefined): (string | RegExp)[] {
  const items = (value ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return items.map((o) =>
    o.includes('*') ? new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`, 'i') : o,
  );
}

export function primaryOrigin(value: string | undefined): string {
  const first = parseOrigins(value).find((o): o is string => typeof o === 'string');
  return first ?? 'http://localhost:3000';
}
