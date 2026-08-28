import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings } from '@/lib/db/schema';

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
  const row = db.select().from(invoiceReminderSettings).get();
  return NextResponse.json(row ?? { id: 0, thresholdDays: 3 });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.thresholdDays !== 'number' || body.thresholdDays <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    const row = db.select().from(invoiceReminderSettings).get();
    if (!row) return NextResponse.json({ error: 'Error interno' }, { status: 500 });

    db.update(invoiceReminderSettings).set({ thresholdDays: body.thresholdDays })
      .where(eq(invoiceReminderSettings.id, row.id)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
