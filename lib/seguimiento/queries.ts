import sql from 'mssql';
import {
  buildDateWhereClause, buildReturnsDateWhereClause, dualAmountExpr, returnsUsdConversionJoin, usdConversionJoin,
} from '@/app/api/dwh/lib/query-builder';
import type { CustomerFact, CustomerLineReturns, CustomerLineSales, CustomerWeekActivity, CustomerWeekAmounts } from './aggregate';
import { sumHistoryLines } from './history-stack';
import type { Dual, HistoryPoint, HistoryScope, SeguimientoExcludedInvoice, SeguimientoInvoiceLine } from './types';

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
// line. Switching to ventas netas would need buildReturnsDateWhereClause(..., 'devolucion') +
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

// Fact_Returns line -> the customer version it was issued under -> that customer's CURRENT row.
const RETURNS_TO_CURRENT_CUSTOMER = `
    JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
    JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1`;

// Devoluciones per customer x product line, windowed by the DEVOLUCIÓN date (Seguimiento always
// uses it and never reads returnsBasis) and converted at the original factura's rate (AGENTS.md "Ventas brutas / netas").
export async function fetchLineReturns(pool: sql.ConnectionPool, month: string): Promise<CustomerLineReturns[]> {
  assertMonth(month);
  const where = buildReturnsDateWhereClause(`month:${month}`, 'fr');
  const result = await pool.request().query(`
    SELECT RTRIM(cur.CustomerCode) AS CustomerCode, p.LineName AS LineName,
      SUM(fr.QuantityReturned) AS Units, ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    ${RETURNS_TO_CURRENT_CUSTOMER}
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    WHERE fr.IsVoided = 0 ${where}
    GROUP BY RTRIM(cur.CustomerCode), p.LineName
  `);
  return result.recordset.map(r => ({
    customerCode: String(r.CustomerCode),
    line: r.LineName === null || r.LineName === undefined ? null : String(r.LineName).trim() || null,
    units: Number(r.Units ?? 0),
    returns: dualOf(r.ReturnsBs, r.ReturnsUsd),
  }));
}

// Per customer x ISO week (Dim_Date.YearWeek), clipped to the month: the window is the month only, so
// the edge weeks hold just their in-month days. Sales by invoice date, returns by devolución date.
export async function fetchWeekAmounts(pool: sql.ConnectionPool, month: string): Promise<CustomerWeekAmounts[]> {
  assertMonth(month);
  const salesWhere = buildDateWhereClause(`month:${month}`, 'fs');
  const returnsWhere = buildReturnsDateWhereClause(`month:${month}`, 'fr');
  const [sales, returns] = await Promise.all([
    pool.request().query(`
      SELECT RTRIM(cur.CustomerCode) AS CustomerCode, d.YearWeek,
        SUM(fs.QuantitySold) AS Units, ${dualAmountExpr('fs', 'NetAmount', 'SalesBs', 'SalesUsd')}
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      ${TO_CURRENT_CUSTOMER}
      WHERE fs.IsVoided = 0 ${salesWhere}
      GROUP BY RTRIM(cur.CustomerCode), d.YearWeek
    `),
    pool.request().query(`
      SELECT RTRIM(cur.CustomerCode) AS CustomerCode, d.YearWeek,
        SUM(fr.QuantityReturned) AS Units, ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr')}
      JOIN dim.Dim_Date d ON d.DateKey = fr.DateKey
      ${RETURNS_TO_CURRENT_CUSTOMER}
      WHERE fr.IsVoided = 0 ${returnsWhere}
      GROUP BY RTRIM(cur.CustomerCode), d.YearWeek
    `),
  ]);
  const out = new Map<string, CustomerWeekAmounts>();
  const cell = (code: string, yearWeek: string): CustomerWeekAmounts => {
    const key = `${code}|${yearWeek}`;
    let c = out.get(key);
    if (!c) {
      c = { customerCode: code, yearWeek, units: 0, sales: { bs: 0, usd: 0 }, returnUnits: 0, returns: { bs: 0, usd: 0 } };
      out.set(key, c);
    }
    return c;
  };
  for (const r of sales.recordset) {
    const c = cell(String(r.CustomerCode), String(r.YearWeek).trim());
    c.units = Number(r.Units ?? 0);
    c.sales = dualOf(r.SalesBs, r.SalesUsd);
  }
  for (const r of returns.recordset) {
    const c = cell(String(r.CustomerCode), String(r.YearWeek).trim());
    c.returnUnits = Number(r.Units ?? 0);
    c.returns = dualOf(r.ReturnsBs, r.ReturnsUsd);
  }
  return [...out.values()];
}

const NO_ROOT_VALUES = new Set(['sin-vendedor', 'sin-ruta', 'sin-grupo']);

function shiftMonth(month: string, delta: number): string {
  const n = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}

