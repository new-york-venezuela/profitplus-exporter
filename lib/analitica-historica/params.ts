import { parseReturnsBasis, type ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import { parseClienteDimension, type HistClienteDimension } from './sql';
import { histPresetRange, resolveHistRange, type ResolvedHistRange } from './window';

export interface HistParams {
  /** The dateRange value as requested (or the 12m default). */
  dateRange: string;
  /** Concrete, window-clamped key range; `empty` means nothing falls in the window. */
  range: ResolvedHistRange;
  basis: ReturnsBasis;
  /** How clients are listed: `entidad` (casa matriz roll-up, default) or `tienda` (one row per customer). */
  dimension: HistClienteDimension;
  searchParams: URLSearchParams;
}

// Common query params of every /api/dwh/analitica-historica/* route.
export function parseHistParams(request: Request): HistParams {
  const searchParams = new URL(request.url).searchParams;
  const dateRange = searchParams.get('dateRange') ?? histPresetRange('12m');
  return {
    dateRange,
    range: resolveHistRange(dateRange),
    basis: parseReturnsBasis(searchParams.get('returnsBasis')),
    dimension: parseClienteDimension(searchParams.get('clienteDimension')),
    searchParams,
  };
}
