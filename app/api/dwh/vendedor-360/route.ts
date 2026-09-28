import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { sellerTargets } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  buildDateWhereClause, jsonWithCache, usdConversionJoin, dualAmountExpr, getUsdRate,
} from '@/app/api/dwh/lib/query-builder';
import { resolveQuotaSum } from './quota-resolution';
import type { ActivacionWeekRow, AgingBucketRow, Seller360Response } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// migrations/dwh/) for every DWH-sourced section, and the app's own SQLite
// for seller_targets. See docs/superpowers/specs/
// 2026-09-27-seller-360-dashboard-design.md.
//
// This route reuses existing query SHAPES from vendedores/cxc/clientes/
// profundidad-linea routes (scoped to one seller here) rather than importing
// those routes' private functions directly — none of them export a reusable
// function today, and duplicating the ~10-line query shape is simpler and
// safer than refactoring four already-shipped, tested routes mid-feature.

type EntityGrain = 'entity' | 'tienda';

function activacionQuery(entityGrain: EntityGrain, dateWhere: string): string {
  const countExpr = entityGrain === 'tienda' ? 'COUNT(DISTINCT fs.CustomerKey)' : 'COUNT(DISTINCT c.LegalEntityKey)';
  return `
    SELECT d.WeekStartDate AS WeekStart, ${countExpr} AS DistinctReached
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${dateWhere}
    GROUP BY d.WeekStartDate
    ORDER BY d.WeekStartDate
  `;
}

const CUOTA_SALES_QUERY = `
  SELECT ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
  FROM fact.Fact_Sales fs
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${'{{dateWhere}}'}
`;

// Seller-scoped AR: entities with >=1 sale from this seller in the selected
// period, joined against the latest Fact_AR_Snapshot. An entity split across
// multiple sellers appears under every seller who sold to it — this is a
// membership filter (IN), not an exclusive attribution, matching the
// Depth-of-Line "no dedup" convention. See spec Section 10.
function sellerCobranzaQuery(dateWhere: string): string {
  return `
    SELECT a.AgingBucket,
      SUM(a.OutstandingBalance) AS AmountBs,
      SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS AmountUsd
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = a.CustomerKey
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
      AND c.LegalEntityKey IN (
        SELECT DISTINCT c2.LegalEntityKey
        FROM fact.Fact_Sales fs2
        JOIN dim.Dim_Customer c2 ON c2.CustomerKey = fs2.CustomerKey
        WHERE fs2.IsVoided = 0 AND fs2.SalesRepKey = @salesRepKey ${dateWhere.replace(/\bfs\b/g, 'fs2')}
      )
    GROUP BY a.AgingBucket
  `;
}

const BASELINE_AGING_QUERY = `
  SELECT AgingBucket,
    SUM(a.OutstandingBalance) AS AmountBs,
    SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS AmountUsd
  FROM fact.Fact_AR_Snapshot a
  ${usdConversionJoin('a', 'SnapshotDateKey')}
  WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
  GROUP BY AgingBucket
`;

const LATEST_SNAPSHOT_QUERY = `SELECT MAX(SnapshotDateKey) AS SnapshotDateKey FROM fact.Fact_AR_Snapshot`;

