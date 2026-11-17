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
