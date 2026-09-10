# Task 1 Review Package

**Brief:** app/(app)/analitica/types.ts — shared type definitions for analytics tabs

**Base:** a81d306ba7cbb83772546bed7691c9c9ed6bdb25
**Head:** (current)

## Commit Summary
```
git log --oneline a81d306..HEAD
commit [new commit] feat: define shared types for analytics tabs
```

## Diff Summary
```
 app/(app)/analitica/types.ts | +265 insertions
 1 file changed, 265 insertions(+)
```

## Full Diff

```typescript
+export type Currency = 'bs' | 'usd';
+export type DateRange = '30d' | '90d' | '12m' | 'custom';
+export type GroupBy = string;
+
+export interface FilterParams {
+  dateRange: DateRange;
+  currency: Currency;
+  startDate?: string;
+  endDate?: string;
+}
+
+export interface DrillContext {
+  groupBy: GroupBy;
+  parentValue?: string;
+}
+
+// Resumen tab types
+export interface ResumenKPIs {
+  salesNet12mo: number;
+  returnsNet12mo: number;
+  returnRate: number | null;
+  collected12mo: number;
+}
+
+export interface MonthlyTrendRow {
+  yearMonth: string;
+  salesNet: number;
+  returnsNet: number;
+}
+
+export interface NamedAmount {
+  name: string;
+  netRevenue: number;
+}
+
+export interface SalesRepRow {
+  name: string;
+  salesNet: number;
+  returnsNet: number;
+}
+
+export interface AgingBucketRow {
+  bucket: string;
+  amount: number;
+}
+
+export interface DebtorRow {
+  name: string;
+  outstanding: number;
+}
+
+export interface ResumenResponse {
+  monthlyTrend: MonthlyTrendRow[];
+  topCustomers: NamedAmount[];
+  topProducts: NamedAmount[];
+  salesReps: SalesRepRow[];
+  agingBuckets: AgingBucketRow[];
+  topDebtors: DebtorRow[];
+  snapshotDateKey: number | null;
+  usdRate: number | null;
+  kpis: ResumenKPIs;
+}
+
+// Ventas tab types
+export interface VentasRow {
+  label: string;
+  value: string | number;
+  salesNet: number;
+  returnRate: number | null;
+  avgDiscount: number | null;
+}
+
+export interface VentasResponse {
+  rows: VentasRow[];
+  groupBy: GroupBy;
+  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
+  usdRate: number | null;
+}
+
+// Devoluciones tab types
+export interface DevolucionesMatrixCell {
+  salesRep: string;
+  producto: string;
+  cliente: string;
+  ratioDevolucion: number | null;
+  amountNet: number;
+}
+
+export interface DevolucionesResponse {
+  rows: DevolucionesMatrixCell[];
+  groupBy: GroupBy;
+  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
+  usdRate: number | null;
+}
+
+// CXC tab types
+export interface CxcResponse {
+  agingBuckets: AgingBucketRow[];
+  topDebtors: DebtorRow[];
+  overdueShare: number | null;
+  snapshotDateKey: number | null;
+  usdRate: number | null;
+}
+
+// Vendedores tab types
+export interface VendedoresRow {
+  name: string;
+  salesNet: number;
+  returnsNet: number;
+  returnRate: number | null;
+  collectionRate: number | null;
+  avgDiscount: number | null;
+}
+
+export interface VendedoresResponse {
+  rows: VendedoresRow[];
+  usdRate: number | null;
+}
+
+// Clientes tab types
+export interface ClientesRow {
+  name: string;
+  salesNet: number;
+  returnsNet: number;
+  returnRate: number | null;
+  pareto: 'A' | 'B' | 'C';
+}
+
+export interface ClientesResponse {
+  rows: ClientesRow[];
+  paretoThresholds: { a: number; b: number };
+  usdRate: number | null;
+}
+
+// Productos tab types
+export interface ProductosRow {
+  sku: string;
+  linea: string;
+  sublinea: string;
+  rotacion: number;
+  salesNet: number;
+  margin: number | null;
+}
+
+export interface ProductosResponse {
+  rows: ProductosRow[];
+  groupBy: GroupBy;
+  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
+  usdRate: number | null;
+}
+
+// Finanzas tab types
+export interface FinanzasWaterfallStep {
+  step: string;
+  amount: number;
+  cumulative: number;
+}
+
+export interface FinanzasResponse {
+  waterfall: FinanzasWaterfallStep[];
+  usdRate: number | null;
+}
+
+// Multimoneda tab types
+export interface ExchangeRateRow {
+  yearMonth: string;
+  rateBcvToUsd: number;
+}
+
+export interface MultimonedaResponse {
+  exchangeRates: ExchangeRateRow[];
+  currentRate: number | null;
+}
```

## Report
See: `.superpowers/sdd/2026-09-10-analytics-dashboard-tabs/task-1-report.md`
