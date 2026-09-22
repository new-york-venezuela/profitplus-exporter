import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { classifyTier, DEFAULT_TIER_THRESHOLDS, type TierThresholds } from './tier';
import { computeGapVsBaseline } from './seller-coverage';
import type {
  DepthMatrixRow, DepthMatrixResponse, DepthGapEntity, DepthGapResponse, CustomerSegment, GroupBy,
  SellerCoverageRow, SellerCoverageResponse,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/) — no COLLATE/RTRIM gymnastics needed, that already
// happened at load time. See docs/superpowers/specs/
// 2026-09-21-profundidad-linea-tab-design.md for the full design.
//
// Segment penetration is counted at the Dim_LegalEntity grain (a multi-
// tienda chain counts once), matching the convention already established by
// app/api/dwh/productos/route.ts's profundidadLineaQuery. Only
// SegmentCode IN ('CADENA','INDEPENDIENTES') rows are counted — verified
// live that every active customer has one of these two values, but the
// query defensively excludes NULL/other rather than crashing or inventing a
// third bucket.

type DepthGroupBy = 'linea' | 'sublinea' | 'sku';

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';
const SEGMENTS: CustomerSegment[] = ['CADENA', 'INDEPENDIENTES'];

function isDepthGroupBy(value: string | null): value is DepthGroupBy {
  return value === 'linea' || value === 'sublinea' || value === 'sku';
}

function labelExprFor(groupBy: DepthGroupBy): string {
  if (groupBy === 'sublinea') return `ISNULL(p.SubLineName, '${NO_SUBLINEA}')`;
  if (groupBy === 'sku') return 'ISNULL(p.ProductName, p.ProductCode)';
  return `ISNULL(p.LineName, '${NO_LINEA}')`;
}

// Per-row-label × segment sales/entity aggregate, scoped to a specific
// línea (and sublínea, for the sku level) when drilling deeper.
function matrixQuery(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
  const labelExpr = labelExprFor(groupBy);
  return `
    SELECT
      ${labelExpr} AS GroupLabel,
      c.SegmentCode AS SegmentCode,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
      SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY ${labelExpr}, c.SegmentCode
  `;
}

// Total active (any-sale) entities per segment, for the penetration
// denominator — same shape as productos/route.ts's activeTotalsQuery, just
// split by segment instead of pooled.
function activeTotalsBySegmentQuery(dateWhere: string, scopeWhere: string): string {
  return `
    SELECT c.SegmentCode AS SegmentCode, COUNT(DISTINCT c.LegalEntityKey) AS TotalEntities
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY c.SegmentCode
  `;
}

// Same shape as matrixQuery, but scoped to one seller's own sales — used
// when salesRepKey is present. See docs/superpowers/specs/
// 2026-09-21-seller-depth-of-line-coverage-design.md.
function matrixQueryForSeller(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
  const labelExpr = labelExprFor(groupBy);
  return `
    SELECT
      ${labelExpr} AS GroupLabel,
      c.SegmentCode AS SegmentCode,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
      SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY ${labelExpr}, c.SegmentCode
  `;
}

// Denominator when scoped to a seller: entities THIS SELLER sold anything
// to (any product) in range, per segment — not the whole segment's active
// entities. This is what makes the scoped view answer "am I covering my
// own accounts well" rather than "am I covering the whole market."
function activeTotalsBySegmentForSellerQuery(dateWhere: string): string {
  return `
    SELECT c.SegmentCode AS SegmentCode, COUNT(DISTINCT c.LegalEntityKey) AS TotalEntities
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere}
    GROUP BY c.SegmentCode
  `;
}

