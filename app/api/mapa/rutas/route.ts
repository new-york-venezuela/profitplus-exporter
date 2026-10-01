import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseRouteCreate } from '@/lib/geo/route-validation';
import { createRoute, DuplicateRouteError } from '@/lib/geo/routes-repo';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const parsed = parseRouteCreate(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = createRoute(getDb(), parsed.value);
    captureEvent(auth.session.sub, 'mapa_route_created', {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateRouteError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('POST /api/mapa/rutas failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
