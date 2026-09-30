process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, qrCodes } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as list, POST as create } from '@/app/api/qr/route';
import { PATCH, DELETE } from '@/app/api/qr/[id]/route';
import { GET as getLogo } from '@/app/api/qr/[id]/logo/route';

const logoDir = mkdtempSync(path.join(tmpdir(), 'qr-logos-'));
process.env.QR_LOGO_DIR = logoDir;
afterAll(() => rmSync(logoDir, { recursive: true, force: true }));

// 1x1 transparent PNG
const PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
), c => c.charCodeAt(0));

async function userToken(email: string) {
  const db = getDb();
  const u = db.insert(users).values({
    email, name: email, passwordHash: 'x', role: 'user', createdAt: Date.now(),
  }).returning({ id: users.id }).get()!;
  return { id: u.id, token: await signToken({ sub: String(u.id), role: 'user', name: email }) };
}

function form(fields: Record<string, string>, logo?: { bytes: Uint8Array; type: string; name?: string }) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (logo) f.set('logo', new File([logo.bytes], logo.name ?? 'logo.bin', { type: logo.type }));
  return f;
}

function req(token: string | null, method: string, body?: FormData) {
  const headers: Record<string, string> = {};
  if (token) headers.Cookie = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/qr', { method, body, headers });
}

const ctx = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });
const base = { name: 'Menú', content: 'https://example.com', logoMode: 'default', fgColor: '#112233' };

describe('/api/qr', () => {
  beforeEach(() => {
    getDb().delete(qrCodes).run();
    getDb().delete(users).run();
    for (const f of readdirSync(logoDir)) rmSync(path.join(logoDir, f));
  });

  test('401 without session', async () => {
    expect((await list(req(null, 'GET'))).status).toBe(401);
    expect((await create(req(null, 'POST', form(base)))).status).toBe(401);
  });

  test('create then list returns only own items, without logoPath', async () => {
    const a = await userToken('a@x.com');
    const b = await userToken('b@x.com');
    const res = await create(req(a.token, 'POST', form(base)));
    expect(res.status).toBe(201);
    const { item } = await res.json();
    expect(item).toMatchObject({ name: 'Menú', content: 'https://example.com', logoMode: 'default', fgColor: '#112233' });
    expect(item.logoPath).toBeUndefined();

    const mine = await (await list(req(a.token, 'GET'))).json();
    expect(mine.items).toHaveLength(1);
    const theirs = await (await list(req(b.token, 'GET'))).json();
    expect(theirs.items).toHaveLength(0);
  });

  test('another user gets 404 on PATCH, DELETE and logo', async () => {
    const a = await userToken('a@x.com');
    const b = await userToken('b@x.com');
    const { item } = await (await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: PNG, type: 'image/png' })))).json();
    expect((await PATCH(req(b.token, 'PATCH', form(base)), ctx(item.id))).status).toBe(404);
    expect((await DELETE(req(b.token, 'DELETE'), ctx(item.id))).status).toBe(404);
    expect((await getLogo(req(b.token, 'GET'), ctx(item.id))).status).toBe(404);
  });

  test('whitespace-only name/content and bad color are 400', async () => {
    const a = await userToken('a@x.com');
    expect((await create(req(a.token, 'POST', form({ ...base, name: '   ' })))).status).toBe(400);
    expect((await create(req(a.token, 'POST', form({ ...base, content: '  ' })))).status).toBe(400);
    expect((await create(req(a.token, 'POST', form({ ...base, fgColor: 'red;"><script>' })))).status).toBe(400);
    expect((await create(req(a.token, 'POST', form({ ...base, logoMode: 'weird' })))).status).toBe(400);
  });

  test('content is capped by UTF-8 bytes, not characters', async () => {
    const a = await userToken('a@x.com');
    const ok = 'a'.repeat(1000);
    expect((await create(req(a.token, 'POST', form({ ...base, content: ok })))).status).toBe(201);
    const tooManyBytes = 'ñ'.repeat(501); // 501 chars, 1002 bytes
    const res = await create(req(a.token, 'POST', form({ ...base, content: tooManyBytes })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('1000');
  });

  test('logo: bytes are sniffed, spoofed MIME rejected, size capped', async () => {
    const a = await userToken('a@x.com');
    const spoof = new TextEncoder().encode('<html>not a png</html>');
    expect((await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: spoof, type: 'image/png' })))).status).toBe(400);
    const big = new Uint8Array(1_000_001); big.set(PNG);
    expect((await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: big, type: 'image/png' })))).status).toBe(400);
    expect((await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' })))).status).toBe(400); // custom without file
    expect(readdirSync(logoDir)).toHaveLength(0);
  });

  test('svg logo is served sandboxed with nosniff', async () => {
    const a = await userToken('a@x.com');
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const { item } = await (await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: svg, type: 'image/svg+xml' })))).json();
    const res = await getLogo(req(a.token, 'GET'), ctx(item.id));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
  });

  test('replacing or dropping the custom logo deletes the old file', async () => {
    const a = await userToken('a@x.com');
    const { item } = await (await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: PNG, type: 'image/png' })))).json();
    expect(readdirSync(logoDir)).toHaveLength(1);
    const first = readdirSync(logoDir)[0];

    await PATCH(req(a.token, 'PATCH', form({ ...base, logoMode: 'custom' }, { bytes: PNG, type: 'image/png' })), ctx(item.id));
    expect(readdirSync(logoDir)).toHaveLength(1);
    expect(readdirSync(logoDir)[0]).not.toBe(first);

    const res = await PATCH(req(a.token, 'PATCH', form({ ...base, logoMode: 'none' })), ctx(item.id));
    expect(res.status).toBe(200);
    expect(readdirSync(logoDir)).toHaveLength(0);
  });

  test('PATCH keeping logoMode=custom without a new file keeps the existing logo', async () => {
    const a = await userToken('a@x.com');
    const { item } = await (await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: PNG, type: 'image/png' })))).json();
    const res = await PATCH(req(a.token, 'PATCH', form({ ...base, logoMode: 'custom', name: 'Renamed' })), ctx(item.id));
    expect(res.status).toBe(200);
    expect((await res.json()).item.name).toBe('Renamed');
    expect(readdirSync(logoDir)).toHaveLength(1);
  });

  test('DELETE removes the row and its logo file; bad ids are 404', async () => {
    const a = await userToken('a@x.com');
    const { item } = await (await create(req(a.token, 'POST', form({ ...base, logoMode: 'custom' }, { bytes: PNG, type: 'image/png' })))).json();
    expect((await DELETE(req(a.token, 'DELETE'), ctx(item.id))).status).toBe(200);
    expect(readdirSync(logoDir)).toHaveLength(0);
    expect(getDb().select().from(qrCodes).all()).toHaveLength(0);
    expect((await DELETE(req(a.token, 'DELETE'), ctx('abc'))).status).toBe(404);
    expect((await DELETE(req(a.token, 'DELETE'), ctx(99999))).status).toBe(404);
  });
});
