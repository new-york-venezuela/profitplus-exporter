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
import { classifyCustomers, type EntitySaleHistory } from './customer-classification';
import { GET as getProfundidadLinea } from '@/app/api/dwh/profundidad-linea/route';
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

// Section 4/5 support: for every entity with >=1 sale from this seller in
// the CURRENT period, find its true first-sale-ever date (unbounded
// lookback) and which seller made that first sale. Whether the entity had a
// prior-period sale, and the gap/recovery detail when it didn't, are
// resolved separately below (the inline prior-flag query in Step 3's GET
// handler update, and recoveryGapQuery).
function entityHistoryQuery(currentDateWhere: string): string {
  return `
    ;WITH SellerEntities AS (
      SELECT DISTINCT c.LegalEntityKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${currentDateWhere}
    ),
    FirstSaleEver AS (
      SELECT c.LegalEntityKey, MIN(d.FullDate) AS FirstSaleDateEver
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey IN (SELECT LegalEntityKey FROM SellerEntities)
      GROUP BY c.LegalEntityKey
    )
    SELECT
      fse.LegalEntityKey,
      le.LegalEntityName,
      fse.FirstSaleDateEver,
      (SELECT TOP 1 fs2.SalesRepKey
       FROM fact.Fact_Sales fs2
       JOIN dim.Dim_Customer c2 ON c2.CustomerKey = fs2.CustomerKey
       JOIN dim.Dim_Date d2 ON d2.DateKey = fs2.DateKey
       WHERE fs2.IsVoided = 0 AND c2.LegalEntityKey = fse.LegalEntityKey AND d2.FullDate = fse.FirstSaleDateEver
       ORDER BY fs2.DateKey) AS FirstSaleSalesRepKey,
      (SELECT TOP 1 fs3.NetAmount
       FROM fact.Fact_Sales fs3
       JOIN dim.Dim_Customer c3 ON c3.CustomerKey = fs3.CustomerKey
       JOIN dim.Dim_Date d3 ON d3.DateKey = fs3.DateKey
       WHERE fs3.IsVoided = 0 AND c3.LegalEntityKey = fse.LegalEntityKey AND d3.FullDate = fse.FirstSaleDateEver
       ORDER BY fs3.DateKey) AS FirstSaleAmountBs,
      (SELECT TOP 1 fs3.NetAmount / NULLIF(COALESCE(fs3.DocumentExchangeRate, fx3.RateSell), 0)
       FROM fact.Fact_Sales fs3
       ${usdConversionJoin('fs3', 'DateKey', 'fx3')}
       JOIN dim.Dim_Customer c3 ON c3.CustomerKey = fs3.CustomerKey
       JOIN dim.Dim_Date d3 ON d3.DateKey = fs3.DateKey
       WHERE fs3.IsVoided = 0 AND c3.LegalEntityKey = fse.LegalEntityKey AND d3.FullDate = fse.FirstSaleDateEver
       ORDER BY fs3.DateKey) AS FirstSaleAmountUsd
    FROM FirstSaleEver fse
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = fse.LegalEntityKey
  `;
}

// Run only for entities flagged
// !HadPrior by the main query — for those entities, find their last sale
// strictly before the FIRST current-period sale from this seller (the gap
// start), and that first current-period sale itself (the recovery sale).
function recoveryGapQuery(legalEntityKeys: number[], currentDateWhere: string): string {
  const placeholders = legalEntityKeys.map((_, i) => `@entity${i}`).join(', ');
  return `
    SELECT
      c.LegalEntityKey,
      MIN(d.FullDate) AS RecoverySaleDate,
      ${dualAmountExpr('fs', 'NetAmount', 'RecoveryAmountBs', 'RecoveryAmountUsd')},
      (SELECT MAX(d2.FullDate) FROM fact.Fact_Sales f2
        JOIN dim.Dim_Customer c2 ON c2.CustomerKey = f2.CustomerKey
        JOIN dim.Dim_Date d2 ON d2.DateKey = f2.DateKey
        WHERE f2.IsVoided = 0 AND c2.LegalEntityKey = c.LegalEntityKey
          AND d2.FullDate < (SELECT MIN(d3.FullDate) FROM fact.Fact_Sales f3
            JOIN dim.Dim_Customer c3 ON c3.CustomerKey = f3.CustomerKey
            JOIN dim.Dim_Date d3 ON d3.DateKey = f3.DateKey
            WHERE f3.IsVoided = 0 AND c3.LegalEntityKey = c.LegalEntityKey AND f3.SalesRepKey = @salesRepKey ${currentDateWhere.replace(/\bfs\b/g, 'f3')})
      ) AS LastSaleBeforeGap
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey AND c.LegalEntityKey IN (${placeholders}) ${currentDateWhere}
    GROUP BY c.LegalEntityKey
  `;
}