// Twelve months ending endMonth, sales per month x product line (Dim_Product.LineName, for the stacked
// bars) and returns per month only. The scope filter uses the CURRENT customer row (cur / z / r joined
// below); the root value and every excluded consignment code are bound with .input(). Months with no
// rows are simply absent from the result.
export async function fetchHistory(
  pool: sql.ConnectionPool, scope: HistoryScope, endMonth: string, excludeCodes: string[],
): Promise<HistoryPoint[]> {
  assertMonth(endMonth);
  const startMonth = shiftMonth(endMonth, -11);
  const range = `custom:${startMonth}-01:${endMonth}-31`;
  // buildDateWhereClause on a custom range only strips hyphens, so day 31 is a safe upper bound for
  // the DateKey comparison in every month.
  const salesWhere = buildDateWhereClause(range, 'fs');
  const returnsWhere = buildReturnsDateWhereClause(range, 'fr');

  const conditions: string[] = [];
  const bind = (req: sql.Request): void => {
    if (scope.kind !== 'total' && !NO_ROOT_VALUES.has(scope.value)) req.input('rootValue', sql.VarChar(32), scope.value);
    excludeCodes.forEach((code, i) => req.input(`code${i}`, sql.VarChar(16), code));
  };
  if (scope.kind === 'vendedor') {
    conditions.push(NO_ROOT_VALUES.has(scope.value) ? 'r.SalesRepKey IS NULL' : 'CAST(r.SalesRepKey AS varchar(32)) = @rootValue');
  } else if (scope.kind === 'ruta') {
    conditions.push(NO_ROOT_VALUES.has(scope.value)
      ? '(z.IsRoute IS NULL OR z.IsRoute <> 1 OR z.RouteNumber IS NULL)'
      : 'RTRIM(cur.ZoneCode) = @rootValue AND z.IsRoute = 1');
  } else if (scope.kind === 'grupo') {
    conditions.push(NO_ROOT_VALUES.has(scope.value) ? "NULLIF(RTRIM(cur.ErpSegmentCode), '') IS NULL" : 'RTRIM(cur.ErpSegmentCode) = @rootValue');
  }
  if (excludeCodes.length > 0) {
    conditions.push(`RTRIM(cur.CustomerCode) NOT IN (${excludeCodes.map((_, i) => `@code${i}`).join(', ')})`);
  }
  const scopeSql = conditions.map(c => ` AND ${c}`).join('');
  const SCOPE_JOINS = `
    LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepCode = cur.DefaultSalesRepCode
    LEFT JOIN dim.Dim_Zone z ON z.ZoneCode = cur.ZoneCode`;

  const salesReq = pool.request();
  bind(salesReq);
  const returnsReq = pool.request();
  bind(returnsReq);
  const [sales, returns] = await Promise.all([
    salesReq.query(`
      SELECT d.YearMonth AS Month, p.LineName AS LineName,
        SUM(fs.QuantitySold) AS Units, ${dualAmountExpr('fs', 'NetAmount', 'SalesBs', 'SalesUsd')}
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
      ${TO_CURRENT_CUSTOMER}${SCOPE_JOINS}
      WHERE fs.IsVoided = 0 ${salesWhere}${scopeSql}
      GROUP BY d.YearMonth, p.LineName
    `),
    returnsReq.query(`
      SELECT d.YearMonth AS Month, SUM(fr.QuantityReturned) AS Units, ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr')}
      JOIN dim.Dim_Date d ON d.DateKey = fr.DateKey
      ${RETURNS_TO_CURRENT_CUSTOMER}${SCOPE_JOINS}
      WHERE fr.IsVoided = 0 ${returnsWhere}${scopeSql}
      GROUP BY d.YearMonth
    `),
  ]);
  const out = new Map<string, HistoryPoint>();
  const point = (month: string): HistoryPoint => {
    let p = out.get(month);
    if (!p) {
      p = { month, sales: { bs: 0, usd: 0 }, units: 0, returns: { bs: 0, usd: 0 }, returnUnits: 0, byLine: [] };
      out.set(month, p);
    }
    return p;
  };
  for (const r of sales.recordset) {
    const p = point(String(r.Month).trim());
    // NULL and blank line names are one "no line" bucket (null), as in fetchLineSales.
    const line = r.LineName === null || r.LineName === undefined ? null : String(r.LineName).trim() || null;
    const row = { line, units: Number(r.Units ?? 0), sales: dualOf(r.SalesBs, r.SalesUsd) };
    const same = p.byLine!.find(l => l.line === line);
    if (same) {
      const merged = sumHistoryLines([same, row]);
      same.units = merged.units;
      same.sales = merged.sales;
    } else {
      p.byLine!.push(row);
    }
  }
  // The month's brutas are the sum of its lines, so the stacked segments always add up to the bar.
  for (const p of out.values()) {
    if (p.byLine!.length === 0) continue;
    const t = sumHistoryLines(p.byLine!);
    p.sales = t.sales;
    p.units = t.units;
  }
  for (const r of returns.recordset) {
    const p = point(String(r.Month).trim());
    p.returnUnits = Number(r.Units ?? 0);
    p.returns = dualOf(r.ReturnsBs, r.ReturnsUsd);
  }
  return [...out.values()].sort((a, b) => a.month.localeCompare(b.month));
}
