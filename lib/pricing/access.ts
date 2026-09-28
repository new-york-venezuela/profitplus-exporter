import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';

export type PricingAccessLevel = 'none' | 'view' | 'edit';

export async function getPricingAccessLevel(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<PricingAccessLevel> {
  if (role === 'admin') return 'edit';

  const grants = db
    .select({ module: schema.userModules.module })
    .from(schema.userModules)
    .where(
      and(
        eq(schema.userModules.userId, parseInt(userId, 10)),
        // Drizzle's `inArray` would also work here; `or` of two `eq` keeps
        // this readable without an extra import.
      ),
    )
    .all();

  const modules = new Set(grants.map(g => g.module));
  if (modules.has('pricing_edit')) return 'edit';
  if (modules.has('pricing_view')) return 'view';
  return 'none';
}

export type PricingAccessResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * Session + access check for every app/api/pricing/*\/route.ts handler.
 * minLevel: 'view' allows both 'view' and 'edit' grants through; 'edit'
 * requires the 'edit' grant specifically. Mirrors requireDwhAccess's shape.
 */
export async function requirePricingAccess(
  request: NextRequest,
  minLevel: 'view' | 'edit',
): Promise<PricingAccessResult> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const db = getDb();
  const level = await getPricingAccessLevel(db, session.sub, session.role);
  const allowed = minLevel === 'view' ? level !== 'none' : level === 'edit';
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
  }

  return { ok: true, session };
}
