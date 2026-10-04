import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { usdConversionJoin, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { buildXlsx } from '@/lib/xlsx';
import {
  LAPSED_AFTER_DAYS, averageOverInvoicedMonths, classifyCoverage, compareDaysSince, filterCobertura,
  trailingWindowStartKey, type CoberturaStatus,
} from '@/app/(app)/analitica/lib/cobertura';
import type { CoberturaResponse, CoberturaRowView } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// One row per CURRENT customer version. Sales are keyed by CustomerKey, which
// may point at an older SCD2 version of the same code, so every sales
// aggregate groups by RTRIM(CustomerCode) across all versions.
function customersQuery(includeInactive: boolean): string {
  return `
    WITH Cur AS (
      SELECT RTRIM(c.CustomerCode) AS Code, c.CustomerName, RTRIM(c.DefaultSalesRepCode) AS SellerCode, c.LegalEntityKey
      FROM dim.Dim_Customer c
      WHERE c.IsCurrent = 1 ${includeInactive ? '' : 'AND c.IsInactive = 0'}
    ),
    OwnSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode)
    ),
    EntitySales AS (
      SELECT c.LegalEntityKey, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey IS NOT NULL
      GROUP BY c.LegalEntityKey
    )
    SELECT cur.Code AS CustomerCode, cur.CustomerName, le.LegalEntityName, cur.SellerCode,
           r.SalesRepName AS SellerName, o.LastDateKey, e.LastDateKey AS EntityLastDateKey
    FROM Cur cur
    LEFT JOIN OwnSales o ON o.Code = cur.Code
    LEFT JOIN EntitySales e ON e.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN dim.Dim_SalesRep r ON RTRIM(r.SalesRepCode) = cur.SellerCode
  `;
}

const MONTHLY_QUERY = `
  SELECT RTRIM(c.CustomerCode) AS Code, d.YearMonth,
         SUM(fs.QuantitySold) AS Units,
         SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS Usd
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 AND fs.DateKey >= @windowStartKey
  GROUP BY RTRIM(c.CustomerCode), d.YearMonth
`;

function dateKeyOf(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

const STATUS_LABEL: Record<CoberturaStatus, string> = {
  never: 'Nunca vendido',
  via_matriz: 'Vende vía matriz',
  lapsed: `Sin ventas en ${LAPSED_AFTER_DAYS}+ días`,
  active: 'Activo',
};

function isStatus(v: string | null): v is CoberturaStatus {
  return v === 'never' || v === 'via_matriz' || v === 'lapsed' || v === 'active';
}

function formatKey(key: number | null): string {
  if (key === null) return 'Sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === '1';
  const format = searchParams.get('format');
  const statusParam = searchParams.get('status');

  try {
    const pool = await getDwhPool();
    const now = new Date();
    const todayKey = dateKeyOf(now);
    const windowStartKey = trailingWindowStartKey(now);

    const [customers, monthly] = await Promise.all([
      pool.request().query(customersQuery(includeInactive)),
      pool.request().input('windowStartKey', windowStartKey).query(MONTHLY_QUERY),
    ]);

    const monthsByCode = new Map<string, { units: number; usd: number | null }[]>();
    for (const m of monthly.recordset) {
      const list = monthsByCode.get(m.Code) ?? [];
      list.push({ units: Number(m.Units ?? 0), usd: m.Usd === null ? null : Number(m.Usd) });
      monthsByCode.set(m.Code, list);
    }

    const rows: CoberturaRowView[] = customers.recordset.map(r => {
      const lastSaleDateKey = r.LastDateKey === null ? null : Number(r.LastDateKey);
      const entityLastSaleDateKey = r.EntityLastDateKey === null ? null : Number(r.EntityLastDateKey);
      const { status, daysSinceLastSale } = classifyCoverage(lastSaleDateKey, entityLastSaleDateKey, todayKey);
      const avg = averageOverInvoicedMonths(monthsByCode.get(r.CustomerCode) ?? []);
      return {
        customerCode: r.CustomerCode,
        customerName: (r.CustomerName ?? r.CustomerCode).trim(),
        entityName: r.LegalEntityName ? String(r.LegalEntityName).trim() : null,
        sellerCode: r.SellerCode ? String(r.SellerCode) : null,
        sellerName: r.SellerName ? String(r.SellerName).trim() : null,
        lastSaleDateKey,
        entityLastSaleDateKey,
        daysSinceLastSale,
        avgMonthlyUsd: avg?.avgUsd ?? null,
        avgMonthlyUnits: avg?.avgUnits ?? null,
        monthsWithSales: avg?.months ?? 0,
        status,
      };
    });
    rows.sort((a, b) => compareDaysSince(a, b, 'asc'));

    if (format === 'xlsx') {
      const filtered = filterCobertura(rows, {
        sellerCode: searchParams.get('seller'),
        status: isStatus(statusParam) ? statusParam : null,
      });
      const columns = [
        { key: 'cliente', label: 'Cliente', defaultVisible: true, defaultOrder: 0 },
        { key: 'codigo', label: 'Código', defaultVisible: true, defaultOrder: 1 },
        { key: 'entidad', label: 'Entidad', defaultVisible: true, defaultOrder: 2 },
        { key: 'vendedor', label: 'Vendedor', defaultVisible: true, defaultOrder: 3 },
        { key: 'ultimaVenta', label: 'Última venta', defaultVisible: true, defaultOrder: 4 },
        { key: 'dias', label: 'Días sin vender', defaultVisible: true, defaultOrder: 5, type: 'number' as const },
        { key: 'usdMes', label: 'USD/mes (prom. 12m)', defaultVisible: true, defaultOrder: 6, type: 'number' as const },
        { key: 'unidadesMes', label: 'Unidades/mes (prom. 12m)', defaultVisible: true, defaultOrder: 7, type: 'number' as const },
        { key: 'estado', label: 'Estado', defaultVisible: true, defaultOrder: 8 },
      ];
      const data = filtered.map(r => ({
        cliente: r.customerName,
        codigo: r.customerCode,
        entidad: r.entityName ?? 'Sin datos',
        vendedor: r.sellerName ?? 'Sin vendedor',
        ultimaVenta: r.lastSaleDateKey === null
          ? (r.status === 'via_matriz' ? `Sin datos (matriz: ${formatKey(r.entityLastSaleDateKey)})` : 'Sin datos')
          : formatKey(r.lastSaleDateKey),
        dias: r.daysSinceLastSale ?? 'Sin datos',
        usdMes: r.avgMonthlyUsd === null ? 'Sin datos' : Math.round(r.avgMonthlyUsd * 100) / 100,
        unidadesMes: r.avgMonthlyUnits === null ? 'Sin datos' : Math.round(r.avgMonthlyUnits * 100) / 100,
        estado: STATUS_LABEL[r.status],
      }));
      const buffer = buildXlsx(columns, data);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="cobertura-clientes-${todayKey}.xlsx"`,
        },
      });
    }

    const response: CoberturaResponse = {
      rows, asOfDateKey: todayKey, windowStartDateKey: windowStartKey, lapsedAfterDays: LAPSED_AFTER_DAYS,
    };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
