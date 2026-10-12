import sql from 'mssql';
import type { SellerCoverageRow } from '@/app/(app)/analitica/types';
import { classifyTier, DEFAULT_TIER_THRESHOLDS, type TierThresholds } from './depth-tier';

// Seller line-depth coverage, used by Vendedor 360 (app/api/dwh/vendedor-360/route.ts). Moved out of
// app/api/dwh/profundidad-linea/route.ts (handleLeaderboard) when that tab was removed. Penetration is pooled
// over ALL active legal entities: the old CADENA/INDEPENDIENTES split (Dim_Customer.SegmentCode) is gone
// because customer groups replace those values.
const NO_LINEA = 'Sin línea';

export function computeGapVsBaseline(own: number | null, baseline: number | null): number | null {
  if (own === null || baseline === null) return null;
  return own - baseline;
}

export interface LineStat { line: string; entitiesBuying: number; salesGrossBs: number }

export function pickTieredLines(
  stats: readonly LineStat[],
  totalEntitiesActive: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): { tieredLineNames: string[]; baselinePenetration: number | null } {
  const tieredLineNames: string[] = [];
  let sum = 0;
  let n = 0;
  for (const s of stats) {
    const penetration = totalEntitiesActive > 0 ? s.entitiesBuying / totalEntitiesActive : null;
    const tier = classifyTier(penetration, s.salesGrossBs > 0, thresholds);
    if (tier === 'primera' || tier === 'segunda') {
      tieredLineNames.push(s.line);
      if (penetration !== null) { sum += penetration; n += 1; }
    }
  }
  return { tieredLineNames, baselinePenetration: n > 0 ? sum / n : null };
}

export interface SellerLineCounts {
  salesRepKey: string;
  salesRepName: string;
  entitiesServed: number;
  tieredLinesCovered: number;
}

export function buildSellerCoverageRows(
  sellers: readonly SellerLineCounts[],
  tieredLineCount: number,
  baselinePenetration: number | null,
): SellerCoverageRow[] {
  if (tieredLineCount <= 0) return [];
  return sellers
    .filter(s => s.entitiesServed > 0)
    .map(s => {
      const ownPenetration = s.tieredLinesCovered / (s.entitiesServed * tieredLineCount);
      return {
        salesRepKey: s.salesRepKey,
        salesRepName: s.salesRepName,
        entitiesServed: s.entitiesServed,
        ownPenetration,
        baselinePenetration,
        gapVsBaseline: computeGapVsBaseline(ownPenetration, baselinePenetration),
      };
    })
    .sort((a, b) => (a.gapVsBaseline ?? 0) - (b.gapVsBaseline ?? 0));
}

const LINES_QUERY = (dateWhere: string) => `
  SELECT ISNULL(p.LineName, '${NO_LINEA}') AS Line,
         COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
         SUM(fs.NetAmount) AS SalesGrossBs
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  WHERE fs.IsVoided = 0 ${dateWhere}
  GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
`;

const ACTIVE_ENTITIES_QUERY = (dateWhere: string) => `
  SELECT COUNT(DISTINCT c.LegalEntityKey) AS TotalEntities
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

function sellerQuery(dateWhere: string, lineCount: number): string {
  const placeholders = Array.from({ length: lineCount }, (_, i) => `@tieredLine${i}`).join(', ');
  return `
    SELECT CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKey,
           ISNULL(r.SalesRepName, r.SalesRepCode) AS SalesRepName,
           COUNT(DISTINCT c.LegalEntityKey) AS EntitiesServed,
           COUNT(DISTINCT CONCAT(c.LegalEntityKey, '|', ISNULL(p.LineName, '${NO_LINEA}'))) AS TieredLinesCovered
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineName, '${NO_LINEA}') IN (${placeholders}) ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
  `;
}

// dateWhere comes from buildDateWhereClause(range, 'fs'). Tiered line names are bound with .input().
export async function fetchSellerCoverage(
  pool: sql.ConnectionPool,
  dateWhere: string,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): Promise<SellerCoverageRow[]> {
  const [linesResult, totalResult] = await Promise.all([
    pool.request().query(LINES_QUERY(dateWhere)),
    pool.request().query(ACTIVE_ENTITIES_QUERY(dateWhere)),
  ]);
  const totalEntities = Number(totalResult.recordset[0]?.TotalEntities ?? 0);
  const stats: LineStat[] = linesResult.recordset.map(r => ({
    line: String(r.Line),
    entitiesBuying: Number(r.EntitiesBuying),
    salesGrossBs: Number(r.SalesGrossBs ?? 0),
  }));
  const { tieredLineNames, baselinePenetration } = pickTieredLines(stats, totalEntities, thresholds);
  if (tieredLineNames.length === 0) return [];

  const req = pool.request();
  tieredLineNames.forEach((name, i) => req.input(`tieredLine${i}`, name));
  const sellerResult = await req.query(sellerQuery(dateWhere, tieredLineNames.length));
  const sellers: SellerLineCounts[] = sellerResult.recordset.map(r => ({
    salesRepKey: String(r.SalesRepKey),
    salesRepName: String(r.SalesRepName),
    entitiesServed: Number(r.EntitiesServed),
    tieredLinesCovered: Number(r.TieredLinesCovered),
  }));
  return buildSellerCoverageRows(sellers, tieredLineNames.length, baselinePenetration);
}
