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
    const results = [];
    for (const coCli of customerCodes) {
      const result = await assignCustomerPriceList(pool, coCli, body.targetCoPrecio, auth.session.sub);
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
