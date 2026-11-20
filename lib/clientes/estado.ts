// Customer taxonomy, axis 2: the Estado of a customer in the selected period P against the previous equal
// period P-1 (Origen, axis 1, is customerKindInYear in lib/dwh/cutover.ts). Pure, no I/O. Date keys are
// YYYYMMDD integers like Dim_Date.DateKey.
export type Estado = 'nuevo_periodo' | 'retenido' | 'recuperado' | 'enfriado' | 'perdido' | 'sin_ventas';

export interface EstadoInput {
  firstInvoiceKey: number | null;   // first invoice ever (null = never invoiced)
  lastInvoiceKey: number | null;    // last invoice on or before the period end
  boughtInPeriod: boolean;
  boughtInPrev: boolean;
  visitIntervalDays: number | null; // 7 / 15 / 30; null = no visit frequency
  periodStartKey: number;
  periodEndKey: number;
  todayKey: number;
}

const DAY_MS = 86_400_000;

function keyToUtc(key: number): number {
  return Date.UTC(Math.floor(key / 10000), Math.floor((key % 10000) / 100) - 1, key % 100);
}

export function daysBetweenKeys(fromKey: number, toKey: number): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / DAY_MS);
}

// A customer that bought in P-1 and not in P is "enfriado"; it becomes "perdido" when it has been silent for
// more than 3 visit windows, measured from its last invoice to the period end (or to today while the period is
// still open). Without a visit frequency there is no window to judge by, so it stays enfriado.
// Returns null for a customer that is silent in both periods (not part of the P-1 -> P bridge).
export function classifyEstado(i: EstadoInput): Estado | null {
  if (i.firstInvoiceKey === null) return 'sin_ventas';
  if (i.boughtInPeriod) {
    if (i.firstInvoiceKey >= i.periodStartKey && i.firstInvoiceKey <= i.periodEndKey) return 'nuevo_periodo';
    return i.boughtInPrev ? 'retenido' : 'recuperado';
  }
  if (!i.boughtInPrev) return null;
  if (i.visitIntervalDays !== null && i.lastInvoiceKey !== null) {
    const asOf = Math.min(i.todayKey, i.periodEndKey);
    if (daysBetweenKeys(i.lastInvoiceKey, asOf) > 3 * i.visitIntervalDays) return 'perdido';
  }
  return 'enfriado';
}

export interface Bridge {
  base: number;        // bought in P-1: retenido + enfriado + perdido
  enfriados: number;
  perdidos: number;
  nuevos: number;
  recuperados: number;
  actual: number;      // bought in P: retenido + nuevo_periodo + recuperado
}

export function buildBridge(estados: readonly (Estado | null)[]): Bridge {
  const n = (e: Estado) => estados.filter(x => x === e).length;
  const retenidos = n('retenido');
  const enfriados = n('enfriado');
  const perdidos = n('perdido');
  const nuevos = n('nuevo_periodo');
  const recuperados = n('recuperado');
  return { base: retenidos + enfriados + perdidos, enfriados, perdidos, nuevos, recuperados, actual: retenidos + nuevos + recuperados };
}
