import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const warehouseId = parseInt(id, 10);
    if (isNaN(warehouseId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id, warehouseId)).get();
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    db.update(inventoryWarehouses).set({ active: body.active }).where(eq(inventoryWarehouses.id, warehouseId)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const warehouseId = parseInt(id, 10);
    if (isNaN(warehouseId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const db = getDb();
    const existing = db.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id, warehouseId)).get();
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    db.delete(inventoryWarehouses).where(eq(inventoryWarehouses.id, warehouseId)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
