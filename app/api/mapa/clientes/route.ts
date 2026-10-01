import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getPool } from '@/lib/db/mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { fetchErpCustomers, fetchRevenue } from '@/lib/geo/map-data';
import { mergeCustomers, distinctSellers } from '@/lib/geo/merge';
import { listRoutes } from '@/lib/geo/routes-repo';
import { listAreas } from '@/lib/geo/areas-repo';
import { applyAreaMatch } from '@/lib/geo/area-match';
import { isValidDateRange, previousMonthRange } from '@/lib/geo/date-range';
import { PARETO_THRESHOLDS, type MapPayload } from '@/lib/geo/types';

export const dynamic = 'force-dynamic';

// The one place the app merges ERP (live) and DWH (pre-aggregated) data —
// in TypeScript, by customer code. See AGENTS.md ("Database" section).
export async function GET(request: NextRequest) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const param = new URL(request.url).searchParams.get('dateRange');
  if (param !== null && !isValidDateRange(param)) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }
  const dateRange = param ?? previousMonthRange();

  try {
    const [erpPool, dwhPool] = await Promise.all([getPool(), getDwhPool()]);
    const [erpCustomers, revenue] = await Promise.all([
      fetchErpCustomers(erpPool),
      fetchRevenue(dwhPool, dateRange),
    ]);
    const db = getDb();
    const routes = listRoutes(db);
    const areas = listAreas(db);
    const customers = applyAreaMatch(mergeCustomers(erpCustomers, revenue, routes), areas);

    const payload: MapPayload = {
      dateRange, customers, sellers: distinctSellers(customers), routes, areas, paretoThresholds: PARETO_THRESHOLDS,
    };
    captureEvent(auth.session.sub, 'mapa_viewed', { dateRange, customers: customers.length });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('GET /api/mapa/clientes failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar los datos del mapa' }, { status: 500 });
  }
}
