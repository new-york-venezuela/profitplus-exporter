import { describe, test, expect, mock } from 'bun:test';
import type { NextRequest } from 'next/server';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from '@/lib/db/schema';

const mockGetSessionFromRequest = mock(async () => null as { sub: string; role: 'user' | 'admin' } | null);

mock.module('@/lib/inventory/access', () => ({
  getSessionFromRequest: mockGetSessionFromRequest,
}));
const fakeDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        get: () => undefined, // no module grant found
      }),
    }),
  }),
};

mock.module('@/lib/db/sqlite', () => ({
  getDb: () => fakeDb,
}));
mock.module('@/lib/db/schema', () => ({
  userModules: { id: 'id', userId: 'userId', module: 'module' },
}));

const { requireDwhAccess, hasDwhAccess } = await import('../access');

// requireDwhAccess's own logic is what's under test here — hasDwhAccess
// itself is real, but its DB call is never reached because these tests
// stub the session lookup to short-circuit before it, or force role
// checks that don't touch the DB (admin bypasses it entirely).
function fakeRequest(): NextRequest {
  return {} as NextRequest;
}

describe('requireDwhAccess', () => {
  test('returns 401 when there is no session', async () => {
    mockGetSessionFromRequest.mockImplementation(async () => null);

    const result = await requireDwhAccess(fakeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error).toBe('No autorizado');
    }
  });

  test('returns 403 when the session has no dwh module grant', async () => {
    mockGetSessionFromRequest.mockImplementation(async () => ({ sub: '1', role: 'user' }));

    const result = await requireDwhAccess(fakeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toBe('Prohibido');
    }
  });

  test('returns the session when the user is an admin', async () => {
    mockGetSessionFromRequest.mockImplementation(async () => ({ sub: '1', role: 'admin' }));

    const result = await requireDwhAccess(fakeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.role).toBe('admin');
    }
  });
});

describe('hasDwhAccess', () => {
  test('admins always have access, regardless of module grants', async () => {
    // role === 'admin' short-circuits before the db param is ever touched,
    // so an empty stand-in is fine here — this is not exercising the query path.
    const allowed = await hasDwhAccess({} as unknown as BunSQLiteDatabase<typeof schema>, '1', 'admin');
    expect(allowed).toBe(true);
  });
});
