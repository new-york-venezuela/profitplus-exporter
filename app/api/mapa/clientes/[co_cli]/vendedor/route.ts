import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getPool } from '@/lib/db/mssql';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { normalizeCoCli } from '@/lib/geo/location-patch';
import { CustomerNotFoundError } from '@/lib/geo/erp-location';
import { updateCustomerSeller, SellerNotFoundError, normalizeCoVen } from '@/lib/geo/erp-seller';

export const dynamic = 'force-dynamic';

// The only route that writes saCliente.co_ven. Manual, user-initiated.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ co_cli: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const { co_cli } = await params;
  const coCli = normalizeCoCli(co_cli);
  if (!coCli) return NextResponse.json({ error: 'Código de cliente inválido' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const coVen = normalizeCoVen(typeof body === 'object' && body !== null ? (body as Record<string, unknown>).coVen : undefined);
  if (!coVen) return NextResponse.json({ error: 'Seleccione un vendedor válido', field: 'coVen' }, { status: 400 });

  try {
    await updateCustomerSeller(await getPool(), coCli, coVen);
    captureEvent(auth.session.sub, 'mapa_seller_changed', { coCli, coVen });
    return NextResponse.json({ ok: true, coVen });
  } catch (err) {
    if (err instanceof CustomerNotFoundError) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (err instanceof SellerNotFoundError) return NextResponse.json({ error: 'Vendedor no encontrado o inactivo', field: 'coVen' }, { status: 404 });
    console.error('PATCH vendedor failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al actualizar en Profit Plus' }, { status: 500 });
  }
}
