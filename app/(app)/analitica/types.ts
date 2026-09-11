export type Currency = 'bs' | 'usd';
export type DateRange = '30d' | '90d' | '12m' | 'custom';
export type GroupBy = string; // e.g., 'mes', 'cliente', 'salesrep', 'producto', 'linea', 'sublinea', 'sku'

export interface FilterParams {
  dateRange: DateRange;
  currency: Currency;
  startDate?: string; // YYYY-MM-DD, only if custom
  endDate?: string;
}

export interface DrillContext {
  groupBy: GroupBy;
  parentValue?: string; // e.g., salesRepKey=123 when drilling into products for that rep
}

export type PivotDimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor';

export interface BreakdownRow {
  label: string;
  value: string;
  [metricKey: string]: string | number | null;
}

// Resumen tab
export interface ResumenKPIs {
  salesNet12mo: number;
  returnsNet12mo: number;
  returnRate: number | null;
  collected12mo: number;
}

export interface MonthlyTrendRow {
  yearMonth: string;
  salesNet: number;
  returnsNet: number;
}

export interface NamedAmount {
  name: string;
  netRevenue: number;
}

export interface SalesRepRow {
  name: string;
  salesNet: number;
  returnsNet: number;
}

export interface AgingBucketRow {
  bucket: string;
  amount: number;
}

export interface DebtorRow {
  name: string;
  outstanding: number;
}

export interface ResumenResponse {
  monthlyTrend: MonthlyTrendRow[];
  topCustomers: NamedAmount[];
  topProducts: NamedAmount[];
  salesReps: SalesRepRow[];
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  snapshotDateKey: number | null;
  usdRate: number | null;
  kpis: ResumenKPIs;
}

// Ventas tab
export interface VentasRow {
  label: string; // formatted month or customer or line name
  value: string | number; // the groupBy identifier
  salesNet: number;
  returnRate: number | null;
  avgDiscount: number | null;
}

export interface VentasResponse {
  rows: VentasRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// Devoluciones tab
export interface DevolucionesMatrixCell {
  salesRep: string;
  producto: string;
  cliente: string;
  // Dimension value (e.g. LegalEntityKey/CustomerKey as a string) for the row
  // being grouped, only populated for groupBy === 'cliente' — used as the
  // `parentValue` for a GroupedDrilldownTable breakdown fetch on that row.
  clienteValue: string | null;
  ratioDevolucion: number | null;
  amountNet: number;
}

export interface DevolucionesResponse {
  rows: DevolucionesMatrixCell[];
  groupBy: GroupBy; // 'salesrep' | 'producto' | 'cliente'
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// CXC tab
export interface CxcResponse {
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  overdueShare: number | null;
  snapshotDateKey: number | null;
  usdRate: number | null;
}

// Vendedores tab
export interface VendedoresRow {
  value: string; // SalesRepKey, stringified — used as parentValue for breakdown fetches
  name: string;
  salesNet: number;
  returnsNet: number;
  returnRate: number | null;
  collectionRate: number | null;
  avgDiscount: number | null;
}

export interface VendedoresResponse {
  rows: VendedoresRow[];
  usdRate: number | null;
}

// Clientes tab
export interface ClientesRow {
  name: string;
  salesNet: number;
  returnsNet: number;
  returnRate: number | null;
  pareto: 'A' | 'B' | 'C'; // Pareto segment
}

export interface ClientesResponse {
  rows: ClientesRow[];
  paretoThresholds: { a: number; b: number }; // cumulative % for A and B segments
  usdRate: number | null;
}

// Productos tab
export interface ProductosRow {
  sku: string;
  linea: string;
  sublinea: string;
  rotacion: number; // QuantitySold * GrossProfitAmount or similar metric
  salesNet: number;
  margin: number | null; // GrossProfitAmount / NetAmount
}

export interface ProductosResponse {
  rows: ProductosRow[];
  groupBy: GroupBy; // 'linea' | 'sublinea' | 'sku'
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// Finanzas tab
export interface FinanzasWaterfallStep {
  step: string; // 'Bruto' → 'Descuento' → 'Neto' → 'COGS' → 'Utilidad'
  amount: number;
  cumulative: number;
}

export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];
  usdRate: number | null;
}

// Multimoneda tab
export interface ExchangeRateRow {
  yearMonth: string;
  rateBcvToUsd: number; // BCV official rate
}

export interface MultimonedaResponse {
  exchangeRates: ExchangeRateRow[];
  currentRate: number | null;
}
