import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { localDateKey } from '@/lib/local-date';
import { buildDateWhereClause, buildPrevPeriodDateWhereClause, jsonWithCache, rangeEndDateKey } from '@/app/api/dwh/lib/query-builder';
import { COBERTURA_MONTHLY_QUERY, COBERTURA_RECENT_DAYS_QUERY, coberturaCustomersQuery } from '@/lib/clientes/cobertura-sql';
import { parseCarteraScope } from '@/lib/clientes/scope';
import { buildXlsx } from '@/lib/xlsx';
import {
  LAPSED_AFTER_DAYS, averageOverInvoicedMonths, classifyCoverage, compareDaysSince, daysBetweenKeys, filterCobertura,
  trailingWindowStartKey, type CoberturaStatus,
} from '@/app/(app)/analitica/lib/cobertura';
import { KIND_LABEL, enrichCartera, periodActivity, visitLabel } from '@/app/(app)/analitica/lib/cartera';
import { STICKINESS_LABEL, STICKINESS_ORDER, classifyStickiness, type Stickiness } from '@/app/(app)/analitica/lib/kind-kpis';
import type { CoberturaResponse, CoberturaRowView } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

function dateKeyOf(d: Date): number {
  return localDateKey(d);   // host calendar day, not UTC: days-since-last-sale and the visit windows must not run a day ahead at night
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

const isoOf = (v: unknown): string => new Date(v as string | Date).toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === '1';
  const format = searchParams.get('format');
  const statusParam = searchParams.get('status');
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const visitParam = searchParams.get('visit');

  try {
    const pool = await getDwhPool();
    const now = new Date();
    const todayKey = dateKeyOf(now);
    const windowStartKey = trailingWindowStartKey(now);
    const periodEndKey = rangeEndDateKey(dateRange, now);
    const kindYear = Math.floor(periodEndKey / 10000);
    const periodWhere = buildDateWhereClause(dateRange, 'fs');

    const prevWhere = buildPrevPeriodDateWhereClause(dateRange, 'fs');
    const recentStartKey = dateKeyOf(new Date(now.getTime() - 90 * 86_400_000));

    const [customers, monthly, recent] = await Promise.all([
      pool.request().query(coberturaCustomersQuery(includeInactive, periodWhere, prevWhere)),
      pool.request().input('windowStartKey', windowStartKey).query(COBERTURA_MONTHLY_QUERY),
      pool.request().input('recentStartKey', recentStartKey).query(COBERTURA_RECENT_DAYS_QUERY),
    ]);

    const recentByCode = new Map<string, number[]>();
    for (const x of recent.recordset) {
      const list = recentByCode.get(x.Code) ?? [];
      list.push(Number(x.DateKey));
      recentByCode.set(x.Code, list);
    }

    const monthsByCode = new Map<string, { units: number; usd: number | null }[]>();
    for (const m of monthly.recordset) {
      const list = monthsByCode.get(m.Code) ?? [];
      list.push({ units: Number(m.Units ?? 0), usd: m.Usd === null ? null : Number(m.Usd) });
      monthsByCode.set(m.Code, list);
    }

    const rows: CoberturaRowView[] = customers.recordset.map(r => {
      const lastSaleDateKey = r.LastDateKey === null || r.LastDateKey === undefined ? null : Number(r.LastDateKey);
      const entityLastSaleDateKey = r.EntityLastDateKey === null || r.EntityLastDateKey === undefined ? null : Number(r.EntityLastDateKey);
      const { status, daysSinceLastSale } = classifyCoverage(lastSaleDateKey, entityLastSaleDateKey, todayKey);
      const avg = averageOverInvoicedMonths(monthsByCode.get(r.CustomerCode) ?? []);
      const registeredDate = r.RegisteredDate ? isoOf(r.RegisteredDate) : null;
      const { visit, kind } = enrichCartera({
        lastSaleDateKey,
        visitIntervalDays: r.VisitIntervalDays === null || r.VisitIntervalDays === undefined ? null : Number(r.VisitIntervalDays),
        registeredDate,
        todayKey,
        kindYear,
      });
      const intervalDays = r.VisitIntervalDays === null || r.VisitIntervalDays === undefined ? null : Number(r.VisitIntervalDays);
      const firstSaleDateKey = r.FirstDateKey === null || r.FirstDateKey === undefined ? null : Number(r.FirstDateKey);
      const daysToFirstSale = firstSaleDateKey !== null && registeredDate
        ? Math.max(0, daysBetweenKeys(Number(registeredDate.replace(/-/g, '')), firstSaleDateKey))
        : null;
      const dual = (bs: unknown, usd: unknown) => (bs === null || bs === undefined
        ? { bs: 0, usd: 0 }
        : { bs: Number(bs), usd: usd === null || usd === undefined ? null : Number(usd) });
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
        routeNumber: r.RouteNumber === null || r.RouteNumber === undefined ? null : Number(r.RouteNumber),
        groupCode: r.GroupCode ? String(r.GroupCode).trim() : null,
        groupName: r.GroupName ? String(r.GroupName).trim() : null,
        kind,
        visit,
        activeInPeriod: periodActivity({ inPeriod: Number(r.InPeriod) === 1, registeredDate, periodEndKey }),
        registeredDate,
        firstSaleDateKey,
        daysToFirstSale,
        salesPeriod: dual(r.PeriodBs, r.PeriodUsd),
        salesPrev: prevWhere ? dual(r.PrevBs, r.PrevUsd) : null,
        boughtPrev: prevWhere ? Number(r.InPrev) === 1 : null,
        stickiness: classifyStickiness({ intervalDays, registeredDate, recentSaleDateKeys: recentByCode.get(r.CustomerCode) ?? [], todayKey }),
      };
    });
    rows.sort((a, b) => compareDaysSince(a, b, 'asc'));

    if (format === 'xlsx') {
      const filtered = filterCobertura(rows, {
        sellerCode: searchParams.get('seller'),
        status: isStatus(statusParam) ? statusParam : null,
        // Same grupo/ruta parser as /api/dwh/clientes: trimmed, malformed = no filter.
        ...parseCarteraScope(searchParams),
        visit: visitParam === 'overdue' || visitParam === 'no_interval' ? visitParam : null,
        inactiveInPeriod: searchParams.get('inactive') === '1',
        kind: searchParams.get('kind') === 'patrimonio' || searchParams.get('kind') === 'nuevo' ? (searchParams.get('kind') as 'patrimonio' | 'nuevo') : null,
        cooled: searchParams.get('cooled') === '1',
        stickiness: STICKINESS_ORDER.includes(searchParams.get('stickiness') as Stickiness) ? searchParams.get('stickiness') : null,
      });
      const columns = [
        { key: 'cliente', label: 'Cliente', defaultVisible: true, defaultOrder: 0 },
        { key: 'codigo', label: 'Código', defaultVisible: true, defaultOrder: 1 },
        { key: 'entidad', label: 'Entidad', defaultVisible: true, defaultOrder: 2 },
        { key: 'vendedor', label: 'Vendedor', defaultVisible: true, defaultOrder: 3 },
        { key: 'ruta', label: 'Ruta', defaultVisible: true, defaultOrder: 4 },
        { key: 'grupo', label: 'Grupo', defaultVisible: true, defaultOrder: 5 },
        { key: 'tipo', label: 'Tipo', defaultVisible: true, defaultOrder: 6 },
        { key: 'ultimaVenta', label: 'Última venta', defaultVisible: true, defaultOrder: 7 },
        { key: 'dias', label: 'Días sin vender', defaultVisible: true, defaultOrder: 8, type: 'number' as const },
        { key: 'visita', label: 'Visita', defaultVisible: true, defaultOrder: 9 },
        { key: 'periodo', label: 'Compró en el período', defaultVisible: true, defaultOrder: 10 },
        { key: 'usdMes', label: 'USD/mes (prom. 12m)', defaultVisible: true, defaultOrder: 11, type: 'number' as const },
        { key: 'unidadesMes', label: 'Unidades/mes (prom. 12m)', defaultVisible: true, defaultOrder: 12, type: 'number' as const },
        { key: 'estado', label: 'Estado', defaultVisible: true, defaultOrder: 13 },
        { key: 'registro', label: 'Registro', defaultVisible: true, defaultOrder: 14 },
        { key: 'ventasPeriodo', label: 'Ventas del período (USD)', defaultVisible: true, defaultOrder: 15, type: 'number' as const },
        { key: 'constancia', label: 'Constancia (últimas 3 visitas)', defaultVisible: true, defaultOrder: 16 },
      ];
      const data = filtered.map(r => ({
        cliente: r.customerName,
        codigo: r.customerCode,
        entidad: r.entityName ?? 'Sin datos',
        vendedor: r.sellerName ?? 'Sin vendedor',
        ruta: r.routeNumber === null ? 'Sin ruta' : `Ruta ${r.routeNumber}`,
        grupo: r.groupName ?? 'Sin grupo',
        tipo: r.kind === null ? 'Sin fecha de registro' : KIND_LABEL[r.kind],
        ultimaVenta: r.lastSaleDateKey === null
          ? (r.status === 'via_matriz' ? `Sin datos (matriz: ${formatKey(r.entityLastSaleDateKey)})` : 'Sin datos')
          : formatKey(r.lastSaleDateKey),
        dias: r.daysSinceLastSale ?? 'Sin datos',
        visita: visitLabel(r.visit),
        periodo: r.activeInPeriod === null ? 'No aplica (registrado después)' : r.activeInPeriod ? 'Sí' : 'No',
        usdMes: r.avgMonthlyUsd === null ? 'Sin datos' : Math.round(r.avgMonthlyUsd * 100) / 100,
        unidadesMes: r.avgMonthlyUnits === null ? 'Sin datos' : Math.round(r.avgMonthlyUnits * 100) / 100,
        estado: STATUS_LABEL[r.status],
        registro: r.registeredDate ?? 'Sin datos',
        ventasPeriodo: r.salesPeriod.usd === null ? 'Sin datos' : Math.round(r.salesPeriod.usd * 100) / 100,
        constancia: STICKINESS_LABEL[r.stickiness],
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
      rows, asOfDateKey: todayKey, windowStartDateKey: windowStartKey, lapsedAfterDays: LAPSED_AFTER_DAYS, kindYear,
      prevPeriodAvailable: prevWhere !== null,
    };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