// Devoluciones: this seller's returns, grouped by product and by tienda,
// top 10 each by amount — same TOP-10 convention as cxc's topDebtorsQuery.
function returnsByProductQuery(dateWhere: string): string {
  return `
    SELECT TOP 10 ISNULL(p.ProductName, p.ProductCode) AS Label,
      SUM(fr.QuantityReturned) AS Quantity,
      ${dualAmountExpr('fr', 'NetAmount', 'AmountBs', 'AmountUsd')}
    FROM fact.Fact_Returns fr
    ${usdConversionJoin('fr')}
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    WHERE fr.IsVoided = 0 AND fr.SalesRepKey = @salesRepKey ${dateWhere.replace(/\bfs\b/g, 'fr')}
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY AmountBs DESC
  `;
}

function returnsByTiendaQuery(dateWhere: string): string {
  return `
    SELECT TOP 10 ISNULL(c.CustomerName, c.CustomerCode) AS Label,
      SUM(fr.QuantityReturned) AS Quantity,
      ${dualAmountExpr('fr', 'NetAmount', 'AmountBs', 'AmountUsd')}
    FROM fact.Fact_Returns fr
    ${usdConversionJoin('fr')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
    WHERE fr.IsVoided = 0 AND fr.SalesRepKey = @salesRepKey ${dateWhere.replace(/\bfs\b/g, 'fr')}
    GROUP BY ISNULL(c.CustomerName, c.CustomerCode)
    ORDER BY AmountBs DESC
  `;
}

