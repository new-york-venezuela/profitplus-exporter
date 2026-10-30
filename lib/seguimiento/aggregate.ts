import { bucketCategoryMix, chooseVisibleLines, type LineAmount } from './category-mix';
import { isoWeeksOfMonth } from './iso-weeks';
import { monthBounds, monthPace, projectToMonth, type MonthPace } from './month-pace';
import { rollUpQuotas, type SellerTargets } from './quotas';
import type {
  Dual, RootKind, RootMetrics, SeguimientoCustomer, SeguimientoResponse, SeguimientoRoot, WeekHeader,
} from './types';
import { summarizeCompliance, visitCompliance } from './visit-compliance';

export const NO_SELLER = 'sin-vendedor';
export const NO_ROUTE = 'sin-ruta';
export const NO_GROUP = 'sin-grupo';

export interface CustomerFact {
  customerCode: string;
  customerName: string;
  isInactive: boolean;
  salesRepKey: string | null;
  salesRepName: string | null;
  zoneCode: string | null;
  routeNumber: number | null;
  segmentCode: string | null;
  segmentName: string | null;
  registeredDate: string | null;
  isMigrationBatch: boolean;
  visitIntervalDays: number | null;
  lastInvoiceDate: string | null;
}
export type RootableCustomer = Pick<CustomerFact, 'salesRepKey' | 'salesRepName' | 'zoneCode' | 'routeNumber' | 'segmentCode' | 'segmentName'>;

export interface CustomerLineSales { customerCode: string; line: string | null; units: number; sales: Dual }
export interface CustomerWeekActivity { customerCode: string; yearWeek: string }
export interface CustomerLineReturns { customerCode: string; line: string | null; units: number; returns: Dual }
export interface CustomerWeekAmounts {
  customerCode: string; yearWeek: string; units: number; sales: Dual; returnUnits: number; returns: Dual;
}

export interface SeguimientoInput {
  kind: RootKind;
  month: string;
  asOf: string;
  customers: CustomerFact[];
  lineSales: CustomerLineSales[];
  weekActivity: CustomerWeekActivity[];
  lineReturns: CustomerLineReturns[];
  weekAmounts: CustomerWeekAmounts[];
  consignmentRootCodes: string[];
  targets: ReadonlyMap<string, SellerTargets>;
}

// A customer belongs to the root given by its CURRENT Dim_Customer row (the queries resolve the
// current row by CustomerCode, so invoices issued under an older SCD2 version follow the customer).
export function rootOf(kind: RootKind, c: RootableCustomer): { value: string; label: string } {
  if (kind === 'vendedor') {
    return c.salesRepKey
      ? { value: c.salesRepKey, label: c.salesRepName ?? `Vendedor ${c.salesRepKey}` }
      : { value: NO_SELLER, label: 'Sin vendedor' };
  }
  if (kind === 'ruta') {
    return c.routeNumber != null && c.zoneCode
      ? { value: c.zoneCode, label: `Ruta ${c.routeNumber}` }
      : { value: NO_ROUTE, label: 'Sin ruta' };
  }
  return c.segmentCode
    ? { value: c.segmentCode, label: c.segmentName ?? c.segmentCode }
    : { value: NO_GROUP, label: 'Sin grupo' };
}

// USD ignores null rows and is null only when every row is null (same convention as sumDual).
function sumDuals(items: readonly Dual[]): Dual {
  if (items.length === 0) return { bs: 0, usd: 0 };
  const withUsd = items.filter(i => i.usd !== null);
  return {
    bs: items.reduce((s, i) => s + i.bs, 0),
    usd: withUsd.length === 0 ? null : withUsd.reduce((s, i) => s + (i.usd as number), 0),
  };
}

// usd is null iff sales.usd is null; missing returns USD counts as 0.
export function netOf(sales: Dual, returns: Dual): Dual {
  return { bs: sales.bs - returns.bs, usd: sales.usd === null ? null : sales.usd - (returns.usd ?? 0) };
}

function avgPriceOf(sales: Dual, units: number): Dual | null {
  if (!(units > 0)) return null;
  return { bs: sales.bs / units, usd: sales.usd === null ? null : sales.usd / units };
}

