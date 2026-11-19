import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { parseOrigins, primaryOrigin } from '../src/config/origins.js';

const allowed = (list: (string | RegExp)[], origin: string) =>
  list.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)));

describe('allowed web addresses', () => {
  const list = parseOrigins('https://app.deeclinic.com/, https://deeclinic-*.vercel.app ,http://localhost:3000');

  it('allows the listed addresses, ignoring spaces and a trailing slash', () => {
    expect(allowed(list, 'https://app.deeclinic.com')).toBe(true);
    expect(allowed(list, 'http://localhost:3000')).toBe(true);
  });

  it('lets a * cover Vercel preview names, and nothing else', () => {
    expect(allowed(list, 'https://deeclinic-git-feature-x-team.vercel.app')).toBe(true);
    expect(allowed(list, 'https://deeclinic-abc123.vercel.app')).toBe(true);
    expect(allowed(list, 'https://evil.vercel.app')).toBe(false);
    expect(allowed(list, 'https://deeclinic-abc.vercel.app.evil.com')).toBe(false);
    expect(allowed(list, 'http://app.deeclinic.com')).toBe(false);
  });

  it('defaults to the local web app', () => {
    expect(parseOrigins(undefined)).toEqual(['http://localhost:3000']);
  });

  it('uses the first address without a * for links in emails', () => {
    expect(primaryOrigin('https://deeclinic-*.vercel.app, https://app.deeclinic.com')).toBe('https://app.deeclinic.com');
    expect(primaryOrigin(undefined)).toBe('http://localhost:3000');
  });
});

describe('CORS on the API', () => {
  it('answers an allowed origin and withholds the header from others', async () => {
    process.env.WEB_ORIGIN = 'https://app.deeclinic.com,https://deeclinic-*.vercel.app';
    const app = createApp();
    const ok = await request(app).get('/api/v1/health').set('Origin', 'https://deeclinic-pr-7.vercel.app');
    expect(ok.headers['access-control-allow-origin']).toBe('https://deeclinic-pr-7.vercel.app');
    const no = await request(app).get('/api/v1/health').set('Origin', 'https://attacker.example');
    expect(no.headers['access-control-allow-origin']).toBeUndefined();
    delete process.env.WEB_ORIGIN;
  });
});
