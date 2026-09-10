/**
 * Shared type definitions for analytics dashboard tabs and API routes
 * All response types support currency and date range parameters
 * All monetary values are raw numbers (never formatted strings)
 */

// ============================================================================
// 1. Base parameter and context types
// ============================================================================

export type Currency = 'bs' | 'usd';
export type DateRange = '30d' | '90d' | '12m' | 'custom';
export type GroupBy = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface FilterParams {
  dateRange: DateRange;
  currency: Currency;
  groupBy?: GroupBy;
  startDate?: string; // ISO 8601 format, required if dateRange === 'custom'
  endDate?: string;   // ISO 8601 format, required if dateRange === 'custom'
}

export interface DrillContext {
  tab: string;
  metric: string;
  value: string | number | null;
  level: 'kpi' | 'detail' | 'row';
}

// ============================================================================
// 2. Resumen (Summary) tab types
// ============================================================================

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
  kpis: ResumenKPIs;
  monthlyTrend: MonthlyTrendRow[];
  topCustomers: NamedAmount[];
  topProducts: NamedAmount[];
  salesReps: SalesRepRow[];
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  snapshotDateKey: number | null;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 3. Ventas (Sales) tab types
// ============================================================================

export interface VentasRow {
  periodo: string;
  montoVentas: number;
  cantidadDocumentos: number;
  tipoDocumento: string;
  cliente: string | null;
  vendedor: string | null;
  porcentajeVariacion: number | null;
}

export interface VentasResponse {
  rows: VentasRow[];
  total: number;
  totalDocumentos: number;
  promedio: number;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 4. Devoluciones (Returns) tab types
// ============================================================================

export interface DevolucionesMatrixCell {
  row: string;
  column: string;
  value: number;
  percentage: number | null;
}

export interface DevolucionesResponse {
  matrix: DevolucionesMatrixCell[];
  total: number;
  porcentajeTotalVentas: number | null;
  rowLabels: string[];
  columnLabels: string[];
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 5. CxC (Accounts Receivable) tab types
// ============================================================================

export interface CxcResponse {
  saldoTotal: number;
  saldoVencido: number;
  porcentajeVencido: number | null;
  diasPromediosCobro: number | null;
  topDebtors: DebtorRow[];
  agingDistribution: AgingBucketRow[];
  snapshotDateKey: number | null;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 6. Vendedores (Sales Reps) tab types
// ============================================================================

export interface VendedoresRow {
  nombre: string;
  ventasNetas: number;
  devolucionesNetas: number;
  tasaDevolucion: number | null;
  clientesActivos: number;
  comision: number | null;
  variacionAnual: number | null;
}

export interface VendedoresResponse {
  rows: VendedoresRow[];
  totalVentas: number;
  totalComisiones: number;
  tasaDevolucionPromedio: number | null;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 7. Clientes (Customers) tab types
// ============================================================================

export interface ClientesRow {
  nombreCliente: string;
  ventasNetas: number;
  devolucionesNetas: number;
  tasaDevolucion: number | null;
  saldoPendiente: number;
  diasAtrasoPromedio: number | null;
  frecuenciaCompra: number;
  ultimaCompra: string | null;
}

export interface ClientesResponse {
  rows: ClientesRow[];
  totalVentas: number;
  totalSaldoPendiente: number;
  tasaDevolucionPromedio: number | null;
  clientesActivos: number;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 8. Productos (Products) tab types
// ============================================================================

export interface ProductosRow {
  codigoProducto: string;
  nombreProducto: string;
  ventasNetas: number;
  cantidadVendida: number;
  precioPromedio: number;
  devolucionesNetas: number;
  tasaDevolucion: number | null;
  margenBruto: number | null;
  variacionAnual: number | null;
}

export interface ProductosResponse {
  rows: ProductosRow[];
  totalVentas: number;
  totalCantidad: number;
  precioPromedioGlobal: number;
  margenBrutoPromedio: number | null;
  tasaDevolucionPromedio: number | null;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 9. Finanzas (Finance/Waterfall) tab types
// ============================================================================

export interface FinanzasWaterfallStep {
  label: string;
  value: number;
  cumulative: number;
  isTotal: boolean;
  type: 'positive' | 'negative' | 'total';
}

export interface FinanzasResponse {
  steps: FinanzasWaterfallStep[];
  startingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  endingBalance: number;
  periodDate: string;
  usdRate: number | null;
  groupBy: GroupBy;
}

// ============================================================================
// 10. Multimoneda (Exchange Rates) tab types
// ============================================================================

export interface ExchangeRateRow {
  fecha: string;
  moneda: string;
  tasaCompra: number;
  tasaVenta: number;
  tasaPromedio: number;
  volatilidad: number | null;
}

export interface MultimonedaResponse {
  rates: ExchangeRateRow[];
  tasaActualUsdBs: number;
  cambioUltimo7Dias: number | null;
  cambioUltimo30Dias: number | null;
  cambioUltimo90Dias: number | null;
  ventasEnMultimoneda: {
    ventasUsd: number;
    ventasBs: number;
    porcentajeUsd: number | null;
  };
  usdRate: number | null;
  groupBy: GroupBy;
}
