import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';

export async function hasStatementsAccess(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<boolean> {
  if (role === 'admin') return true;
  const grant = db
    .select({ id: schema.userModules.id })
    .from(schema.userModules)
    .where(and(eq(schema.userModules.userId, parseInt(userId, 10)), eq(schema.userModules.module, 'statements')))
    .get();
  return grant !== undefined;
}

export type StatementsAccessResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export async function requireStatementsAccess(request: NextRequest): Promise<StatementsAccessResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const allowed = await hasStatementsAccess(getDb(), session.sub, session.role);
  if (!allowed) return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
  return { ok: true, session };
}