interface Row {
  fact: CustomerFact;
  consignment: boolean;
  assigned: boolean;
  lines: CustomerLineSales[];
  active: Set<string>;
  sales: Dual;
  units: number;
  returns: Dual;
  returnUnits: number;
  weekAmounts: Map<string, CustomerWeekAmounts>;
}

interface Ctx {
  month: string;
  monthStart: string;
  monthEnd: string;
  asOf: string;
  pace: MonthPace;
  headers: WeekHeader[];
  visible: string[];
  targets: ReadonlyMap<string, SellerTargets>;
}

function isNew(c: CustomerFact, ctx: Ctx): boolean {
  return !c.isMigrationBatch && c.registeredDate !== null && c.registeredDate >= ctx.monthStart && c.registeredDate <= ctx.monthEnd;
}

function toLineAmounts(rows: readonly Row[]): LineAmount[] {
  return rows.flatMap(r => r.lines.map(l => ({ line: l.line, sales: l.sales })));
}

// Route/group roots carry no goals: a seller's goal covers their whole portfolio, so summing it over the sellers who
// happen to appear in a route would compare part of the sales against full goals. Goals exist per seller and in the total.
const NO_QUOTA: ReturnType<typeof rollUpQuotas> = {
  salesQuotaUsd: null, weeklyVisitQuota: null, newCustomerQuota: null, unitsQuota: null, sellersTotal: 0,
  partial: { sales: false, weeklyVisits: false, newCustomers: false, units: false },
};

