import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { DEFAULT_ROOT_SHARE_THRESHOLD, getFlaggedRootCodes } from '@/app/api/dwh/lib/consignment';
import { buildSeguimiento, rootOf } from '@/lib/seguimiento/aggregate';
import { isoWeeksOfMonth } from '@/lib/seguimiento/iso-weeks';
import { resolveReferenceMonth } from '@/lib/seguimiento/month-pace';
import {
  fetchCustomerInvoiceLines, fetchCustomers, fetchExcludedInvoices, fetchLineSales, fetchWeekActivity,
} from '@/lib/seguimiento/queries';
import { readTargetsForMonth } from '@/lib/seguimiento/targets-repo';
import {
  parseRootKind,
  type SeguimientoExcludedResponse, type SeguimientoLinesResponse, type SeguimientoResponse,
} from '@/lib/seguimiento/types';

export const dynamic = 'force-dynamic';

// Reads the pre-aggregated dim/fact schema of DWH_AlimentosNY plus the app's own SQLite
// seller_targets. Replaces the Vendedores tab and the Vendedor 360 table (spec section B).
// Consignment-pattern exclusion is the same rule as app/api/dwh/vendedores/route.ts.
const CUSTOMER_CODE_RE = /^[A-Za-z0-9._\- ]{1,16}$/;
// Every value the analitica shell emits ('12m' | '30d' | month: | ytd: | custom:), plus the legacy
// '90d' of old bookmarks. The value only feeds resolveReferenceMonth (never SQL), but a malformed
// one is rejected rather than silently mapped to the current month.
const DATE_RANGE_RE = /^(12m|30d|90d|month:\d{4}-\d{2}|ytd:\d{4}|custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;
const SECTIONS = new Set(['lines', 'excluded']);

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const kind = parseRootKind(searchParams.get('kind'));
  const section = searchParams.get('section');
  if (section !== null && !SECTIONS.has(section)) {
    return NextResponse.json({ error: 'section inválida' }, { status: 400 });
  }
  const dateRange = searchParams.get('dateRange') ?? '30d';
  if (!DATE_RANGE_RE.test(dateRange)) {
    return NextResponse.json({ error: 'dateRange inválido' }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const ref = resolveReferenceMonth(dateRange, today);

  const customerCode = (searchParams.get('customerCode') ?? '').trim();
  if (section === 'lines' && !CUSTOMER_CODE_RE.test(customerCode)) {
    return NextResponse.json({ error: 'customerCode inválido' }, { status: 400 });
  }
  const rootValue = searchParams.get('rootValue');
  if (section === 'excluded' && !rootValue) {
    return NextResponse.json({ error: 'Falta rootValue' }, { status: 400 });
  }

  try {
    const pool = await getDwhPool();

    if (section === 'lines') {
      const lines = await fetchCustomerInvoiceLines(pool, customerCode, ref.month);
      const body: SeguimientoLinesResponse = { lines };
      return jsonWithCache(body);
    }

    const flaggedCodes = await getFlaggedRootCodes(buildDateWhereClause(`month:${ref.month}`, 'fs'), DEFAULT_ROOT_SHARE_THRESHOLD);

    if (section === 'excluded') {
      const flaggedSet = new Set(flaggedCodes.map(c => c.trim()));
      const customers = await fetchCustomers(pool, ref.asOf);
      const codes = customers
        .filter(c => flaggedSet.has(c.customerCode) && rootOf(kind, c).value === rootValue)
        .map(c => c.customerCode);
      const body: SeguimientoExcludedResponse = { invoices: await fetchExcludedInvoices(pool, ref.month, codes) };
      return jsonWithCache(body);
    }

    const weeks = isoWeeksOfMonth(ref.month);
    const [customers, lineSales, weekActivity] = await Promise.all([
      fetchCustomers(pool, ref.asOf),
      fetchLineSales(pool, ref.month),
      // Activation counts the whole ISO week, including days before the 1st / after the last day.
      fetchWeekActivity(pool, weeks[0].weekStart, weeks[weeks.length - 1].weekEnd),
    ]);
    const targets = readTargetsForMonth(getDb(), ref.month);

    const response: SeguimientoResponse = {
      kind, month: ref.month, monthStart: ref.monthStart, monthEnd: ref.monthEnd, asOf: ref.asOf,
      ...buildSeguimiento({ kind, month: ref.month, asOf: ref.asOf, customers, lineSales, weekActivity, consignmentRootCodes: flaggedCodes, targets }),
    };
    captureEvent(auth.session.sub, 'seguimiento_viewed', { kind, month: ref.month, roots: response.roots.length });
    return jsonWithCache(response);
  } catch (err) {
    console.error('GET /api/dwh/seguimiento failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
