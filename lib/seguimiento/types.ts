import type { MonthPace } from './month-pace';
import type { MixSegment, Dual } from './category-mix';
import type { SellerTargets } from './quotas';
import type { ComplianceSummary, VisitCompliance } from './visit-compliance';

export type { Dual } from './category-mix';

export type RootKind = 'vendedor' | 'ruta' | 'grupo';

export function parseRootKind(v: string | null): RootKind {
  return v === 'ruta' || v === 'grupo' ? v : 'vendedor';
}

export interface WeekHeader { yearWeek: string; weekStart: string; weekEnd: string; label: string; isFuture: boolean }
export interface WeekCell {
  yearWeek: string; active: number; assigned: number; pct: number | null;
  /** Amounts clipped to the month, non-consignment customers only. Zero for future weeks. */
  sales: Dual; units: number; returns: Dual; returnUnits: number; net: Dual; avgPrice: Dual | null;
}
export interface NewCustomersInfo { count: number; quota: number | null; partial: boolean }

export interface RootMetrics {
  customerCount: number;
  /** Assigned customers (same group as customerCount) with an invoice in an elapsed week of the month. */
  activeCustomers: number;
  sellerKeys: string[];
  sales: Dual;
  units: number;
  returns: Dual;
  returnUnits: number;
  net: Dual;
  netUnits: number;
  /** returns.bs / sales.bs; null when sales.bs is 0. */
  returnRate: number | null;
  /** Distinct "Ruta N" labels of the root's customers, natural order. */
  routeLabels: string[];
  avgPrice: Dual | null;
  excludedSales: Dual;
  salesQuotaUsd: number | null;
  quotaPartial: boolean;
  quotaShared: boolean;
  attainment: number | null;
  projected: Dual | null;
  projectedAttainment: number | null;
  /** Same linear projection over sales + consignment; no attainment, the quota does not cover consignment. */
  projectedWithConsignment: Dual | null;
  /** Linear month projection of units sold (sellers only / sellers + consignment). */
  /** Units sold including consignment roots (`units` excludes them). */
  unitsWithConsignment: number;
  projectedUnits: number | null;
  unitsQuota: number | null;
  unitsQuotaPartial: boolean;
  /** Units sold (sellers only) / unitsQuota. */
  unitsAttainment: number | null;
  /** Projected units (sellers only) / unitsQuota. */
  projectedUnitsAttainment: number | null;
  projectedUnitsWithConsignment: number | null;
  weeklyVisitQuota: number | null;
  weeks: WeekCell[];
  mix: MixSegment[];
  newCustomers: NewCustomersInfo;
  compliance: ComplianceSummary;
}

export interface SeguimientoCustomer {
  customerCode: string;
  customerName: string;
  salesRepName: string | null;
  routeLabel: string | null;
  groupLabel: string | null;
  sales: Dual;
  units: number;
  returns: Dual;
  returnUnits: number;
  net: Dual;
  avgPrice: Dual | null;
  activeWeeks: string[];
  mix: MixSegment[];
  isNew: boolean;
  registeredDate: string | null;
  lastInvoiceDate: string | null;
  visit: VisitCompliance;
}

export interface SeguimientoRoot extends RootMetrics {
  value: string;
  label: string;
  salesRepKey: string | null;
  targets: SellerTargets | null;
  customers: SeguimientoCustomer[];
}

export interface SeguimientoResponse {
  kind: RootKind;
  month: string;
  monthStart: string;
  monthEnd: string;
  asOf: string;
  pace: MonthPace;
  weeks: WeekHeader[];
  visibleLines: string[];
  total: RootMetrics;
  roots: SeguimientoRoot[];
}

export interface SeguimientoInvoiceLine {
  invoiceNumber: string;
  invoiceDate: string;
  lineNumber: number;
  productCode: string;
  productName: string;
  lineName: string | null;
  quantity: number;
  amount: Dual;
  unitPrice: Dual | null;
}
export interface SeguimientoLinesResponse { lines: SeguimientoInvoiceLine[] }

export interface SeguimientoExcludedInvoice {
  customerCode: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amountNet: Dual;
}
export interface SeguimientoExcludedResponse { invoices: SeguimientoExcludedInvoice[] }

export type HistoryScope = { kind: 'total' } | { kind: RootKind; value: string };
export interface HistoryPoint {
  month: string; sales: Dual; units: number; returns: Dual; returnUnits: number;
  /**
   * Brutas per product line (Dim_Product.LineName, null = no line) for the month; `sales`/`units` are
   * their sum. Always set by fetchHistory; optional only so an older cached response still renders.
   * Returns are month-level only (no per-line returns).
   */
  byLine?: { line: string | null; sales: Dual; units: number }[];
}
export interface SeguimientoHistoryResponse { points: HistoryPoint[] }
