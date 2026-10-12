import sql from 'mssql';
import { buildDateWhereClause, dualAmountExpr, usdConversionJoin } from '@/app/api/dwh/lib/query-builder';
import type { CustomerFact, CustomerLineSales, CustomerWeekActivity } from './aggregate';
import type { Dual, SeguimientoExcludedInvoice, SeguimientoInvoiceLine } from './types';

// Reads only the pre-aggregated dim/fact schema of DWH_AlimentosNY (no ERP tables, no collation
// handling). All user-controlled values go through .input(); the only interpolated SQL is the date
// window from buildDateWhereClause, fed values validated here.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertMonth(month: string): void {
  if (!MONTH_RE.test(month)) throw new Error(`Mes inválido '${month}'; se esperaba YYYY-MM`);
}
function assertIso(d: string): void {
  if (!ISO_RE.test(d)) throw new Error(`Fecha inválida '${d}'; se esperaba YYYY-MM-DD`);
}

export function dateKeyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// Dates are selected as CONVERT(char(10), x, 23) ('YYYY-MM-DD') so no timezone shift can occur and
// visitCompliance/parseIso (which reject timestamps) always receive date-only strings.
const isoOf = (v: unknown): string => {
  const s = String(v).trim();
  if (ISO_RE.test(s)) return s;
  return new Date(v as string | Date).toISOString().slice(0, 10);
};
const dualOf = (bs: unknown, usd: unknown): Dual => ({ bs: Number(bs ?? 0), usd: usd === null || usd === undefined ? null : Number(usd) });

// Invoice -> the customer version it was issued under -> that customer's CURRENT row (same code).
const TO_CURRENT_CUSTOMER = `
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1`;

const CUSTOMERS_QUERY = `
  ;WITH LastInvoice AS (
    SELECT c.CustomerCode, MAX(fs.DateKey) AS LastDateKey
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.DateKey <= @asOfKey
    GROUP BY c.CustomerCode
  )
  SELECT RTRIM(cur.CustomerCode) AS CustomerCode, cur.CustomerName, cur.IsInactive,
    r.SalesRepKey, ISNULL(r.SalesRepName, RTRIM(r.SalesRepCode)) AS SalesRepName,
    RTRIM(cur.ZoneCode) AS ZoneCode, CASE WHEN z.IsRoute = 1 THEN z.RouteNumber END AS RouteNumber,
    RTRIM(cur.ErpSegmentCode) AS ErpSegmentCode, s.SegmentName,
    CONVERT(char(10), cur.RegisteredDate, 23) AS RegisteredDate, cur.IsMigrationBatch, cur.VisitIntervalDays, li.LastDateKey
  FROM dim.Dim_Customer cur
  LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepCode = cur.DefaultSalesRepCode
  LEFT JOIN dim.Dim_Zone z ON z.ZoneCode = cur.ZoneCode
  LEFT JOIN dim.Dim_Segment s ON s.ErpSegmentCode = cur.ErpSegmentCode
  LEFT JOIN LastInvoice li ON li.CustomerCode = cur.CustomerCode
  WHERE cur.IsCurrent = 1
`;

export async function fetchCustomers(pool: sql.ConnectionPool, asOf: string): Promise<CustomerFact[]> {
  assertIso(asOf);
  const result = await pool.request().input('asOfKey', sql.Int, Number(asOf.replace(/-/g, ''))).query(CUSTOMERS_QUERY);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    customerName: String(r.CustomerName ?? r.CustomerCode).trim(),
    isInactive: Boolean(r.IsInactive),
    salesRepKey: r.SalesRepKey === null || r.SalesRepKey === undefined ? null : String(r.SalesRepKey),
    salesRepName: r.SalesRepName === null || r.SalesRepName === undefined ? null : String(r.SalesRepName).trim(),
    zoneCode: r.ZoneCode ? String(r.ZoneCode) : null,
    routeNumber: r.RouteNumber === null || r.RouteNumber === undefined ? null : Number(r.RouteNumber),
    segmentCode: r.ErpSegmentCode ? String(r.ErpSegmentCode) : null,
    segmentName: r.SegmentName ? String(r.SegmentName).trim() : null,
    registeredDate: r.RegisteredDate ? isoOf(r.RegisteredDate) : null,
    isMigrationBatch: Boolean(r.IsMigrationBatch),
    visitIntervalDays: r.VisitIntervalDays === null || r.VisitIntervalDays === undefined ? null : Number(r.VisitIntervalDays),
    lastInvoiceDate: r.LastDateKey ? dateKeyToIso(Number(r.LastDateKey)) : null,
  }));
}