const SELLER_NAME_QUERY = `
  SELECT ISNULL(SalesRepName, SalesRepCode) AS SalesRepName FROM dim.Dim_SalesRep WHERE SalesRepKey = @salesRepKey
`;

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

    // Prior-period date window — same trailing/calendar-boundary arithmetic
    // buildDateWhereClause's own fallback uses, re-derived here (not
    // imported) since clientes/route.ts's buildPrevPeriodDateWhereClause is
    // unexported. Re-uses this route's own dateRange parsing (resolveDateBounds)
    // rather than duplicating buildDateWhereClause's regex matching a second
    // time.
    const periodDays = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
    const priorEnd = new Date(new Date(start).getTime() - 86_400_000).toISOString().slice(0, 10);
    const priorStart = new Date(new Date(start).getTime() - periodDays * 86_400_000).toISOString().slice(0, 10);
    const priorDateWhere = `AND fs.DateKey >= ${priorStart.replace(/-/g, '')} AND fs.DateKey <= ${priorEnd.replace(/-/g, '')}`;

    // Section 4/5: Nuevos clientes + Clientes recuperados
    const historyResult = await pool.request().input('salesRepKey', salesRepKey).query(entityHistoryQuery(dateWhere));
    const priorFlags = await Promise.all(
      historyResult.recordset.map(async r => {
        const req = pool.request().input('salesRepKey', salesRepKey);
        const res = await req.query(`
          SELECT CASE WHEN EXISTS (
            SELECT 1 FROM fact.Fact_Sales fp
            JOIN dim.Dim_Customer cp ON cp.CustomerKey = fp.CustomerKey
            WHERE fp.IsVoided = 0 AND cp.LegalEntityKey = ${Number(r.LegalEntityKey)} ${priorDateWhere.replace(/\bfs\b/g, 'fp')}
          ) THEN 1 ELSE 0 END AS HadPrior
        `);
        return { legalEntityKey: Number(r.LegalEntityKey), hadPrior: Number(res.recordset[0].HadPrior) === 1 };
      }),
    );
    const priorFlagMap = new Map(priorFlags.map(p => [p.legalEntityKey, p.hadPrior]));

    const noPriorEntityKeys = historyResult.recordset
      .map(r => Number(r.LegalEntityKey))
      .filter(key => priorFlagMap.get(key) === false);

    const recoveryByEntity = new Map<number, { lastSaleBeforeGap: string | null; recoverySaleDate: string; recoveryAmountBs: number; recoveryAmountUsd: number | null }>();
    if (noPriorEntityKeys.length > 0) {
      const req = pool.request().input('salesRepKey', salesRepKey);
      noPriorEntityKeys.forEach((key, i) => req.input(`entity${i}`, key));
      const recoveryResult = await req.query(recoveryGapQuery(noPriorEntityKeys, dateWhere));
      for (const r of recoveryResult.recordset) {
        recoveryByEntity.set(Number(r.LegalEntityKey), {
          lastSaleBeforeGap: r.LastSaleBeforeGap ? new Date(r.LastSaleBeforeGap).toISOString().slice(0, 10) : null,
          recoverySaleDate: new Date(r.RecoverySaleDate).toISOString().slice(0, 10),
          recoveryAmountBs: Number(r.RecoveryAmountBs),
          recoveryAmountUsd: r.RecoveryAmountUsd === null ? null : Number(r.RecoveryAmountUsd),
        });
      }
    }

    const entityHistories: EntitySaleHistory[] = historyResult.recordset.map(r => {
      const legalEntityKey = Number(r.LegalEntityKey);
      const recovery = recoveryByEntity.get(legalEntityKey);
      const hadPrior = priorFlagMap.get(legalEntityKey) ?? true;
      return {
        legalEntityKey,
        legalEntityName: String(r.LegalEntityName),
        firstSaleDateEver: new Date(r.FirstSaleDateEver).toISOString().slice(0, 10),
        firstSaleSellerMatches: Number(r.FirstSaleSalesRepKey) === salesRepKey,
        firstSaleAmount: { bs: Number(r.FirstSaleAmountBs ?? 0), usd: r.FirstSaleAmountUsd === null ? null : Number(r.FirstSaleAmountUsd) },
        hadSaleInPriorPeriod: hadPrior,
        hadSaleInCurrentPeriod: true, // every row in historyResult sold to this seller in-period, by construction
        recoverySale: !hadPrior && recovery && recovery.lastSaleBeforeGap
          ? {
              lastSaleBeforeGap: recovery.lastSaleBeforeGap,
              gapDays: Math.round((new Date(recovery.recoverySaleDate).getTime() - new Date(recovery.lastSaleBeforeGap).getTime()) / 86_400_000),
              recoverySaleDate: recovery.recoverySaleDate,
              recoverySaleAmount: { bs: recovery.recoveryAmountBs, usd: recovery.recoveryAmountUsd },
            }
          : null,
      };
    });

    const { nuevos, recuperados } = classifyCustomers(entityHistories, start, end);
    const newCustomerQuotaResult = resolveQuotaSum(
      targetRows.map(t => ({ periodMonth: t.periodMonth, quotaValue: t.newCustomerQuota })),
      months,
    );

    // Section 6: Devoluciones
    const [byProductResult, byTiendaResult] = await Promise.all([
      pool.request().input('salesRepKey', salesRepKey).query(returnsByProductQuery(dateWhere)),
      pool.request().input('salesRepKey', salesRepKey).query(returnsByTiendaQuery(dateWhere)),
    ]);
    const byProduct = byProductResult.recordset.map(r => ({
      label: String(r.Label),
      quantity: Number(r.Quantity),
      amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
    }));
    const byTienda = byTiendaResult.recordset.map(r => ({
      label: String(r.Label),
      quantity: Number(r.Quantity),
      amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
    }));

    // Section 7: Profundidad — this seller's own SellerCoverageRow, derived
    // the same way profundidad-linea/route.ts's handleLeaderboard computes
    // its full leaderboard, but this route only needs one seller's row, so
    // it queries dim.Dim_SalesRep + a scoped rebuild rather than fetching
    // every seller. Kept intentionally simple: reruns the unscoped matrix's
    // tiered-line-set computation (cheap, already the pattern
    // handleLeaderboard itself uses) and then this one seller's coverage.
    const sellerNameResult = await pool.request().input('salesRepKey', salesRepKey).query(SELLER_NAME_QUERY);
    const salesRepName = sellerNameResult.recordset[0]?.SalesRepName ? String(sellerNameResult.recordset[0].SalesRepName) : `Vendedor ${salesRepKey}`;

    // profundidad-linea/route.ts's handleLeaderboard is not exported and
    // returns a NextResponse, not raw data — rather than refactor that
    // shipped route (out of scope per the spec), this route calls it the
    // same way any other consumer would: an internal fetch to its own
    // deployment is unnecessary complexity for a same-process call. Instead,
    // import and invoke its exported GET handler directly (Next.js Route
    // Handlers are plain async functions — calling one from another route in
    // the same process is supported and already how this route imports work).
    let coverage: Seller360Response['profundidad']['coverage'] = null;
    try {
      const leaderboardReq = new NextRequest(
        `http://localhost/api/dwh/profundidad-linea?section=leaderboard&dateRange=${encodeURIComponent(dateRange)}`,
        { headers: request.headers },
      );
      const leaderboardRes = await getProfundidadLinea(leaderboardReq);
      if (leaderboardRes.ok) {
        const leaderboardBody = await leaderboardRes.json() as { rows: Array<Seller360Response['profundidad']['coverage']> };
        coverage = leaderboardBody.rows.find(r => r?.salesRepKey === salesRepKeyParam) ?? null;
      }
    } catch {
      // Profundidad coverage is supplementary context on this profile, not a
      // hard dependency — if the leaderboard call fails for any reason, the
      // rest of the profile still renders with coverage: null (UI shows its
      // existing empty state for this one section), rather than failing the
      // whole vendedor-360 response.
      coverage = null;
    }

    const response: Seller360Response = {
      salesRepKey: salesRepKeyParam,
      salesRepName,
      activacion: { weeks, entityGrain, weeklyVisitQuota: latestMonthRow?.weeklyVisitQuota ?? null },
      cuota: { salesNet: { bs: salesNetBs, usd: salesNetUsd }, quotaUsd: quotaResult.total, isPartial: quotaResult.isPartial },
      cobranza: { buckets: sellerBuckets, baselineBuckets },
      nuevosClientes: { rows: nuevos, quota: newCustomerQuotaResult.total, isPartial: newCustomerQuotaResult.isPartial },
      clientesRecuperados: { rows: recuperados },
      devoluciones: { byProduct, byTienda },
      profundidad: { coverage },
      usdRate,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
