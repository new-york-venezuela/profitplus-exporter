import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseAreaCreate } from '@/lib/geo/area-validation';
import { createArea, DuplicateAreaError, InvalidPolygonError, AreaOverlapError } from '@/lib/geo/areas-repo';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const parsed = parseAreaCreate(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = createArea(getDb(), parsed.value);
    captureEvent(auth.session.sub, 'mapa_area_created', { vertices: item.ring.length, sellers: item.sellerCodes.length });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidPolygonError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof AreaOverlapError) return NextResponse.json({ error: err.message, conflictAreaId: err.conflict.id }, { status: 409 });
    if (err instanceof DuplicateAreaError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('POST /api/mapa/zonas failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
