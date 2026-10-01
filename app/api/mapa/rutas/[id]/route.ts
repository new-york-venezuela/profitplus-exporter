import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseRoutePatch } from '@/lib/geo/route-validation';
import { updateRoute, deleteRoute, DuplicateRouteError, RouteNotFoundError } from '@/lib/geo/routes-repo';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
  const parsed = parseRoutePatch(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = updateRoute(getDb(), id, parsed.value);
    captureEvent(auth.session.sub, 'mapa_route_updated', { members: parsed.value.customerCodes?.length });
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof RouteNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof DuplicateRouteError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('PATCH /api/mapa/rutas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
  try {
    deleteRoute(getDb(), id);
    captureEvent(auth.session.sub, 'mapa_route_deleted', {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RouteNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('DELETE /api/mapa/rutas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
