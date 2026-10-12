import sql from 'mssql';
import { dualAmountExpr, usdConversionJoin } from '@/app/api/dwh/lib/query-builder';
import type { GroupShareRaw } from './group-share';

// dateWhere comes from buildDateWhereClause(range, 'fs'); every user-controlled value is bound with .input().
const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';

export type ProductosLevel = 'linea' | 'sublinea' | 'sku';

export function parseCategoria(raw: string | null): string | null {
  const v = raw?.trim();
  return v && v.length <= 60 ? v : null;
}

export interface GroupShareQueryOptions {
  dateWhere: string;
  level: ProductosLevel;
  linea: string | null;
  sublinea: string | null;
  tiendaKey: number | null;
  categoria: string | null;
}

function labelExpr(level: ProductosLevel): string {
  if (level === 'sku') return 'ISNULL(p.ProductName, p.ProductCode)';
  if (level === 'sublinea') return `ISNULL(p.SubLineName, '${NO_SUBLINEA}')`;
  return `ISNULL(p.LineName, '${NO_LINEA}')`;
}

// Every invoice is attributed to the customer's CURRENT group: the invoice's (possibly old SCD2)
// Dim_Customer row is resolved by CustomerCode to the IsCurrent = 1 row.
export async function fetchGroupShare(pool: sql.ConnectionPool, o: GroupShareQueryOptions): Promise<GroupShareRaw[]> {
  if (o.level !== 'linea' && o.linea === null) throw new Error('linea requerida para este nivel');
  if (o.level === 'sku' && o.sublinea === null) throw new Error('sublinea requerida para este nivel');
  const scope = [
    o.level !== 'linea' ? `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea` : '',
    o.level === 'sku' ? `AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea` : '',
    o.tiendaKey !== null ? 'AND fs.CustomerKey = @tiendaKey' : '',
    o.categoria !== null ? 'AND p.CategoryName = @categoria' : '',
  ].join(' ');
  const req = pool.request();
  if (o.level !== 'linea') req.input('linea', o.linea);
  if (o.level === 'sku') req.input('sublinea', o.sublinea);
  if (o.tiendaKey !== null) req.input('tiendaKey', o.tiendaKey);
  if (o.categoria !== null) req.input('categoria', o.categoria);
  const label = labelExpr(o.level);
  const result = await req.query(`
    SELECT ${label} AS Label, RTRIM(cur.ErpSegmentCode) AS GroupCode, sg.SegmentName AS GroupName,
           ${dualAmountExpr('fs', 'NetAmount', 'SalesBs', 'SalesUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1
    LEFT JOIN dim.Dim_Segment sg ON sg.ErpSegmentCode = cur.ErpSegmentCode
    WHERE fs.IsVoided = 0 ${o.dateWhere} ${scope}
    GROUP BY ${label}, RTRIM(cur.ErpSegmentCode), sg.SegmentName
  `);
  return result.recordset.map(r => ({
    label: String(r.Label),
    groupCode: r.GroupCode ? String(r.GroupCode).trim() || null : null,
    groupName: r.GroupName ? String(r.GroupName).trim() : null,
    salesBs: Number(r.SalesBs ?? 0),
    salesUsd: r.SalesUsd === null || r.SalesUsd === undefined ? null : Number(r.SalesUsd),
  }));
}

export async function fetchCategorias(pool: sql.ConnectionPool): Promise<string[]> {
  const result = await pool.request().query(`
    SELECT DISTINCT RTRIM(p.CategoryName) AS Name
    FROM dim.Dim_Product p
    WHERE p.IsCurrent = 1 AND p.CategoryName IS NOT NULL AND LTRIM(RTRIM(p.CategoryName)) <> ''
    ORDER BY Name
  `);
  return result.recordset.map(r => String(r.Name));
}
