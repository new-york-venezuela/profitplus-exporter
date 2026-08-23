import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { NextRequest } from 'next/server';
import { verifyToken, type SessionPayload } from '@/lib/auth/session';
import * as schema from '@/lib/db/schema';

export async function hasInventoryAccess(
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
        eq(schema.userModules.module, 'inventory'),
      ),
    )
    .get();

  return grant !== undefined;
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}