function gapQuery(dateWhere: string, scopeWhere: string): string {
  return `
    SELECT le.LegalEntityKey, le.LegalEntityName, SUM(fs.NetAmount) AS TotalSalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 AND c.SegmentCode = @segment ${dateWhere}
    GROUP BY le.LegalEntityKey, le.LegalEntityName
    HAVING NOT EXISTS (
      SELECT 1 FROM fact.Fact_Sales fs2
      JOIN dim.Dim_Customer c2 ON c2.CustomerKey = fs2.CustomerKey
      JOIN dim.Dim_Product p2 ON p2.ProductKey = fs2.ProductKey
      WHERE fs2.IsVoided = 0 AND c2.LegalEntityKey = le.LegalEntityKey ${scopeWhere.replace(/\bfs\b/g, 'fs2').replace(/\bp\b/g, 'p2')} ${dateWhere.replace(/\bfs\b/g, 'fs2')}
    )
    ORDER BY TotalSalesNet DESC
  `;
}

async function handleGap(
  dateWhere: string,
  groupBy: DepthGroupBy,
  linea: string | null,
  sublinea: string | null,
  segment: CustomerSegment,
  productLabel: string,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const req = pool.request().input('segment', segment);

  let scopeWhere = '';
  if (groupBy === 'linea') {
    req.input('lineaScope', productLabel);
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @lineaScope`;
  } else if (groupBy === 'sublinea') {
    req.input('lineaScope', linea ?? '');
    req.input('sublineaScope', productLabel);
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @lineaScope AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublineaScope`;
  } else {
    req.input('skuScope', productLabel);
    scopeWhere = `AND ISNULL(p.ProductName, p.ProductCode) = @skuScope`;
  }

  const result = await req.query(gapQuery(dateWhere, scopeWhere));
  const entities: DepthGapEntity[] = result.recordset.map(r => ({
    legalEntityKey: Number(r.LegalEntityKey),
    legalEntityName: String(r.LegalEntityName),
    totalSalesNet: Number(r.TotalSalesNet),
  }));

  const response: DepthGapResponse = { entities, segment, productLabel };
  return jsonWithCache(response);
}

async function handleMatrix(
  dateWhere: string,
  groupBy: DepthGroupBy,
  linea: string | null,
  sublinea: string | null,
  currency: string,
  thresholds: TierThresholds,
  salesRepKey: number | null,
  salesRepName: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();

  let scopeWhere = '';
  const scopeReq = pool.request();
  if (salesRepKey !== null) scopeReq.input('salesRepKey', salesRepKey);
  if (groupBy === 'sublinea') {
    scopeReq.input('linea', linea ?? '');
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea`;
  } else if (groupBy === 'sku') {
    scopeReq.input('linea', linea ?? '');
    scopeReq.input('sublinea', sublinea ?? '');
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea`;
  }

  const totalsReq = pool.request();
  if (salesRepKey !== null) totalsReq.input('salesRepKey', salesRepKey);

  const [matrixResult, totalsResult] = await Promise.all([
    scopeReq.query(salesRepKey !== null ? matrixQueryForSeller(groupBy, dateWhere, scopeWhere) : matrixQuery(groupBy, dateWhere, scopeWhere)),
    totalsReq.query(salesRepKey !== null ? activeTotalsBySegmentForSellerQuery(dateWhere) : activeTotalsBySegmentQuery(dateWhere, '')),
  ]);

  const totalsBySegment = new Map<string, number>();
  for (const r of totalsResult.recordset) {
    totalsBySegment.set(String(r.SegmentCode), Number(r.TotalEntities));
  }

  const byLabel = new Map<string, DepthMatrixRow>();
  for (const r of matrixResult.recordset) {
    const label = String(r.GroupLabel);
    const segment = String(r.SegmentCode) as CustomerSegment;
    const entitiesBuying = Number(r.EntitiesBuying);
    const salesNet = Number(r.SalesNet);
    const entitiesActive = totalsBySegment.get(segment) ?? 0;

    let row = byLabel.get(label);
    if (!row) {
      row = { label, value: label, cells: [], totalPenetration: null, totalSalesNet: 0, tier: 'sin-ventas' };
      byLabel.set(label, row);
    }
    row.cells.push({
      segment,
      entitiesBuying,
      entitiesActive,
      penetration: entitiesActive > 0 ? entitiesBuying / entitiesActive : null,
      salesNet,
    });
    row.totalSalesNet += salesNet;
  }

  const totalEntitiesActive = SEGMENTS.reduce((sum, s) => sum + (totalsBySegment.get(s) ?? 0), 0);

  const rows: DepthMatrixRow[] = Array.from(byLabel.values()).map(row => {
    const totalEntitiesBuying = row.cells.reduce((sum, c) => sum + c.entitiesBuying, 0);
    const totalPenetration = totalEntitiesActive > 0 ? totalEntitiesBuying / totalEntitiesActive : null;
    return {
      ...row,
      totalPenetration,
      tier: classifyTier(totalPenetration, row.totalSalesNet > 0, thresholds),
    };
  }).sort((a, b) => b.totalSalesNet - a.totalSalesNet);

  const usdRate = currency === 'usd' ? await getUsdRate() : null;

  const breadcrumb: DepthMatrixResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];
  if (groupBy === 'sublinea' || groupBy === 'sku') breadcrumb.push({ label: linea as string, groupBy: 'sublinea' });
  if (groupBy === 'sku') breadcrumb.push({ label: sublinea as string, groupBy: 'sku' });

  const response: DepthMatrixResponse = { rows, groupBy: groupBy as GroupBy, breadcrumb, usdRate, scopedToSalesRepName: salesRepName };
  return jsonWithCache(response);
}

