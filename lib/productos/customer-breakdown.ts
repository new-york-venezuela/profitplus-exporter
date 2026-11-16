import { subtractDual, sumDual } from '@/app/(app)/analitica/lib/net-sales';
import type { ClienteRow, Currency, DualAmount } from '@/app/(app)/analitica/types';
import { RETURN_RATE_WARN } from './thresholds';

export type { ClienteRow };

/** Overdue history window: the last N months ending today, independent of the selected range. */
export const OVERDUE_LOOKBACK_MONTHS = 12;
/** Fewer distinct order days than this -> "Sin historial" (overdue null). */
export const OVERDUE_MIN_ORDERS = 3;
/** Overdue when days since the last order exceed this multiple of the average gap. */
export const OVERDUE_FACTOR = 2;
/** Return-rate warning marker: client rate above this multiple of the item's own rate. */
export const RETURN_WARN_MULTIPLE = 2;

export interface ClienteRaw {
  id: string;
  name: string;
  groupCode: string | null;
  groupName: string | null;
  posItem: number;
  posTotal: number;
  gross: DualAmount;
  returns: DualAmount;
  units: number;
  orders: number;
  firstOrderKey: number | null;
  lastOrderKey: number | null;
}

const MS_DAY = 86_400_000;

/** YYYYMMDD -> UTC day number. */
function dayNumber(key: number): number {
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  const d = key % 100;
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}

function isoDate(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function buildClienteBreakdown(
  raw: ClienteRaw[], opts: { currency: Currency; todayKey: number },
): { rows: ClienteRow[]; itemNet: DualAmount; itemReturnRate: number | null; top3SharePct: number | null } {
  const valueOf = (d: DualAmount): number | null => (opts.currency === 'usd' ? d.usd : d.bs);
  const nets = raw.map(r => subtractDual(r.gross, r.returns));
  const itemNet = sumDual(nets) ?? { bs: 0, usd: 0 };
  const itemGrossBs = raw.reduce((s, r) => s + r.gross.bs, 0);
  const itemReturnsBs = raw.reduce((s, r) => s + r.returns.bs, 0);
  const itemReturnRate = itemGrossBs > 0 ? itemReturnsBs / itemGrossBs : null;
  const itemValue = valueOf(itemNet);
  const today = dayNumber(opts.todayKey);

  const rows: ClienteRow[] = raw.map((r, i) => {
    const net = nets[i];
    const v = valueOf(net);
    const returnRate = r.gross.bs > 0 ? r.returns.bs / r.gross.bs : null;
    const last = r.lastOrderKey;
    const first = r.firstOrderKey;
    const span = last !== null && first !== null ? dayNumber(last) - dayNumber(first) : null;
    const avgGapDays = span !== null && r.orders >= 2 ? span / (r.orders - 1) : null;
    const daysSinceLastOrder = last !== null ? today - dayNumber(last) : null;
    const overdue = r.orders >= OVERDUE_MIN_ORDERS && avgGapDays !== null && avgGapDays > 0 && daysSinceLastOrder !== null
      ? daysSinceLastOrder > OVERDUE_FACTOR * avgGapDays
      : null;
    return {
      id: r.id,
      name: r.name,
      group: r.groupCode !== null && r.groupName !== null ? { code: r.groupCode, name: r.groupName } : null,
      posItem: r.posItem,
      posTotal: r.posTotal,
      net,
      sharePct: v !== null && itemValue !== null && itemValue > 0 ? v / itemValue : null,
      units: r.units,
      avgPrice: r.units > 0
        ? { bs: r.gross.bs / r.units, usd: r.gross.usd === null ? null : r.gross.usd / r.units }
        : { bs: 0, usd: r.gross.usd === null ? null : 0 },
      returnRate,
      returnWarn: returnRate !== null && itemReturnRate !== null && itemReturnRate > 0 && returnRate > RETURN_WARN_MULTIPLE * itemReturnRate,
      highReturn: returnRate !== null && returnRate > RETURN_RATE_WARN,
      orders: r.orders,
      lastOrderDate: last !== null ? isoDate(last) : null,
      daysSinceLastOrder,
      avgGapDays,
      overdue,
    };
  });

  rows.sort((a, b) => {
    const av = valueOf(a.net); const bv = valueOf(b.net);
    if (av === null && bv === null) return a.id.localeCompare(b.id);
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av || a.id.localeCompare(b.id);
  });

  let top3SharePct: number | null = null;
  if (itemValue !== null && itemValue > 0) {
    const top = rows.map(r => valueOf(r.net)).filter((v): v is number => v !== null && v > 0).slice(0, 3);
    top3SharePct = top.reduce((s, v) => s + v, 0) / itemValue;
  }
  return { rows, itemNet, itemReturnRate, top3SharePct };
}
