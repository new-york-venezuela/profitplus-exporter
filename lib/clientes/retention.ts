import type { Currency, DualAmount } from '@/app/(app)/analitica/types';
import type { EstadoRow } from './estados';
import type { Estado } from './estado';

export const ESTADO_ORDER: Estado[] = ['nuevo_periodo', 'retenido', 'recuperado', 'enfriado', 'perdido', 'sin_ventas'];

// Sum in the active currency; one unknown part (null USD, no previous period) makes the sum unknown, never partial.
function sum(rows: readonly EstadoRow[], pick: (r: EstadoRow) => DualAmount | null, currency: Currency): number | null {
  let total = 0;
  for (const r of rows) {
    const a = pick(r);
    const v = a === null ? null : currency === 'usd' ? a.usd : a.bs;
    if (v === null) return null;
    total += v;
  }
  return total;
}

export interface EstadoLine {
  estado: Estado;
  patrimonio: number;       // customers with origen patrimonio
  nuevo: number;            // customers with origen nuevo ('posterior' customers are only in the total)
  total: number;
  sales: number | null;     // ventas brutas in the period
  salesPrev: number | null; // ventas brutas in the previous equal period
}

export function estadoMatrix(rows: readonly EstadoRow[], currency: Currency): EstadoLine[] {
  return ESTADO_ORDER.map(estado => {
    const mine = rows.filter(r => r.estado === estado);
    return {
      estado,
      patrimonio: mine.filter(r => r.origen === 'patrimonio').length,
      nuevo: mine.filter(r => r.origen === 'nuevo').length,
      total: mine.length,
      sales: sum(mine, r => r.salesPeriod, currency),
      salesPrev: sum(mine, r => r.salesPrev, currency),
    };
  });
}

export interface SalesBridge {
  previous: number | null;        // sales of the previous period
  lost: number | null;            // negative: what enfriados and perdidos bought then
  retainedChange: number | null;  // retenidos: now minus then
  nuevos: number | null;
  recuperados: number | null;
  actual: number | null;          // sales of the period = previous + lost + retainedChange + nuevos + recuperados
}

export function salesBridge(rows: readonly EstadoRow[], currency: Currency): SalesBridge {
  const of = (...estados: Estado[]) => rows.filter(r => estados.includes(r.estado));
  const lostPrev = sum(of('enfriado', 'perdido'), r => r.salesPrev, currency);
  const retNow = sum(of('retenido'), r => r.salesPeriod, currency);
  const retPrev = sum(of('retenido'), r => r.salesPrev, currency);
  return {
    previous: sum(rows, r => r.salesPrev, currency),
    lost: lostPrev === null ? null : -lostPrev,
    retainedChange: retNow === null || retPrev === null ? null : retNow - retPrev,
    nuevos: sum(of('nuevo_periodo'), r => r.salesPeriod, currency),
    recuperados: sum(of('recuperado'), r => r.salesPeriod, currency),
    actual: sum(of('retenido', 'nuevo_periodo', 'recuperado'), r => r.salesPeriod, currency),
  };
}
