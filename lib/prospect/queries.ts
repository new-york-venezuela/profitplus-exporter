import type sql from 'mssql';
import { usdConversionJoin } from '@/app/api/dwh/lib/query-builder';

export interface BaseCustomer {
  code: string;
  name: string;
  typeCode: string | null;
  typeName: string | null;
  routeNumber: number | null;
  routeName: string | null;
  /** First invoice DateKey inside the window. */
  firstKey: number | null;
  units: number;
}

export interface ProductRow {
  customerCode: string;
  productCode: string;
  productName: string;
  units: number;
  /** Sum of USD net amount over rows that had a USD rate; null when none did. */
  usdNet: number | null;
  /** Units that had a USD rate (denominator for the USD cost per unit). */
  usdUnits: number;
}

const LINES = `('Panaderia', 'Pasteleria', 'Pizza')`;

// Sales are attributed to the CURRENT Dim_Customer row (by CustomerCode), like Seguimiento/Clientes, so old
// invoices follow the customer. Only current, non-inactive customers; only the three product lines; no voided
// sales. Window dates arrive via .input() only.
const fromSales = (extraJoins = '') => `
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1 AND cur.IsInactive = 0
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    ${extraJoins}
    WHERE fs.IsVoided = 0 AND RTRIM(p.LineName) IN ${LINES}
      AND fs.DateKey >= @startKey AND fs.DateKey <= @endKey`;

const CUSTOMERS_QUERY = `
    SELECT RTRIM(cur.CustomerCode) AS Code, MAX(cur.CustomerName) AS Name,
           MAX(RTRIM(cur.ErpSegmentCode)) AS TypeCode, MAX(sg.SegmentName) AS TypeName,
           MAX(CASE WHEN z.IsRoute = 1 THEN z.RouteNumber END) AS RouteNumber,
           MAX(CASE WHEN z.IsRoute = 1 THEN z.ZoneName END) AS RouteName,
           MIN(fs.DateKey) AS FirstKey, SUM(fs.QuantitySold) AS Units
    ${fromSales(`LEFT JOIN dim.Dim_Segment sg ON sg.ErpSegmentCode = cur.ErpSegmentCode
    LEFT JOIN dim.Dim_Zone z ON z.ZoneCode = cur.ZoneCode`)}
    GROUP BY RTRIM(cur.CustomerCode)
    HAVING SUM(fs.QuantitySold) > 0`;

const PRODUCTS_QUERY = `
    SELECT RTRIM(cur.CustomerCode) AS CustomerCode, RTRIM(p.ProductCode) AS ProductCode,
           MAX(ISNULL(p.ProductName, p.ProductCode)) AS ProductName,
           SUM(fs.QuantitySold) AS Units,
           SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS UsdNet,
           SUM(CASE WHEN fx.RateSell > 0 THEN fs.QuantitySold ELSE 0 END) AS UsdUnits
    ${fromSales()}
    GROUP BY RTRIM(cur.CustomerCode), RTRIM(p.ProductCode)`;

const nullableNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const nullableStr = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).trim() || null);

export async function fetchProspectBase(
  pool: sql.ConnectionPool,
  w: { startKey: number; endKey: number },
): Promise<{ customers: BaseCustomer[]; products: ProductRow[] }> {
  const run = (text: string) => pool.request().input('startKey', w.startKey).input('endKey', w.endKey).query(text);
  const [cust, prod] = await Promise.all([run(CUSTOMERS_QUERY), run(PRODUCTS_QUERY)]);
  return {
    customers: cust.recordset.map((r: Record<string, unknown>) => ({
      code: String(r.Code).trim(),
      name: String(r.Name ?? r.Code).trim(),
      typeCode: nullableStr(r.TypeCode),
      typeName: nullableStr(r.TypeName),
      routeNumber: nullableNum(r.RouteNumber),
      routeName: nullableStr(r.RouteName),
      firstKey: nullableNum(r.FirstKey),
      units: Number(r.Units ?? 0),
    })),
    products: prod.recordset.map((r: Record<string, unknown>) => ({
      customerCode: String(r.CustomerCode).trim(),
      productCode: String(r.ProductCode).trim(),
      productName: String(r.ProductName ?? r.ProductCode).trim(),
      units: Number(r.Units ?? 0),
      usdNet: nullableNum(r.UsdNet),
      usdUnits: Number(r.UsdUnits ?? 0),
    })),
  };
}
