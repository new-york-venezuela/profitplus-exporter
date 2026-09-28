// app/api/pricing/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';
import { assignCustomerPriceList } from '@/lib/pricing/sa-cliente-fields';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

interface AssignmentBody {
  customerCodes: unknown;
  targetCoPrecio: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null) as AssignmentBody | null;
  if (!body || !Array.isArray(body.customerCodes) || body.customerCodes.length === 0) {
    return NextResponse.json({ error: 'Se requiere al menos un cliente' }, { status: 400 });
  }
  if (typeof body.targetCoPrecio !== 'string' || body.targetCoPrecio.trim() === '') {
    return NextResponse.json({ error: 'Lista de precio requerida' }, { status: 400 });
  }
  const customerCodes = body.customerCodes.filter((c): c is string => typeof c === 'string');
  if (customerCodes.length !== body.customerCodes.length) {
    return NextResponse.json({ error: 'Códigos de cliente inválidos' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    // Sequential, not Promise.all: keeps this feature's ERP write load
    // predictable and matches the spec's explicit "isolated, not batched"
    // requirement (Section 5) -- a burst of concurrent pActualizarCliente
    // calls against the same connection pool has no documented safety
    // margin in this ERP, and bulk reassignments here are an infrequent,
    // human-triggered action, not a throughput-sensitive path.
    // The ERP write records this value as a real Profit Plus user code
    // (saCliente.co_us_mo, via pActualizarCliente's @sCo_us_mo). It must
    // NOT be this app's own numeric user id (auth.session.sub) -- an app
    // user id like "88" can collide with an unrelated real Profit Plus
    // user code "88" and misattribute the change in Profit Plus's own
    // audit trail. Configurable since a dedicated Profit Plus service-user
    // code hasn't been set up yet; defaults to 'PROFIT', matching the
    // hardcoded @sCo_Us_In value pInsertarTipoCliente already uses nearby.
    // Note: the app user's own identity (auth.session.sub) isn't separately
    // recorded on the ERP side by this change -- there's no free-text,
    // audit-friendly parameter available on pActualizarCliente for it
    // (sMaquina is for client-machine identity and this is a server-side
    // write; sCampos is a fixed "which columns changed" list, not a notes
    // field). It remains available via this app's own PostHog event below
    // (captureEvent's distinctId) and server logs.
    const erpServiceUser = process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT';

    const results = [];
    for (const coCli of customerCodes) {
      const result = await assignCustomerPriceList(pool, coCli, body.targetCoPrecio, erpServiceUser);
      results.push(result);
    }

    captureEvent(auth.session.sub, 'pricing_assignment_applied', {
      targetCoPrecio: body.targetCoPrecio,
      customerCount: customerCodes.length,
      successCount: results.filter(r => r.outcome === 'success').length,
      conflictCount: results.filter(r => r.outcome === 'conflict').length,
      errorCount: results.filter(r => r.outcome === 'error').length,
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Pricing assignment route error:', error);
    captureException(error, auth.session.sub, { customerCount: customerCodes.length });
    return NextResponse.json({ error: 'Error al aplicar las asignaciones' }, { status: 500 });
  }
}
