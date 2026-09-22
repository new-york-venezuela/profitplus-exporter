import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { visitCadenceTargets } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const rows = db.select().from(visitCadenceTargets).all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDwhAccess(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.targetGapDays !== 'number' || body.targetGapDays <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const hasEntityKey = 'legalEntityKey' in body && typeof body.legalEntityKey === 'number';
    const hasSegment = 'segmentCode' in body && (body.segmentCode === 'CADENA' || body.segmentCode === 'INDEPENDIENTES');
    if (!hasEntityKey && !hasSegment) {
      return NextResponse.json({ error: 'Debe especificar legalEntityKey o segmentCode' }, { status: 400 });
    }
    if (hasEntityKey && hasSegment) {
      return NextResponse.json({ error: 'Especifique solo uno: legalEntityKey o segmentCode' }, { status: 400 });
    }

    const db = getDb();

    // Upsert semantics: one target row per (legalEntityKey) or per (segmentCode
    // with null legalEntityKey) — delete any existing row for the same key
    // before inserting, since there's no natural unique constraint spanning
    // two nullable columns in SQLite that cleanly expresses this.
    if (hasEntityKey) {
      db.delete(visitCadenceTargets).where(eq(visitCadenceTargets.legalEntityKey, body.legalEntityKey)).run();
      const result = db.insert(visitCadenceTargets).values({
        legalEntityKey: body.legalEntityKey,
        segmentCode: null,
        targetGapDays: body.targetGapDays,
      }).returning({ id: visitCadenceTargets.id }).get();
      return NextResponse.json({ id: result?.id }, { status: 201 });
    }

    db.delete(visitCadenceTargets).where(eq(visitCadenceTargets.segmentCode, body.segmentCode)).run();
    const result = db.insert(visitCadenceTargets).values({
      legalEntityKey: null,
      segmentCode: body.segmentCode,
      targetGapDays: body.targetGapDays,
    }).returning({ id: visitCadenceTargets.id }).get();
    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireDwhAccess(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam || !/^\d+$/.test(idParam)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    db.delete(visitCadenceTargets).where(eq(visitCadenceTargets.id, Number(idParam))).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
