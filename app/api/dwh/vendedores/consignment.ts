import { getDwhPool } from '@/lib/db/dwh-mssql';

export const DEFAULT_ROOT_SHARE_THRESHOLD = 0.15;

export function isConsignmentPattern(salesOnRoot: number, totalSales: number, threshold: number): boolean {
  if (totalSales <= 0) return false;
  return salesOnRoot / totalSales >= threshold;
}

// Per legal-entity root-billing ratio, scoped to the current date range —
// recomputed per request rather than persisted, since this is a reporting
// judgment (tunable threshold) not a stable ERP fact. Shared by
// vendedores/route.ts and vendedor-360/route.ts so both routes exclude the
// exact same set of flagged root-billed invoices from a seller's sales
// figures — see docs/superpowers/specs/
// 2026-09-21-consignment-commission-exclusion-design.md.
function consignmentFlagsQuery(dateWhere: string): string {
  return `
    SELECT
      le.LegalEntityKey,
      SUM(CASE WHEN c.CustomerCode = le.RootCustomerCode THEN fs.NetAmount ELSE 0 END) AS SalesOnRoot,
      SUM(fs.NetAmount) AS TotalSales
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 AND le.StoreCount > 1 ${dateWhere}
    GROUP BY le.LegalEntityKey
    HAVING SUM(fs.NetAmount) > 0
  `;
}

// A multi-tienda legal entity is flagged when its share of sales billed at
// the ROOT customer code (rather than individual tienda codes) meets or
// exceeds rootShareThreshold. Returns the (trimmed) root customer codes to
// exclude from a seller's "reliable" sales/collections totals — never
// estimated or redistributed across sellers.
export async function getFlaggedRootCodes(dateWhere: string, rootShareThreshold: number): Promise<string[]> {
  const pool = await getDwhPool();
  const result = await pool.request().query(consignmentFlagsQuery(dateWhere));
  const flaggedEntityKeys = result.recordset
    .filter(r => isConsignmentPattern(Number(r.SalesOnRoot), Number(r.TotalSales), rootShareThreshold))
    .map(r => Number(r.LegalEntityKey));

  if (flaggedEntityKeys.length === 0) return [];

  const rootReq = pool.request();
  const placeholders = flaggedEntityKeys.map((_, i) => {
    rootReq.input(`entityKey${i}`, flaggedEntityKeys[i]);
    return `@entityKey${i}`;
  });
  const rootResult = await rootReq.query(`
    SELECT RootCustomerCode FROM dim.Dim_LegalEntity WHERE LegalEntityKey IN (${placeholders.join(', ')})
  `);
  return rootResult.recordset.map(r => String(r.RootCustomerCode).trim());
}
