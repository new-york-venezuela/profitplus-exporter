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
