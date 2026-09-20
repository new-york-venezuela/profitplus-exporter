export type Currency = 'bs' | 'usd';
// '12m' | `month:${YYYY-MM}` | `ytd:${YYYY}` | `custom:${YYYY-MM-DD}:${YYYY-MM-DD}` — a custom
// range is encoded as a single string (not separate start/end props) so it
// flows through every tab's existing `dateRange: DateRange` prop and query
// param unchanged; only buildDateWhereClause parses the custom: prefix.
export type DateRange = string;
export type GroupBy = string; // e.g., 'mes', 'cliente', 'salesrep', 'producto', 'linea', 'sublinea', 'sku'

export interface FilterParams {
  dateRange: DateRange;
  currency: Currency;
}

export interface DrillContext {
  groupBy: GroupBy;
  parentValue?: string; // e.g., salesRepKey=123 when drilling into products for that rep
}

export type PivotDimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor' | 'proveedor';

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
  // Distinct Dim_LegalEntity with >=1 sale in range, and the same-length
  // immediately-preceding period's count, for the Δ card — same
  // activeClients/prevPeriod convention as Ventas' VentasKpis.
  activeCustomers: number;
  activeCustomersPrevPeriod: number | null;
  // Share of the previous period's active customers that placed no order
  // in the current period. Null when the previous period had zero active
  // customers (nothing to churn from).
  churnRate: number | null;
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
  // Average (DateKey - DueDateKey) in days across this debtor's
  // Fact_Collections rows with a resolvable DueDateKey (0027's join) — null
  // when the debtor has no such rows (shown as "—" in the UI). Positive =
  // paid late on average, negative = paid early on average.
  avgDaysToPay: number | null;
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

// Ventas tab — KPI row, scoped to dateRange/currency like every other
// section, computed directly off Fact_Sales (no margin/profit field: DWH
// has no reliable cost data, see AGENTS.md).
export interface VentasKpis {
  salesNet: number;
  salesNetPrevPeriod: number | null; // same-length immediately-preceding period, for the Δ%
  activeClients: number; // distinct Dim_LegalEntity with >=1 sale in range
  avgTicket: number | null; // salesNet / distinct invoices (null if no invoices)
  unitsSold: number;
  salesPerActiveClient: number | null; // salesNet / activeClients (null if activeClients = 0)
}

export interface VentasKpisResponse {
  kpis: VentasKpis;
  usdRate: number | null;
}

// Ventas tab — dynamic sales comparison charts (two independent charts: by
// línea and by cliente/cadena). Each chart lets the user pick 2-4 series
// from a fixed catalog (top N by sales in range) and shows salesNet per
// month per series, pivoted so Recharts can render one <Line> per series.
export interface ComparisonOption {
  value: string; // LineCode or LegalEntityKey, used as the series-select key
  label: string;
}

export interface ComparisonOptionsResponse {
  lineas: ComparisonOption[];
  clientes: ComparisonOption[];
}

export interface ComparisonSeriesMonthRow {
  yearMonth: string; // formatted label, e.g. "Ene 26"
  yearMonthValue: string; // raw YYYY-MM
  values: Record<string, number>; // series value (LineCode or LegalEntityKey) -> salesNet that month
}

export interface VentasComparisonResponse {
  rows: ComparisonSeriesMonthRow[];
  usdRate: number | null;
}

// Compras tab
export interface ComprasRow {
  label: string;
  value: string;
  purchasesNet: number;
  avgDiscount: number | null;
}

