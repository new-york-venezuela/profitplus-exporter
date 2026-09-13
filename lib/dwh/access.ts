import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';

export async function hasDwhAccess(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<boolean> {
  if (role === 'admin') return true;

  const grant = db
    .select({ id: schema.userModules.id })
    .from(schema.userModules)
    .where(
      and(
        eq(schema.userModules.userId, parseInt(userId, 10)),
        eq(schema.userModules.module, 'dwh'),
      ),
    )
    .get();

  return grant !== undefined;
}

export type DwhAccessResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * The session+access check every app/api/dwh/*\/route.ts GET handler needs
 * before running its own query logic — was hand-copied identically into all
 * 11 of them. Returns the session on success, or a ready-to-return
 * NextResponse (401/403) on failure, so callers just do:
 *   const auth = await requireDwhAccess(request);
 *   if (!auth.ok) return auth.response;
 */
export async function requireDwhAccess(request: NextRequest): Promise<DwhAccessResult> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
  }

  return { ok: true, session };
}
