import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimensionForFact, jsonWithCache, type Dimension } from '@/app/api/dwh/lib/query-builder';
import { isConsignmentPattern, DEFAULT_ROOT_SHARE_THRESHOLD } from './consignment';
import type { VendedoresResponse, VendedoresRow, VendedoresExcludedInvoice, VendedoresExcludedResponse } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// Consignment-pattern exclusion: see docs/superpowers/specs/
// 2026-09-21-consignment-commission-exclusion-design.md. A multi-tienda
// legal entity is flagged when its share of sales billed at the ROOT
// customer code (rather than individual tienda codes) meets or exceeds
// rootShareThreshold. Flagged entities' root-level invoices are excluded
// from a seller's "reliable" salesNet/collected totals and surfaced
// separately as excludedSalesNet/excludedCollected — never estimated or
// redistributed across sellers.

// Joins Dim_Customer independently of the dimension's own joinClause (which,
// for 'producto'/'vendedor', doesn't touch Customer at all) so the same
// flagged-root-code exclusion applied to the parent row's SalesNet also
// applies here — otherwise a seller's breakdown would sum to a pre-exclusion
// total while the collapsed row shows the post-exclusion figure, and a
// flagged root customer would appear as its own (misleading, full-amount)
// breakdown row under cliente_entidad/cliente_tienda.
function breakdownQuery(dimension: Dimension, salesDateWhere: string, flaggedRootCodes: string[]): string {
  const spec = getDimensionSpec(dimension);
  const excludeClause = flaggedRootCodes.length > 0
    ? `AND bqc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})`
    : '';
  return `
    SELECT TOP 15 ${spec.valueExpr} AS GroupValue, ${spec.labelExpr} AS GroupLabel, SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer bqc ON bqc.CustomerKey = fs.CustomerKey
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${salesDateWhere} ${excludeClause}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}

// Per legal-entity root-billing ratio, scoped to the current date range —
// recomputed per request rather than persisted, since this is a reporting
// judgment (tunable threshold) not a stable ERP fact.
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

// Per-seller sales/returns, split by whether the invoice's own customer
// belongs to a flagged entity AND was billed at that entity's root code
// (only the ambiguous root-level invoices are excluded — a flagged chain's
// normally-billed tienda invoices still count normally).
function salesRepQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string, flaggedRootCodes: string[]): string {
  const flaggedCase = flaggedRootCodes.length > 0
    ? `CASE WHEN c.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')}) THEN 1 ELSE 0 END`
    : '0';
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKeyValue,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      SUM(CASE WHEN ${flaggedCase} = 0 THEN fs.NetAmount ELSE 0 END) AS SalesNet,
      SUM(CASE WHEN ${flaggedCase} = 1 THEN fs.NetAmount ELSE 0 END) AS ExcludedSalesNet,
      COUNT(DISTINCT CASE WHEN ${flaggedCase} = 1 THEN fs.InvoiceNumber END) AS ExcludedInvoiceCount,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Customer rc ON rc.CustomerKey = fr.CustomerKey
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `rc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS ReturnsNet,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS Collected,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 0'}
      ) AS ExcludedCollected
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNet DESC
  `;
}

// Fact_Sales has no SalesDate column — only DateKey (int, FK to
// dim.Dim_Date), so this joins Dim_Date for FullDate, same pattern as
// app/api/dwh/clientes/route.ts's churnedQuery.
function excludedInvoicesQuery(salesDateWhere: string, flaggedRootCodes: string[]): string {
  return `
    SELECT c.CustomerName AS LegalEntityName, fs.InvoiceNumber, d.FullDate AS SalesDate, SUM(fs.NetAmount) AS NetAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${salesDateWhere}
      AND c.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})
    GROUP BY c.CustomerName, fs.InvoiceNumber, d.FullDate
    ORDER BY d.FullDate DESC
  `;
}

async function getFlaggedRootCodes(dateWhere: string, rootShareThreshold: number): Promise<string[]> {
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

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  // Clamped to (0, 1] — this threshold gates whether a legal entity's sales
  // get excluded from a seller's commission-relevant totals, so an
  // unclamped value (e.g. 0, which would flag every multi-tienda entity)
  // could mass-exclude legitimate sales from every seller at once.
  const rootShareThresholdParam = Number(searchParams.get('rootShareThreshold') ?? DEFAULT_ROOT_SHARE_THRESHOLD);
  const rootShareThreshold = Number.isFinite(rootShareThresholdParam) && rootShareThresholdParam > 0 && rootShareThresholdParam <= 1
    ? rootShareThresholdParam
    : DEFAULT_ROOT_SHARE_THRESHOLD;

  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimensionForFact(breakdownByParam, 'sales') ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');

  try {
    const pool = await getDwhPool();
    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const flaggedRootCodes = await getFlaggedRootCodes(salesDateWhere, rootShareThreshold);

    if (breakdownBy && parentValue && /^\d+$/.test(parentValue)) {
      const req = pool.request();
      req.input('salesRepKey', Number(parentValue));
      flaggedRootCodes.forEach((code, i) => req.input(`flaggedRoot${i}`, code));
      const result = await req.query(breakdownQuery(breakdownBy, salesDateWhere, flaggedRootCodes));
      return jsonWithCache({
        breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), salesNet: Number(r.SalesNet) })),
      });
    }

    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    const collectionsDateWhere = buildDateWhereClause(dateRange, 'fc');

    if (searchParams.get('section') === 'excluded' && parentValue && /^\d+$/.test(parentValue)) {
      if (flaggedRootCodes.length === 0) {
        const response: VendedoresExcludedResponse = { invoices: [] };
        return jsonWithCache(response);
      }
      const req = pool.request().input('salesRepKey', Number(parentValue));
      flaggedRootCodes.forEach((code, i) => req.input(`flaggedRoot${i}`, code));
      const result = await req.query(excludedInvoicesQuery(salesDateWhere, flaggedRootCodes));
      const invoices: VendedoresExcludedInvoice[] = result.recordset.map(r => ({
        legalEntityName: String(r.LegalEntityName),
        invoiceNumber: String(r.InvoiceNumber),
        invoiceDate: new Date(r.SalesDate).toISOString().slice(0, 10),
        amountNet: Number(r.NetAmount),
      }));
      const response: VendedoresExcludedResponse = { invoices };
      return jsonWithCache(response);
    }

    const salesReq = pool.request();
    flaggedRootCodes.forEach((code, i) => salesReq.input(`flaggedRoot${i}`, code));

    const [salesReps, usdRate] = await Promise.all([
      salesReq.query(salesRepQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere, flaggedRootCodes)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const rows: VendedoresRow[] = salesReps.recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const returnsNet = Number(r.ReturnsNet);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const collected = Number(r.Collected);

      return {
        value: String(r.SalesRepKeyValue),
        name: r.Name,
        salesNet,
        returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        collectionRate: salesNet > 0 ? collected / salesNet : null,
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
        excludedSalesNet: Number(r.ExcludedSalesNet),
        excludedCollected: Number(r.ExcludedCollected),
        excludedInvoiceCount: Number(r.ExcludedInvoiceCount),
      };
    });

    const response: VendedoresResponse = { rows, usdRate };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
