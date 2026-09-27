import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, jsonWithCache, usdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import { buildXlsx } from '@/lib/xlsx';
import { buildMatrizExportRows, MATRIZ_EXPORT_COLUMNS, type MatrizExportSalesRow, type MatrizExportReturnsRow } from './export-rows';
import type { SellerSummaryRow, SellerSummaryResponse, SellerMatrixProduct, SellerMatrixStore, SellerMatrixCell, SellerMatrixResponse } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// migrations/dwh/), not the raw Profit Plus ERP — no COLLATE/RTRIM
// gymnastics needed here, that already happened at load time. See
// docs/superpowers/specs/2026-09-23-seller-product-store-matrix-design.md.
//
// This is a seller-first drill-down, distinct from the existing Profundidad
// de Línea tab (app/api/dwh/profundidad-linea/route.ts, unchanged by this
// feature): that tab shows product-line-tier penetration by customer
// segment; this one shows one seller's own product x store matrix.

// Two distinct usdConversionJoin pairs are in scope in this one query: the
// outer query's 'fx' join (against fs, the default alias) for NetSales, and
// the correlated returns subqueries' own 'fxr' join (against fr) for
// NetReturns. Using the default 'fx' alias for both would collide -- the
// subquery's FROM would try to join fact.Fact_ExchangeRate fx a second time
// while 'fx' from the outer query is already in scope. Passing a distinct
// joinAlias ('fxr') to usdConversionJoin('fr', ..., 'fxr') keeps the two
// joins fully independent. dualAmountExpr itself returns a 2-column
// fragment (SUM(...) AS bs, SUM(...) AS usd), which is only valid in a
// top-level SELECT list -- a scalar subquery must return exactly one
// column, so NetReturnsBs/NetReturnsUsd are two separate correlated scalar
// subqueries here, each replicating dualAmountExpr's per-row-rate-before-sum
// logic for a single column, both sharing the SAME 'fxr' join alias.
function summaryQuery(salesDateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKey,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS SalesRepName,
      ${dualAmountExpr('fs', 'NetAmount', 'NetSalesBs', 'NetSalesUsd')},
      COUNT(DISTINCT le.LegalEntityKey) AS EntitiesServed,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS NetReturnsBs,
      (SELECT SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, fxr.RateSell), 0))
         FROM fact.Fact_Returns fr
         ${usdConversionJoin('fr', 'DateKey', 'fxr')}
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS NetReturnsUsd
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    ${usdConversionJoin('fs')}
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY NetSalesBs DESC
  `;
}

async function handleSummary(salesDateWhere: string, returnsDateWhere: string): Promise<NextResponse> {
  const pool = await getDwhPool();
  const result = await pool.request().query(summaryQuery(salesDateWhere, returnsDateWhere));

  const rows: SellerSummaryRow[] = result.recordset.map(r => ({
    salesRepKey: String(r.SalesRepKey),
    salesRepName: String(r.SalesRepName),
    netSales: { bs: Number(r.NetSalesBs), usd: r.NetSalesUsd === null ? null : Number(r.NetSalesUsd) },
    netReturns: { bs: Number(r.NetReturnsBs), usd: r.NetReturnsUsd === null ? null : Number(r.NetReturnsUsd) },
    entitiesServed: Number(r.EntitiesServed),
  }));

  const response: SellerSummaryResponse = { rows };
  return jsonWithCache(response);
}

// Fact_Sales and Fact_Returns are two different fact tables, each queried
// independently here (not both in one query), so their usdConversionJoin
// calls never share a single query's FROM clause -- no alias collision risk
// between the two, and both can safely use the default 'fx' alias.
function matrixSalesQuery(dateWhere: string): string {
  return `
    SELECT
      fs.ProductKey,
      p.ProductName, p.LineName, p.SubLineName, p.CategoryName,
      fs.CustomerKey,
      ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
      le.LegalEntityName,
      ${dualAmountExpr('fs', 'NetAmount', 'NetSalesBs', 'NetSalesUsd')},
      SUM(fs.QuantitySold) AS Units
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    ${usdConversionJoin('fs')}
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${dateWhere}
    GROUP BY fs.ProductKey, p.ProductName, p.LineName, p.SubLineName, p.CategoryName,
             fs.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode), le.LegalEntityName
  `;
}

function matrixReturnsQuery(dateWhere: string): string {
  return `
    SELECT
      fr.ProductKey, fr.CustomerKey,
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      SUM(fr.QuantityReturned) AS ReturnsUnits
    FROM fact.Fact_Returns fr
    ${usdConversionJoin('fr')}
    WHERE fr.IsVoided = 0 AND fr.SalesRepKey = @salesRepKey ${dateWhere}
    GROUP BY fr.ProductKey, fr.CustomerKey
  `;
}

async function handleMatrix(salesDateWhere: string, returnsDateWhere: string, salesRepKey: number): Promise<NextResponse> {
  const pool = await getDwhPool();

  const [salesResult, returnsResult] = await Promise.all([
    pool.request().input('salesRepKey', salesRepKey).query(matrixSalesQuery(salesDateWhere)),
    pool.request().input('salesRepKey', salesRepKey).query(matrixReturnsQuery(returnsDateWhere)),
  ]);

  const returnsByKey = new Map<string, { netBs: number; netUsd: number | null; units: number }>();
  for (const r of returnsResult.recordset) {
    returnsByKey.set(`${r.ProductKey}|${r.CustomerKey}`, {
      netBs: Number(r.ReturnsNetBs),
      netUsd: r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd),
      units: Number(r.ReturnsUnits),
    });
  }

  const productsByKey = new Map<number, SellerMatrixProduct>();
  const storesByKey = new Map<number, SellerMatrixStore>();
  const cells: SellerMatrixCell[] = [];

  for (const r of salesResult.recordset) {
    const productKey = Number(r.ProductKey);
    const customerKey = Number(r.CustomerKey);
    const netSalesBs = Number(r.NetSalesBs);
    const netSalesUsd = r.NetSalesUsd === null ? null : Number(r.NetSalesUsd);
    const units = Number(r.Units);

    if (!productsByKey.has(productKey)) {
      productsByKey.set(productKey, {
        productKey,
        productName: String(r.ProductName),
        lineName: r.LineName === null ? null : String(r.LineName),
        subLineName: r.SubLineName === null ? null : String(r.SubLineName),
        categoryName: r.CategoryName === null ? null : String(r.CategoryName),
      });
    }
    if (!storesByKey.has(customerKey)) {
      storesByKey.set(customerKey, {
        customerKey,
        customerName: String(r.CustomerName),
        legalEntityName: String(r.LegalEntityName),
      });
    }

    const returns = returnsByKey.get(`${productKey}|${customerKey}`);
    // returnRateUsd is a ratio, currency-invariant by construction -- but it
    // is USD-denominated regardless of the dashboard's currency toggle (same
    // convention as every other *Usd-suffixed rate elsewhere in this route),
    // so it's computed off the .usd side of both dual amounts, not .bs.
    const returnRateUsd = returns && returns.netUsd !== null && netSalesUsd !== null && netSalesUsd > 0
      ? returns.netUsd / netSalesUsd
      : null;
    cells.push({
      productKey,
      customerKey,
      netSales: { bs: netSalesBs, usd: netSalesUsd },
      units,
      returnRateUsd,
      returnRateUnits: returns && units > 0 ? returns.units / units : null,
    });
  }

  const response: SellerMatrixResponse = {
    products: Array.from(productsByKey.values()),
    stores: Array.from(storesByKey.values()),
    cells,
  };
  return jsonWithCache(response);
}

// Grouped at (SalesRepKey, ProductKey, CustomerKey, WeekStartDate) grain --
// dualAmountExpr converts each underlying invoice LINE at its own historical
// DocumentExchangeRate before this SUM aggregates it, so a week bucket
// spanning invoices issued on different days (at different rates) is
// correct, unlike summing raw BS first and dividing by one rate. When
// salesRepKey is null, every seller is included (the "export all" variant);
// when provided, the query is additionally scoped to that one seller.
function exportSalesQuery(dateWhere: string, salesRepFilter: string): string {
  return `
    SELECT
      ISNULL(rep.SalesRepName, rep.SalesRepCode) AS SalesRepName,
      le.LegalEntityName,
      ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
      ISNULL(p.ProductName, p.ProductCode) AS ProductName,
      p.LineName, p.SubLineName, p.CategoryName,
      CONVERT(varchar(10), d.WeekStartDate, 120) AS WeekStartDate,
      d.YearMonth,
      ${dualAmountExpr('fs', 'NetAmount', 'IngresoBs', 'IngresoUsd')},
      SUM(fs.QuantitySold) AS Unidades
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    ${usdConversionJoin('fs')}
    WHERE fs.IsVoided = 0 ${dateWhere} ${salesRepFilter}
    GROUP BY
      ISNULL(rep.SalesRepName, rep.SalesRepCode), le.LegalEntityName, ISNULL(c.CustomerName, c.CustomerCode),
      ISNULL(p.ProductName, p.ProductCode), p.LineName, p.SubLineName, p.CategoryName,
      d.WeekStartDate, d.YearMonth
  `;
}

function exportReturnsQuery(dateWhere: string, salesRepFilter: string): string {
  return `
    SELECT
      ISNULL(rep.SalesRepName, rep.SalesRepCode) AS SalesRepName,
      le.LegalEntityName,
      ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
      ISNULL(p.ProductName, p.ProductCode) AS ProductName,
      p.LineName, p.SubLineName, p.CategoryName,
      CONVERT(varchar(10), d.WeekStartDate, 120) AS WeekStartDate,
      d.YearMonth,
      ${dualAmountExpr('fr', 'NetAmount', 'DevolucionBs', 'DevolucionUsd')},
      SUM(fr.QuantityReturned) AS DevolucionUnidades
    FROM fact.Fact_Returns fr
    JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = fr.SalesRepKey
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fr.DateKey
    ${usdConversionJoin('fr')}
    WHERE fr.IsVoided = 0 ${dateWhere} ${salesRepFilter}
    GROUP BY
      ISNULL(rep.SalesRepName, rep.SalesRepCode), le.LegalEntityName, ISNULL(c.CustomerName, c.CustomerCode),
      ISNULL(p.ProductName, p.ProductCode), p.LineName, p.SubLineName, p.CategoryName,
      d.WeekStartDate, d.YearMonth
  `;
}

async function handleXlsxExport(
  salesDateWhere: string, returnsDateWhere: string, salesRepKey: number | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const salesRepFilter = salesRepKey !== null ? 'AND fs.SalesRepKey = @salesRepKey' : '';
  const returnsSalesRepFilter = salesRepKey !== null ? 'AND fr.SalesRepKey = @salesRepKey' : '';

  const salesReq = pool.request();
  const returnsReq = pool.request();
  if (salesRepKey !== null) {
    salesReq.input('salesRepKey', salesRepKey);
    returnsReq.input('salesRepKey', salesRepKey);
  }

  const [salesResult, returnsResult] = await Promise.all([
    salesReq.query(exportSalesQuery(salesDateWhere, salesRepFilter)),
    returnsReq.query(exportReturnsQuery(returnsDateWhere, returnsSalesRepFilter)),
  ]);

  const salesRows = salesResult.recordset as MatrizExportSalesRow[];
  const returnsRows = returnsResult.recordset as MatrizExportReturnsRow[];
  const rows = buildMatrizExportRows(salesRows, returnsRows);

  const buffer = buildXlsx(MATRIZ_EXPORT_COLUMNS, rows);
  const filenameSuffix = salesRepKey !== null ? `vendedor-${salesRepKey}` : 'todos';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="matriz-vendedor-${filenameSuffix}.xlsx"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const section = searchParams.get('section');

  try {
    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');

    const salesRepKeyParam = searchParams.get('salesRepKey');
    const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;

    if (section === 'summary') {
      return await handleSummary(salesDateWhere, returnsDateWhere);
    }

    if (section === 'matrix') {
      if (salesRepKey === null) {
        return NextResponse.json({ error: 'Falta salesRepKey' }, { status: 400 });
      }
      return await handleMatrix(salesDateWhere, returnsDateWhere, salesRepKey);
    }

    const format = searchParams.get('format');
    if (format === 'xlsx') {
      if (salesRepKeyParam !== null && salesRepKey === null) {
        return NextResponse.json({ error: 'salesRepKey inválido' }, { status: 400 });
      }
      return await handleXlsxExport(salesDateWhere, returnsDateWhere, salesRepKey);
    }

    return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
