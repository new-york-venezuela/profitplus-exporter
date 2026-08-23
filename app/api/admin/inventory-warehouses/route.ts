import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  const rows = db.select().from(inventoryWarehouses).all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body.coAlma !== 'string' || typeof body.label !== 'string') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (body.coAlma.trim().length === 0 || body.label.trim().length === 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const result = db.insert(inventoryWarehouses).values({
      coAlma: body.coAlma.trim(),
      label:  body.label.trim(),
      active: true,
    }).returning({ id: inventoryWarehouses.id }).get();

    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