// Seller leaderboard: for each seller, how many of their own (entity,
// tiered product) pairs are actually covered, against the tiered product
// set computed from the UNSCOPED matrix (passed in as tieredLineNames —
// the caller runs the unscoped handleMatrix-equivalent computation first
// and extracts which línea labels classify as primera/segunda).
function sellerCoverageQuery(dateWhere: string, tieredLineNames: string[]): string {
  const linePlaceholders = tieredLineNames.map((_, i) => `@tieredLine${i}`).join(', ');
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKey,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS SalesRepName,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesServed,
      COUNT(DISTINCT CONCAT(c.LegalEntityKey, '|', ISNULL(p.LineName, '${NO_LINEA}'))) AS TieredLinesCovered
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineName, '${NO_LINEA}') IN (${linePlaceholders}) ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
  `;
}

async function handleLeaderboard(dateWhere: string, currency: string, thresholds: TierThresholds): Promise<NextResponse> {
  const pool = await getDwhPool();

  // Step 1: compute the unscoped, línea-level matrix to find the tiered line set.
  const unscopedResult = await pool.request().query(matrixQuery('linea', dateWhere, ''));
  const totalsResult = await pool.request().query(activeTotalsBySegmentQuery(dateWhere, ''));
  const totalsBySegment = new Map<string, number>();
  for (const r of totalsResult.recordset) totalsBySegment.set(String(r.SegmentCode), Number(r.TotalEntities));
  const totalEntitiesActive = SEGMENTS.reduce((sum, s) => sum + (totalsBySegment.get(s) ?? 0), 0);

  const byLinea = new Map<string, { entitiesBuying: number; salesNet: number }>();
  for (const r of unscopedResult.recordset) {
    const label = String(r.GroupLabel);
    const entry = byLinea.get(label) ?? { entitiesBuying: 0, salesNet: 0 };
    entry.entitiesBuying += Number(r.EntitiesBuying);
    entry.salesNet += Number(r.SalesNet);
    byLinea.set(label, entry);
  }

  const tieredLineNames: string[] = [];
  let baselinePenetrationSum = 0;
  let baselineCount = 0;
  for (const [label, entry] of byLinea) {
    const penetration = totalEntitiesActive > 0 ? entry.entitiesBuying / totalEntitiesActive : null;
    const tier = classifyTier(penetration, entry.salesNet > 0, thresholds);
    if (tier === 'primera' || tier === 'segunda') {
      tieredLineNames.push(label);
      if (penetration !== null) {
        baselinePenetrationSum += penetration;
        baselineCount += 1;
      }
    }
  }
  const baselinePenetration = baselineCount > 0 ? baselinePenetrationSum / baselineCount : null;

  if (tieredLineNames.length === 0) {
    const usdRate = currency === 'usd' ? await getUsdRate() : null;
    const response: SellerCoverageResponse = { rows: [], usdRate };
    return jsonWithCache(response);
  }

  // Step 2: for each seller, how many (entity, tiered-line-product) pairs did they cover.
  const req = pool.request();
  tieredLineNames.forEach((name, i) => req.input(`tieredLine${i}`, name));
  const sellerResult = await req.query(sellerCoverageQuery(dateWhere, tieredLineNames));

  const rows: SellerCoverageRow[] = sellerResult.recordset.map(r => {
    const entitiesServed = Number(r.EntitiesServed);
    const tieredLinesCovered = Number(r.TieredLinesCovered);
    const maxPossible = entitiesServed * tieredLineNames.length;
    const ownPenetration = maxPossible > 0 ? tieredLinesCovered / maxPossible : null;
    return {
      salesRepKey: String(r.SalesRepKey),
      salesRepName: String(r.SalesRepName),
      entitiesServed,
      ownPenetration,
      baselinePenetration,
      gapVsBaseline: computeGapVsBaseline(ownPenetration, baselinePenetration),
    };
  }).filter(row => row.entitiesServed > 0)
    .sort((a, b) => (a.gapVsBaseline ?? 0) - (b.gapVsBaseline ?? 0));

  const usdRate = currency === 'usd' ? await getUsdRate() : null;
  const response: SellerCoverageResponse = { rows, usdRate };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const groupByParam = searchParams.get('groupBy');
  const lineaParam = searchParams.get('linea');
  const sublineaParam = searchParams.get('sublinea');

  let groupBy: DepthGroupBy = isDepthGroupBy(groupByParam) ? groupByParam : 'linea';
  if (groupBy === 'sublinea' && !lineaParam) groupBy = 'linea';
  if (groupBy === 'sku' && (!lineaParam || !sublineaParam)) groupBy = 'linea';

  const firstLineMinPenetration = Number(searchParams.get('firstLineMinPenetration') ?? DEFAULT_TIER_THRESHOLDS.firstLineMinPenetration);
  const secondLineMinPenetration = Number(searchParams.get('secondLineMinPenetration') ?? DEFAULT_TIER_THRESHOLDS.secondLineMinPenetration);
  const thresholds: TierThresholds = {
    firstLineMinPenetration: Number.isFinite(firstLineMinPenetration) ? firstLineMinPenetration : DEFAULT_TIER_THRESHOLDS.firstLineMinPenetration,
    secondLineMinPenetration: Number.isFinite(secondLineMinPenetration) ? secondLineMinPenetration : DEFAULT_TIER_THRESHOLDS.secondLineMinPenetration,
  };

  const salesRepKeyParam = searchParams.get('salesRepKey');
  const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;
  const salesRepName = searchParams.get('salesRepName');

  const dateWhere = buildDateWhereClause(dateRange, 'fs');

  try {
    if (searchParams.get('section') === 'leaderboard') {
      return await handleLeaderboard(dateWhere, currency, thresholds);
    }

    if (searchParams.get('section') === 'gap') {
      const segmentParam = searchParams.get('segment');
      const productLabel = searchParams.get('productLabel');
      if (segmentParam !== 'CADENA' && segmentParam !== 'INDEPENDIENTES') {
        return NextResponse.json({ error: 'Segmento inválido' }, { status: 400 });
      }
      if (!productLabel) {
        return NextResponse.json({ error: 'Falta productLabel' }, { status: 400 });
      }
      return await handleGap(dateWhere, groupBy, lineaParam, sublineaParam, segmentParam, productLabel);
    }

    return await handleMatrix(dateWhere, groupBy, lineaParam, sublineaParam, currency, thresholds, salesRepKey, salesRepName);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