function buildMetrics(rows: Row[], sellerKeys: string[], shared: boolean, ctx: Ctx, withGoals = true): RootMetrics {
  const counted = rows.filter(r => !r.consignment);
  const assigned = counted.filter(r => r.assigned);
  const sales = sumDuals(counted.map(r => r.sales));
  const units = counted.reduce((s, r) => s + r.units, 0);
  const returns = sumDuals(counted.map(r => r.returns));
  const returnUnits = counted.reduce((s, r) => s + r.returnUnits, 0);
  const routeNumbers = [...new Set(counted.map(r => r.fact.routeNumber).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  const quota = withGoals ? rollUpQuotas(sellerKeys, ctx.targets) : NO_QUOTA;
  const quotaUsd = quota.salesQuotaUsd;
  const hasGoal = quotaUsd !== null && quotaUsd > 0;
  const projectedBs = projectToMonth(sales.bs, ctx.pace);
  const projected: Dual | null = projectedBs === null ? null : { bs: projectedBs, usd: projectToMonth(sales.usd, ctx.pace) };
  const allSales = sumDuals(rows.map(r => r.sales));
  const allUnits = rows.reduce((s, r) => s + r.units, 0);
  const projectedUnits = projectToMonth(units, ctx.pace);
  const hasUnitsGoal = quota.unitsQuota !== null && quota.unitsQuota > 0;
  const allProjectedBs = projectToMonth(allSales.bs, ctx.pace);
  const projectedWithConsignment: Dual | null = allProjectedBs === null ? null : { bs: allProjectedBs, usd: projectToMonth(allSales.usd, ctx.pace) };
  return {
    customerCount: assigned.length,
    sellerKeys,
    sales, units,
    returns, returnUnits,
    net: netOf(sales, returns),
    netUnits: units - returnUnits,
    returnRate: sales.bs > 0 ? returns.bs / sales.bs : null,
    routeLabels: routeNumbers.map(n => `Ruta ${n}`),
    avgPrice: avgPriceOf(sales, units),
    excludedSales: sumDuals(rows.filter(r => r.consignment).map(r => r.sales)),
    salesQuotaUsd: quotaUsd,
    quotaPartial: quota.partial.sales,
    quotaShared: withGoals && shared,
    attainment: hasGoal && sales.usd !== null ? sales.usd / quotaUsd : null,
    projected, projectedWithConsignment,
    unitsWithConsignment: allUnits,
    projectedUnits,
    unitsQuota: quota.unitsQuota,
    unitsQuotaPartial: quota.partial.units,
    unitsAttainment: hasUnitsGoal ? units / (quota.unitsQuota as number) : null,
    projectedUnitsAttainment: hasUnitsGoal && projectedUnits !== null ? projectedUnits / (quota.unitsQuota as number) : null,
    projectedUnitsWithConsignment: projectToMonth(allUnits, ctx.pace),
    projectedAttainment: hasGoal && projected?.usd != null ? projected.usd / quotaUsd : null,
    weeklyVisitQuota: quota.weeklyVisitQuota,
    weeks: ctx.headers.map(h => {
      const active = h.isFuture ? 0 : assigned.filter(r => r.active.has(h.yearWeek)).length;
      const cells = h.isFuture ? [] : counted.map(r => r.weekAmounts.get(h.yearWeek)).filter((c): c is CustomerWeekAmounts => c !== undefined);
      const wSales = sumDuals(cells.map(c => c.sales));
      const wReturns = sumDuals(cells.map(c => c.returns));
      const wUnits = cells.reduce((s, c) => s + c.units, 0);
      return {
        yearWeek: h.yearWeek, active, assigned: assigned.length,
        pct: h.isFuture || assigned.length === 0 ? null : active / assigned.length,
        sales: wSales, units: wUnits,
        returns: wReturns, returnUnits: cells.reduce((s, c) => s + c.returnUnits, 0),
        net: netOf(wSales, wReturns),
        avgPrice: avgPriceOf(wSales, wUnits),
      };
    }),
    mix: bucketCategoryMix(toLineAmounts(counted), ctx.visible),
    newCustomers: {
      count: assigned.filter(r => isNew(r.fact, ctx)).length,
      quota: quota.newCustomerQuota,
      partial: quota.partial.newCustomers,
    },
    compliance: summarizeCompliance(assigned.map(r => visitCompliance({
      lastInvoiceDate: r.fact.lastInvoiceDate, intervalDays: r.fact.visitIntervalDays, asOf: ctx.asOf,
    }))),
  };
}

function toCustomer(r: Row, ctx: Ctx): SeguimientoCustomer {
  return {
    customerCode: r.fact.customerCode,
    customerName: r.fact.customerName,
    salesRepName: r.fact.salesRepName,
    routeLabel: r.fact.routeNumber != null ? `Ruta ${r.fact.routeNumber}` : null,
    groupLabel: r.fact.segmentName,
    sales: r.sales, units: r.units, avgPrice: avgPriceOf(r.sales, r.units),
    returns: r.returns, returnUnits: r.returnUnits, net: netOf(r.sales, r.returns),
    activeWeeks: ctx.headers.map(h => h.yearWeek).filter(w => r.active.has(w)),
    mix: bucketCategoryMix(toLineAmounts([r]), ctx.visible),
    isNew: isNew(r.fact, ctx),
    registeredDate: r.fact.registeredDate,
    lastInvoiceDate: r.fact.lastInvoiceDate,
    visit: visitCompliance({ lastInvoiceDate: r.fact.lastInvoiceDate, intervalDays: r.fact.visitIntervalDays, asOf: ctx.asOf }),
  };
}

function distinctSellerKeys(rows: readonly Row[]): string[] {
  return [...new Set(rows.filter(r => !r.consignment).map(r => r.fact.salesRepKey).filter((k): k is string => k !== null))];
}

export function buildSeguimiento(
  input: SeguimientoInput,
): Pick<SeguimientoResponse, 'pace' | 'weeks' | 'visibleLines' | 'total' | 'roots'> {
  const { start, end } = monthBounds(input.month);
  const pace = monthPace(input.month, input.asOf);
  const headers: WeekHeader[] = isoWeeksOfMonth(input.month).map(w => ({ ...w, isFuture: w.weekStart > input.asOf }));
  const flagged = new Set(input.consignmentRootCodes.map(c => c.trim()));

  const linesBy = new Map<string, CustomerLineSales[]>();
  for (const l of input.lineSales) linesBy.set(l.customerCode, [...(linesBy.get(l.customerCode) ?? []), l]);
  const activeBy = new Map<string, Set<string>>();
  for (const a of input.weekActivity) {
    const set = activeBy.get(a.customerCode) ?? new Set<string>();
    set.add(a.yearWeek);
    activeBy.set(a.customerCode, set);
  }

  const returnsBy = new Map<string, CustomerLineReturns[]>();
  for (const l of input.lineReturns) returnsBy.set(l.customerCode, [...(returnsBy.get(l.customerCode) ?? []), l]);
  const amountsBy = new Map<string, Map<string, CustomerWeekAmounts>>();
  for (const w of input.weekAmounts) {
    const m = amountsBy.get(w.customerCode) ?? new Map<string, CustomerWeekAmounts>();
    const prev = m.get(w.yearWeek);
    m.set(w.yearWeek, prev ? {
      ...prev, units: prev.units + w.units, sales: sumDuals([prev.sales, w.sales]),
      returnUnits: prev.returnUnits + w.returnUnits, returns: sumDuals([prev.returns, w.returns]),
    } : w);
    amountsBy.set(w.customerCode, m);
  }

  const allRows: Row[] = input.customers.map(fact => {
    const lines = linesBy.get(fact.customerCode) ?? [];
    const consignment = flagged.has(fact.customerCode);
    return {
      fact, consignment, lines,
      // A customer registered after the reference month did not exist yet in that month (matters when
      // viewing a past month); a missing registration date keeps the customer in.
      assigned: !fact.isInactive && !consignment && (fact.registeredDate === null || fact.registeredDate <= end),
      active: activeBy.get(fact.customerCode) ?? new Set<string>(),
      sales: sumDuals(lines.map(l => l.sales)),
      units: lines.reduce((s, l) => s + l.units, 0),
      returns: sumDuals((returnsBy.get(fact.customerCode) ?? []).map(l => l.returns)),
      returnUnits: (returnsBy.get(fact.customerCode) ?? []).reduce((s, l) => s + l.units, 0),
      weekAmounts: amountsBy.get(fact.customerCode) ?? new Map<string, CustomerWeekAmounts>(),
    };
  });
  // Irrelevant rows: inactive customers (or consignment roots) with no sales this month.
  const rows = allRows.filter(r => r.assigned || r.lines.length > 0);

  const visible = chooseVisibleLines(toLineAmounts(rows.filter(r => !r.consignment)));
  const ctx: Ctx = { month: input.month, monthStart: start, monthEnd: end, asOf: input.asOf, pace, headers, visible, targets: input.targets };

  const groups = new Map<string, { label: string; rows: Row[] }>();
  for (const r of rows) {
    const { value, label } = rootOf(input.kind, r.fact);
    const g = groups.get(value) ?? { label, rows: [] };
    g.rows.push(r);
    groups.set(value, g);
  }

  const sellerRootCount = new Map<string, number>();
  for (const g of groups.values()) for (const k of distinctSellerKeys(g.rows)) sellerRootCount.set(k, (sellerRootCount.get(k) ?? 0) + 1);

  const roots: SeguimientoRoot[] = [...groups].map(([value, g]) => {
    const sellerKeys = distinctSellerKeys(g.rows);
    const shared = input.kind !== 'vendedor' && sellerKeys.some(k => (sellerRootCount.get(k) ?? 0) > 1);
    const realSeller = input.kind === 'vendedor' && value !== NO_SELLER ? value : null;
    return {
      ...buildMetrics(g.rows, sellerKeys, shared, ctx, input.kind === 'vendedor'),
      value, label: g.label,
      salesRepKey: realSeller,
      targets: realSeller ? (input.targets.get(realSeller) ?? null) : null,
      customers: g.rows.filter(r => !r.consignment)
        .sort((a, b) => b.sales.bs - a.sales.bs || a.fact.customerName.localeCompare(b.fact.customerName))
        .map(r => toCustomer(r, ctx)),
    };
  });

  roots.sort((a, b) => {
    const tail = (r: SeguimientoRoot) => (r.value === NO_SELLER || r.value === NO_ROUTE || r.value === NO_GROUP ? 1 : 0);
    if (tail(a) !== tail(b)) return tail(a) - tail(b);
    if (input.kind === 'ruta') return a.label.localeCompare(b.label, 'es', { numeric: true });
    return b.sales.bs - a.sales.bs || a.label.localeCompare(b.label, 'es');
  });

  return {
    pace, weeks: headers, visibleLines: visible,
    total: buildMetrics(rows, distinctSellerKeys(rows), false, ctx),
    roots,
  };
}