// Every month (YYYY-MM) whose interval overlaps [startDate, endDate], for
// resolving a multi-month quota sum (Section 7's "meta parcial" case).
function monthsInRange(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00Z`);
  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

// dateRange is app-shell-encoded ('12m' | month:YYYY-MM | ytd:YYYY |
// custom:start:end) — this route needs concrete start/end ISO dates (not
// just a SQL WHERE fragment) for the quota-month resolution, so it parses
// the same formats buildDateWhereClause does, independently, since that
// function only returns a SQL string, not parsed bounds.
function resolveDateBounds(dateRange: string): { start: string; end: string } {
  const customMatch = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(dateRange);
  if (customMatch) return { start: customMatch[1], end: customMatch[2] };

  const monthMatch = /^month:(\d{4})-(\d{2})$/.exec(dateRange);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10);
    return { start: `${year}-${month}-01`, end: lastDay };
  }

  const ytdMatch = /^ytd:(\d{4})$/.exec(dateRange);
  if (ytdMatch) {
    const year = ytdMatch[1];
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getUTCFullYear();
    return { start: `${year}-01-01`, end: year === String(currentYear) ? today : `${year}-12-31` };
  }

  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const salesRepKeyParam = searchParams.get('salesRepKey');
  if (!salesRepKeyParam || !/^\d+$/.test(salesRepKeyParam)) {
    return NextResponse.json({ error: 'Falta salesRepKey' }, { status: 400 });
  }
  const salesRepKey = Number(salesRepKeyParam);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const entityGrainParam = searchParams.get('entityGrain');
  const entityGrain: EntityGrain = entityGrainParam === 'tienda' ? 'tienda' : 'entity';

  const dateWhere = buildDateWhereClause(dateRange, 'fs');
  const { start, end } = resolveDateBounds(dateRange);
  const months = monthsInRange(start, end);

  try {
    const pool = await getDwhPool();
    const db = getDb();

    const targetRows = db
      .select()
      .from(sellerTargets)
      .where(and(eq(sellerTargets.salesRepKey, salesRepKeyParam), inArray(sellerTargets.periodMonth, months)))
      .all();

    // Section 1: Activación
    const activacionResult = await pool.request().input('salesRepKey', salesRepKey).query(activacionQuery(entityGrain, dateWhere));
    const weeks: ActivacionWeekRow[] = activacionResult.recordset.map(r => ({
      weekStart: new Date(r.WeekStart).toISOString().slice(0, 10),
      distinctReached: Number(r.DistinctReached),
    }));
    // Activación's quota is a single per-week number (not summed across
    // months like Cuota's monthly amount) — take the most recent month's
    // row in range, matching how a weekly cadence quota doesn't accumulate
    // month over month the way a sales target does.
    const latestMonthRow = targetRows.find(t => t.periodMonth === months[months.length - 1]);

    // Section 2: Cuota de ventas mensual
    const cuotaResult = await pool.request().input('salesRepKey', salesRepKey)
      .query(CUOTA_SALES_QUERY.replace('{{dateWhere}}', dateWhere));
    const salesNetBs = Number(cuotaResult.recordset[0]?.SalesNetBs ?? 0);
    const salesNetUsdRaw = cuotaResult.recordset[0]?.SalesNetUsd;
    const salesNetUsd = salesNetUsdRaw === null || salesNetUsdRaw === undefined ? null : Number(salesNetUsdRaw);
    const quotaResult = resolveQuotaSum(
      targetRows.map(t => ({ periodMonth: t.periodMonth, quotaValue: t.salesQuotaUsd })),
      months,
    );

    // Section 3: Cobranza
    const snapshot = await pool.request().query(LATEST_SNAPSHOT_QUERY);
    const snapshotDateKey: number | null = snapshot.recordset[0]?.SnapshotDateKey ?? null;
    let sellerBuckets: AgingBucketRow[] = [];
    let baselineBuckets: AgingBucketRow[] = [];
    if (snapshotDateKey !== null) {
      const [sellerAging, baselineAging] = await Promise.all([
        pool.request().input('salesRepKey', salesRepKey).input('snapshotDateKey', snapshotDateKey).query(sellerCobranzaQuery(dateWhere)),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(BASELINE_AGING_QUERY),
      ]);
      sellerBuckets = sellerAging.recordset.map(r => ({
        bucket: r.AgingBucket,
        amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
      }));
      baselineBuckets = baselineAging.recordset.map(r => ({
        bucket: r.AgingBucket,
        amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
      }));
    }

    const usdRate = await getUsdRate();

    // Sections 4-7 are added in Task 7; placeholder empty shapes here so this
    // task's route is independently valid/testable before Task 7 lands.
    const response: Seller360Response = {
      salesRepKey: salesRepKeyParam,
      salesRepName: '', // filled in Task 7 alongside the seller-name lookup
      activacion: { weeks, entityGrain, weeklyVisitQuota: latestMonthRow?.weeklyVisitQuota ?? null },
      cuota: { salesNet: { bs: salesNetBs, usd: salesNetUsd }, quotaUsd: quotaResult.total, isPartial: quotaResult.isPartial },
      cobranza: { buckets: sellerBuckets, baselineBuckets },
      nuevosClientes: { rows: [], quota: null, isPartial: false },
      clientesRecuperados: { rows: [] },
      devoluciones: { byProduct: [], byTienda: [] },
      profundidad: { coverage: null },
      usdRate,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