// Ventas BRUTAS per customer x product line: SUM(Fact_Sales.NetAmount) (sin IVA, before returns),
// the plan's Global Constraints definition, same as vendedores/route.ts. fact.Fact_Returns is NOT
// read, so every row is >= 0 and bucketCategoryMix (which drops rows <= 0) never silently loses a
// line. Switching to ventas netas would need buildReturnsDateWhereClause(..., 'factura') +
// returnsUsdConversionJoin per AGENTS.md, and category-mix would then have to handle negative lines.
export async function fetchLineSales(pool: sql.ConnectionPool, month: string): Promise<CustomerLineSales[]> {
  assertMonth(month);
  const where = buildDateWhereClause(`month:${month}`, 'fs');
  const result = await pool.request().query(`
    SELECT RTRIM(cur.CustomerCode) AS CustomerCode, p.LineName AS LineName,
      SUM(fs.QuantitySold) AS Units, ${dualAmountExpr('fs', 'NetAmount', 'SalesBs', 'SalesUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${TO_CURRENT_CUSTOMER}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${where}
    GROUP BY RTRIM(cur.CustomerCode), p.LineName
  `);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    line: r.LineName === null || r.LineName === undefined ? null : String(r.LineName).trim() || null,
    units: Number(r.Units ?? 0),
    sales: dualOf(r.SalesBs, r.SalesUsd),
  }));
}

export async function fetchWeekActivity(pool: sql.ConnectionPool, from: string, to: string): Promise<CustomerWeekActivity[]> {
  assertIso(from);
  assertIso(to);
  const where = buildDateWhereClause(`custom:${from}:${to}`, 'fs');
  const result = await pool.request().query(`
    SELECT DISTINCT RTRIM(cur.CustomerCode) AS CustomerCode, d.YearWeek
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    ${TO_CURRENT_CUSTOMER}
    WHERE fs.IsVoided = 0 ${where}
  `);
  return result.recordset.map(r => ({ customerCode: String(r.CustomerCode), yearWeek: String(r.YearWeek).trim() }));
}

export async function fetchCustomerInvoiceLines(
  pool: sql.ConnectionPool, customerCode: string, month: string,
): Promise<SeguimientoInvoiceLine[]> {
  assertMonth(month);
  const where = buildDateWhereClause(`month:${month}`, 'fs');
  const result = await pool.request().input('customerCode', sql.VarChar(16), customerCode).query(`
    SELECT TOP 500 RTRIM(fs.InvoiceNumber) AS InvoiceNumber, CONVERT(char(10), d.FullDate, 23) AS InvoiceDate, fs.LineNumber,
      RTRIM(p.ProductCode) AS ProductCode, ISNULL(p.ProductName, RTRIM(p.ProductCode)) AS ProductName, p.LineName,
      fs.QuantitySold AS Quantity, fs.NetAmount AS AmountBs, fs.NetAmount / NULLIF(fx.RateSell, 0) AS AmountUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND c.CustomerCode = @customerCode ${where}
    ORDER BY d.FullDate DESC, fs.InvoiceNumber, fs.LineNumber
  `);
  return result.recordset.map(r => {
    const quantity = Number(r.Quantity);
    const amount = dualOf(r.AmountBs, r.AmountUsd);
    return {
      invoiceNumber: String(r.InvoiceNumber),
      invoiceDate: isoOf(r.InvoiceDate),
      lineNumber: Number(r.LineNumber),
      productCode: String(r.ProductCode),
      productName: String(r.ProductName).trim(),
      lineName: r.LineName === null || r.LineName === undefined ? null : String(r.LineName).trim() || null,
      quantity,
      amount,
      unitPrice: quantity > 0 ? { bs: amount.bs / quantity, usd: amount.usd === null ? null : amount.usd / quantity } : null,
    };
  });
}

export async function fetchExcludedInvoices(
  pool: sql.ConnectionPool, month: string, customerCodes: string[],
): Promise<SeguimientoExcludedInvoice[]> {
  assertMonth(month);
  if (customerCodes.length === 0) return [];
  const where = buildDateWhereClause(`month:${month}`, 'fs');
  const req = pool.request();
  const placeholders = customerCodes.map((code, i) => {
    req.input(`code${i}`, sql.VarChar(16), code);
    return `@code${i}`;
  });
  const result = await req.query(`
    SELECT RTRIM(c.CustomerCode) AS CustomerCode, c.CustomerName, RTRIM(fs.InvoiceNumber) AS InvoiceNumber, CONVERT(char(10), d.FullDate, 23) AS InvoiceDate,
      ${dualAmountExpr('fs', 'NetAmount', 'NetBs', 'NetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 AND c.CustomerCode IN (${placeholders.join(', ')}) ${where}
    GROUP BY c.CustomerCode, c.CustomerName, fs.InvoiceNumber, d.FullDate
    ORDER BY d.FullDate DESC, fs.InvoiceNumber
  `);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    customerName: String(r.CustomerName ?? r.CustomerCode).trim(),
    invoiceNumber: String(r.InvoiceNumber),
    invoiceDate: isoOf(r.InvoiceDate),
    amountNet: dualOf(r.NetBs, r.NetUsd),
  }));
}
