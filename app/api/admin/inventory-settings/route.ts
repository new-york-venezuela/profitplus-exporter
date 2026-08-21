import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventorySettings } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  const row = db.select().from(inventorySettings).get();
  // The migration seeds exactly one row; this is a defensive fallback
  // in case a fresh DB somehow skipped it.
  return NextResponse.json(row ?? { rollingWindowDays: 60, daysOfStockThreshold: 7 });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const updates: Partial<{ rollingWindowDays: number; daysOfStockThreshold: number }> = {};
    if ('rollingWindowDays' in body) {
      if (typeof body.rollingWindowDays !== 'number' || body.rollingWindowDays <= 0) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      updates.rollingWindowDays = body.rollingWindowDays;
    }
    if ('daysOfStockThreshold' in body) {
      if (typeof body.daysOfStockThreshold !== 'number' || body.daysOfStockThreshold <= 0) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      updates.daysOfStockThreshold = body.daysOfStockThreshold;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const row = db.select().from(inventorySettings).get();
    if (!row) return NextResponse.json({ error: 'Error interno' }, { status: 500 });

    db.update(inventorySettings).set(updates).where(eq(inventorySettings.id, row.id)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