export interface ComprasResponse {
  rows: ComprasRow[];
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
// Part 3b of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md:
// one row per weekday (Lun-Dom), 3 amounts per row for the 3
// vencimiento-status series at time of payment.
export interface WeekdayVencimientoRow {
  weekday: string; // 'Lun' | 'Mar' | ... | 'Dom'
  venceHoy: number; // DateKey == DueDateKey
  vencida: number; // DateKey > DueDateKey
  noVencida: number; // DateKey < DueDateKey
}

// Part 3c: monthly DSO, independent of the CxC tab's own snapshot-only date
// handling — one point per month that has at least one Fact_AR_Snapshot run.
export interface DsoTrendRow {
  yearMonth: string;
  dso: number | null;
}

// Part 3d: existing aging buckets (Current/1-30/31-60/61-90/>90), trended
// monthly instead of a single MAX(SnapshotDateKey) snapshot.
export interface AgingTrendRow {
  yearMonth: string;
  buckets: AgingBucketRow[];
}

export interface DebtConcentrationRow {
  name: string; // LegalEntityName or CustomerName, per clienteDimension
  buckets: AgingBucketRow[]; // same 5-bucket shape as AgingTrendRow.buckets
}

export interface DebtConcentrationResponse {
  rows: DebtConcentrationRow[];
  usdRate: number | null;
}

export interface CxcResponse {
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  overdueShare: number | null;
  snapshotDateKey: number | null;
  usdRate: number | null;
  weekdayVencimiento: WeekdayVencimientoRow[];
  dsoTrend: DsoTrendRow[];
  agingTrend: AgingTrendRow[];
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

// Clientes tab — monthly trend of active customers and churn rate, one
// point per month that had >=1 sale in dateRange (plus the one month
// immediately before it, needed to compute the first point's churn).
export interface ClientesTrendRow {
  yearMonth: string; // formatted, e.g. "Ene 26"
  activeCustomers: number;
  // Share of the PREVIOUS month's active customers absent this month. Null
  // for a month whose preceding month had zero active customers (nothing
  // to churn from) or isn't available (the very first month of history).
  churnRate: number | null;
}

export interface ClientesTrendResponse {
  rows: ClientesTrendRow[];
}

// Productos tab
export interface ProductosRow {
  sku: string;
  linea: string;
  sublinea: string;
  rotacion: number; // QuantitySold * GrossProfitAmount or similar metric
  salesNet: number;
  margin: number | null; // GrossProfitAmount / NetAmount
  salesShare: number | null; // salesNet / sum(salesNet) across all rows at this drill level
}

export interface ProductosResponse {
  rows: ProductosRow[];
  groupBy: GroupBy; // 'linea' | 'sublinea' | 'sku'
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// Productos tab — Profundidad de Línea table (top-15 SKUs by sales, flat
// leaderboard, independent of the línea/sublínea/sku drill-down above).
export interface ProfundidadLineaRow {
  sku: string;
  clientCount: number;
  clientShare: number | null; // clientCount / total distinct clients active in range
  storeCount: number;
  storeShare: number | null; // storeCount / total distinct stores active in range
  avgMonthlyPrice: number; // avg NetAmount per unit, averaged over months with sales
  avgMonthlyUnits: number; // QuantitySold / distinct months with sales in range
  returnRate: number | null;
}

export interface ProfundidadLineaResponse {
  rows: ProfundidadLineaRow[];
  usdRate: number | null;
}

// Productos tab — units sold by month, stacked by línea (top lines by
// volume; the rest bucketed as "Otras" to keep the stack legible).
export interface UnitsByLineaMonthRow {
  yearMonth: string; // formatted label, e.g. "Ene 26"
  yearMonthValue: string; // raw YYYY-MM, used for drill-down filters
  units: Record<string, number>; // línea name -> units sold that month
  salesNet: Record<string, number>; // línea name -> sales net that month (for % of total)
  totalSalesNet: number; // sum of salesNet across all líneas that month
}

export interface UnitsByLineaResponse {
  rows: UnitsByLineaMonthRow[];
  lineas: string[]; // ordered list of línea names present (series keys), "Otras" last if present
  usdRate: number | null;
}

// Finanzas tab
export interface ExpenseCategoryRow {
  category: string;
  amount: number;
}

// Proxy gross-margin waterfall (Part 2 of docs/superpowers/specs/
// 2026-09-15-analitica-ui-and-margin-design.md): Compras stands in for COGS
// since Fact_Sales has never recorded real product cost (see
// docs/DATA_WAREHOUSE_GUIDE.md's Cost Data Gap section) — this is
// deliberately a proxy, not exact COGS-based gross margin, and distinct
// from Margen Operativo (which nets against ALL operating expenses, not
// just Compras).
export interface MargenProxy {
  ingresos: number;
  compras: number;
  utilidadBruta: number; // ingresos - compras
  margenBrutoRate: number | null; // utilidadBruta / ingresos
  otrosGastosOperativos: number; // gastosOperativos - compras
  margenOperativo: number; // utilidadBruta - otrosGastosOperativos (equals cashFlowEbitda.ebitda)
  margenOperativoRate: number | null; // margenOperativo / ingresos
}

export interface CashFlowEbitda {
  ingresosOperativos: number;
  gastosOperativos: number;
  ebitda: number;
  intereses: number;
  impuestos: number;
  utilidadNeta: number;
}

export interface FinanzasResponse {
  cashFlowEbitda: CashFlowEbitda;
  margenProxy: MargenProxy;
  expenseBreakdown: ExpenseCategoryRow[];
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
