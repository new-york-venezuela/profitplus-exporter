import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseAreaPatch } from '@/lib/geo/area-validation';
import {
  updateArea, deleteArea, AreaNotFoundError, DuplicateAreaError, InvalidPolygonError, AreaOverlapError,
} from '@/lib/geo/areas-repo';

export const dynamic = 'force-dynamic';

const parseId = (raw: string) => (/^\d+$/.test(raw) ? parseInt(raw, 10) : null);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
  const parsed = parseAreaPatch(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = updateArea(getDb(), id, parsed.value);
    captureEvent(auth.session.sub, 'mapa_area_updated', { shape: Boolean(parsed.value.ring), sellers: parsed.value.sellerCodes?.length });
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof AreaNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof InvalidPolygonError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof AreaOverlapError) return NextResponse.json({ error: err.message, conflictAreaId: err.conflict.id }, { status: 409 });
    if (err instanceof DuplicateAreaError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('PATCH /api/mapa/zonas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
  try {
    deleteArea(getDb(), id);
    captureEvent(auth.session.sub, 'mapa_area_deleted', {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AreaNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('DELETE /api/mapa/zonas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
