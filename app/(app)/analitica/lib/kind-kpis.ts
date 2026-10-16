import type { CustomerKind } from '@/lib/dwh/cutover';
import type { Currency, DualAmount } from '../types';
import { daysBetweenKeys, type CoberturaStatus } from './cobertura';

// Pure KPI maths for the Clientes tab's nuevos-vs-patrimonio panels (spec:
// docs/superpowers/specs/2026-10-15-clientes-nuevos-vs-patrimonio-design.md). Shared by the cobertura route and the client.

export type Stickiness = 'constante' | 'irregular' | 'perdido' | 'observacion' | 'sin_frecuencia';
export const STICKINESS_ORDER: Stickiness[] = ['constante', 'irregular', 'perdido', 'observacion', 'sin_frecuencia'];
export const STICKINESS_LABEL: Record<Stickiness, string> = {
  constante: 'Constante',
  irregular: 'Irregular',
  perdido: 'Perdido',
  observacion: 'En observación',
  sin_frecuencia: 'Sin frecuencia',
};
export const STICKY_WINDOWS = 3;

// The customer's last 3 visit windows of `intervalDays` days each, ending today: window i holds invoices whose age in days
// d satisfies i*N <= d < (i+1)*N. constante = all met, irregular = some, perdido = none (nothing sold in 3 intervals).
export function classifyStickiness(input: {
  intervalDays: number | null;
  registeredDate: string | null;
  recentSaleDateKeys: readonly number[];
  todayKey: number;
}): Stickiness {
  const n = input.intervalDays;
  if (n === null || !(n > 0)) return 'sin_frecuencia';
  if (input.registeredDate && /^\d{4}-\d{2}-\d{2}$/.test(input.registeredDate)) {
    const age = daysBetweenKeys(Number(input.registeredDate.replace(/-/g, '')), input.todayKey);
    if (age < STICKY_WINDOWS * n) return 'observacion';
  }
  const met = new Set<number>();
  for (const key of input.recentSaleDateKeys) {
    const age = daysBetweenKeys(key, input.todayKey);
    if (age < 0 || age >= STICKY_WINDOWS * n) continue;
    met.add(Math.floor(age / n));
  }
  return met.size === STICKY_WINDOWS ? 'constante' : met.size > 0 ? 'irregular' : 'perdido';
}

export interface KindRow {
  kind: CustomerKind | null;
  activeInPeriod: boolean | null;     // null = registered after the range end
  boughtPrev: boolean | null;         // bought in the previous period; null = no previous window
  salesPeriod: DualAmount;
  salesPrev: DualAmount | null;
  status: CoberturaStatus;
  visit: { status: string };
  stickiness: Stickiness;
  lastSaleDateKey: number | null;
  daysToFirstSale: number | null;
}

export type KindFilter = 'todos' | 'patrimonio' | 'nuevo';

const sumDual = (items: readonly DualAmount[]): DualAmount => {
  const withUsd = items.filter(i => i.usd !== null);
  return {
    bs: items.reduce((s, i) => s + i.bs, 0),
    usd: items.length === 0 ? 0 : withUsd.length === 0 ? null : withUsd.reduce((s, i) => s + (i.usd as number), 0),
  };
};

export interface KindStats {
  customers: number;
  active: number;
  activePct: number | null;
  sales: DualAmount;
  salesPerActive: DualAmount | null;
  overdue: number;
  lapsed: number;
  stickiness: Record<Stickiness, number>;
  constantePct: number | null;
}

export function kindStats(rows: readonly KindRow[], kind: KindFilter): KindStats {
  const mine = kind === 'todos' ? rows : rows.filter(r => r.kind === kind);
  const active = mine.filter(r => r.activeInPeriod === true).length;
  const existed = mine.filter(r => r.activeInPeriod !== null).length;
  const stickiness = Object.fromEntries(STICKINESS_ORDER.map(s => [s, mine.filter(r => r.stickiness === s).length])) as Record<Stickiness, number>;
  const evaluated = stickiness.constante + stickiness.irregular + stickiness.perdido;
  const sales = sumDual(mine.map(r => r.salesPeriod));
  return {
    customers: mine.length,
    active,
    activePct: existed > 0 ? active / existed : null,
    sales,
    salesPerActive: active > 0 ? { bs: sales.bs / active, usd: sales.usd === null ? null : sales.usd / active } : null,
    overdue: mine.filter(r => r.visit.status === 'overdue').length,
    lapsed: mine.filter(r => r.status === 'lapsed').length,
    stickiness,
    constantePct: evaluated > 0 ? stickiness.constante / evaluated : null,
  };
}

export function salesDeltaPct(current: DualAmount, previous: DualAmount | null, currency: Currency): number | null {
  if (!previous) return null;
  const cur = currency === 'usd' ? current.usd : current.bs;
  const prev = currency === 'usd' ? previous.usd : previous.bs;
  if (cur === null || prev === null || !(prev > 0)) return null;
  return (cur - prev) / prev;
}

export interface HoldingStats {
  customers: number;
  active: number;
  boughtPrev: number | null;
  cooled: number | null;
  retainedPct: number | null;
  salesDeltaPct: number | null;
}

// "¿Se mantiene el patrimonio?": compares patrimonio with the previous equal period; everything that needs the previous
// window is null when there is none (a past closed YTD year), so the UI hides the comparison instead of inventing a delta.
export function patrimonioHolding(rows: readonly KindRow[], prevAvailable: boolean, currency: Currency): HoldingStats {
  const mine = rows.filter(r => r.kind === 'patrimonio');
  const base = { customers: mine.length, active: mine.filter(r => r.activeInPeriod === true).length };
  if (!prevAvailable) return { ...base, boughtPrev: null, cooled: null, retainedPct: null, salesDeltaPct: null };
  const prev = mine.filter(r => r.boughtPrev === true);
  const retained = prev.filter(r => r.activeInPeriod === true).length;
  const prevSales = mine.every(r => r.salesPrev) ? sumDual(mine.map(r => r.salesPrev as DualAmount)) : null;
  return {
    ...base,
    boughtPrev: prev.length,
    cooled: prev.filter(r => r.activeInPeriod === false).length,
    retainedPct: prev.length > 0 ? retained / prev.length : null,
    salesDeltaPct: salesDeltaPct(sumDual(mine.map(r => r.salesPeriod)), prevSales, currency),
  };
}

export interface Funnel {
  registered: number;
  bought: number;
  neverBought: number;
  constante: number;
  irregular: number;
  perdido: number;
  observacion: number;
  sin_frecuencia: number;
  medianDaysToFirstSale: number | null;
}

// "¿Se quedan los nuevos?": registered -> bought at least once -> constante, with the rest of those who bought split by class.
export function newCustomersFunnel(rows: readonly KindRow[]): Funnel {
  const nuevos = rows.filter(r => r.kind === 'nuevo');
  const bought = nuevos.filter(r => r.lastSaleDateKey !== null);
  const count = (s: Stickiness) => bought.filter(r => r.stickiness === s).length;
  const days = bought.map(r => r.daysToFirstSale).filter((d): d is number => d !== null).sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  return {
    registered: nuevos.length,
    bought: bought.length,
    neverBought: nuevos.length - bought.length,
    constante: count('constante'), irregular: count('irregular'), perdido: count('perdido'),
    observacion: count('observacion'), sin_frecuencia: count('sin_frecuencia'),
    medianDaysToFirstSale: days.length === 0 ? null : days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2,
  };
}
