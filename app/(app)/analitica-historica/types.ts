import type { Currency, ReturnsBasis } from '../analitica/types';
import type { Granularity } from '../analitica/lib/granularity';

export type { Currency, ReturnsBasis, DualAmount } from '../analitica/types';

// Props every Analítica histórica tab receives (same shape as TabComponentProps
// in the main analytics client). `dateRange` is always a concrete custom: / month:
// value inside the legacy window.
export interface HistTabProps {
  dateRange: string;
  currency: Currency;
  granularity: Granularity;
  returnsBasis: ReturnsBasis;
}

import type { DualAmount } from '../analitica/types';
import type { BucketMode } from '../analitica/lib/granularity';
import type { MonthlyTrendRow } from '../analitica/types';

// ── Resumen ────────────────────────────────────────────────────────────────
export interface HistKpis {
  salesGross: DualAmount;
  returns: DualAmount;
  salesNet: DualAmount;
  returnRate: number | null;
  unitsSold: number;
  unitsReturned: number;
  customersWithSales: number;
  customersWithReturns: number;
  customersNet: number; // customers whose net (gross − returns) in range is > 0
}

export interface HistResumenResponse {
  empty: boolean;
  kpis: HistKpis | null;
  trend: MonthlyTrendRow[];
  trendMode: BucketMode;
}

// ── Ventas / grouped drilldowns ────────────────────────────────────────────
export type HistGroupBy = 'mes' | 'cliente' | 'linea' | 'vendedor' | 'producto' | 'sku';

export interface HistGroupRow {
  label: string;
  value: string;
  salesGross: DualAmount;
  returns: DualAmount;
  salesNet: DualAmount;
  returnRate: number | null;
  units: number;
}

export interface HistGroupResponse {
  groupBy: HistGroupBy;
  rows: HistGroupRow[];
}

// ── Devoluciones ───────────────────────────────────────────────────────────
export interface HistDevolucionRow {
  label: string;
  value: string;
  returns: DualAmount;
  salesGross: DualAmount; // sales of the same group in the same range (the rate's denominator)
  returnRate: number | null;
  unitsReturned: number;
}

export interface HistDevolucionesResponse {
  empty: boolean;
  groupBy: 'mes' | 'cliente' | 'sku';
  kpis: HistKpis | null;
  rows: HistDevolucionRow[];
}

// ── Clientes ───────────────────────────────────────────────────────────────
import type { ParetoClass } from '@/lib/productos/pareto';

export interface HistClienteRow {
  customerKey: number;
  code: string;
  name: string;
  firstInvoiceKey: number | null; // first / last non-voided invoice over the WHOLE legacy window
  lastInvoiceKey: number | null;
  invoices: number; // distinct invoices in the selected range
  salesGross: DualAmount;
  returns: DualAmount;
  salesNet: DualAmount; // negative when the customer only returned in the range
  returnRate: number | null;
  units: number;
  sharePct: number | null; // net Bs ÷ total net Bs of the listed customers; negative allowed, null when the total is not positive
  pareto: ParetoClass | null;
  status: 'activo' | 'sin_compras'; // sin_compras = no sale in the selected range
}

export interface HistClientesResponse {
  empty: boolean;
  rows: HistClienteRow[];
}

// ── Productos ──────────────────────────────────────────────────────────────
// The catalogo rows reuse the main Productos CatalogoRow shape so the master
// table component is shared; `clientCount` and `posCount` both carry the number
// of distinct legacy customers (legacy customers have no legal-entity roll-up).
import type { CatalogoRow } from '../analitica/types';

export interface HistCatalogoResponse {
  rows: CatalogoRow[];
  nivel: 'linea' | 'sublinea' | 'sku';
}

export interface HistProductosFiltrosResponse {
  lineas: string[];
  sublineas: { linea: string; sublinea: string }[];
  categorias: string[];
}
