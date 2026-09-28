import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { sellerTargets } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const PERIOD_MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const salesRepKey = searchParams.get('salesRepKey');
  const periodMonth = searchParams.get('periodMonth');
  if (!salesRepKey || !periodMonth || !PERIOD_MONTH_RE.test(periodMonth)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .select()
    .from(sellerTargets)
    .where(and(eq(sellerTargets.salesRepKey, salesRepKey), eq(sellerTargets.periodMonth, periodMonth)))
    .get();

  return NextResponse.json(row ?? null);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDwhAccess(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body !== 'object' ||
      typeof body.salesRepKey !== 'string' ||
      typeof body.periodMonth !== 'string' ||
      !PERIOD_MONTH_RE.test(body.periodMonth)
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const salesQuotaUsd = typeof body.salesQuotaUsd === 'number' ? body.salesQuotaUsd : null;
    const weeklyVisitQuota = typeof body.weeklyVisitQuota === 'number' ? body.weeklyVisitQuota : null;
    const newCustomerQuota = typeof body.newCustomerQuota === 'number' ? body.newCustomerQuota : null;

    const db = getDb();
    // Upsert semantics via delete-then-insert, same pattern as
    // app/api/cadencia-targets/route.ts — SQLite's ON CONFLICT upsert syntax
    // works too, but this matches the existing codebase convention exactly.
    db.delete(sellerTargets)
      .where(and(eq(sellerTargets.salesRepKey, body.salesRepKey), eq(sellerTargets.periodMonth, body.periodMonth)))
      .run();
    const result = db
      .insert(sellerTargets)
      .values({ salesRepKey: body.salesRepKey, periodMonth: body.periodMonth, salesQuotaUsd, weeklyVisitQuota, newCustomerQuota })
      .returning({ id: sellerTargets.id })
      .get();

    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
