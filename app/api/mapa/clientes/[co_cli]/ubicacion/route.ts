import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getPool } from '@/lib/db/mssql';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseLocationPatch } from '@/lib/geo/location-patch';
import { updateCustomerLocation, CustomerNotFoundError } from '@/lib/geo/erp-location';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ co_cli: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const { co_cli } = await params;
  const body = await request.json().catch(() => null);
  const parsed = parseLocationPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });

  try {
    await updateCustomerLocation(await getPool(), {
      coCli: decodeURIComponent(co_cli),
      campo1: parsed.value.campo1,
      dirEnt2: parsed.value.dirEnt2,
    });
    captureEvent(auth.session.sub, 'mapa_location_updated', {
      coordinates: Boolean(parsed.value.campo1), address: Boolean(parsed.value.dirEnt2),
    });
    return NextResponse.json({ ok: true, coordinates: parsed.value.coordinates, dirEnt2: parsed.value.dirEnt2 });
  } catch (err) {
    if (err instanceof CustomerNotFoundError) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    console.error('PATCH ubicacion failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al actualizar en Profit Plus' }, { status: 500 });
  }
}
