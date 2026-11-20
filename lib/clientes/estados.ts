import type { CustomerKind } from '@/lib/dwh/cutover';
import type { CoberturaResponse, DualAmount } from '@/app/(app)/analitica/types';
import { buildBridge, classifyEstado, type Bridge, type Estado } from './estado';

// Estado per customer, derived from the Cobertura rows (one row per current customer code): the Cobertura table
// and every Estado count therefore share one population and always reconcile.
export interface EstadoRow {
  customerCode: string;
  customerName: string;
  entityName: string | null;
  sellerName: string | null;
  routeNumber: number | null;
  groupName: string | null;
  origen: CustomerKind | null;
  estado: Estado;
  lastSaleDateKey: number | null;
  reasonDateKey: number | null; // nuevo: first invoice; enfriado / perdido: last invoice; otherwise null
  salesPeriod: DualAmount;
  salesPrev: DualAmount | null;
}

export interface EstadosResult {
  available: boolean; // false = no previous equal period: only nuevo_periodo and sin_ventas can be told
  referenceYear: number;
  rows: EstadoRow[];
  bridge: Bridge;
}

export function buildEstados(resp: CoberturaResponse): EstadosResult {
  const rows: EstadoRow[] = [];
  for (const r of resp.rows) {
    const boughtInPeriod = r.activeInPeriod === true;
    const estado = classifyEstado({
      firstInvoiceKey: r.firstSaleDateKey,
      lastInvoiceKey: r.lastSaleAtPeriodEndKey,
      boughtInPeriod,
      boughtInPrev: r.boughtPrev === true,
      visitIntervalDays: r.visit.intervalDays,
      periodStartKey: resp.periodStartDateKey,
      periodEndKey: resp.periodEndDateKey,
      todayKey: resp.asOfDateKey,
    });
    if (estado === null) continue;
    if (!resp.prevPeriodAvailable && estado !== 'nuevo_periodo' && estado !== 'sin_ventas') continue;
    // A customer registered after the range end cannot have been "sin ventas" in it.
    if (estado === 'sin_ventas' && r.activeInPeriod === null) continue;
    rows.push({
      customerCode: r.customerCode,
      customerName: r.customerName,
      entityName: r.entityName,
      sellerName: r.sellerName,
      routeNumber: r.routeNumber,
      groupName: r.groupName,
      origen: r.kind,
      estado,
      lastSaleDateKey: r.lastSaleDateKey,
      reasonDateKey: estado === 'nuevo_periodo' ? r.firstSaleDateKey : estado === 'enfriado' || estado === 'perdido' ? r.lastSaleAtPeriodEndKey : null,
      salesPeriod: r.salesPeriod,
      salesPrev: r.salesPrev,
    });
  }
  return { available: resp.prevPeriodAvailable, referenceYear: resp.kindYear, rows, bridge: buildBridge(rows.map(x => x.estado)) };
}
