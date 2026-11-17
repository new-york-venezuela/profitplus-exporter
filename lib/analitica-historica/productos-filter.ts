import { parseItemFilter, type ItemFilter } from '@/lib/productos/item-filter';

export type HistNivel = 'linea' | 'sublinea' | 'sku';
export type HistMetric = 'ventas' | 'unidades';

export interface HistProductosFilters {
  nivel: HistNivel;
  metric: HistMetric;
  currency: 'bs' | 'usd';
  categoria: string | null;
  filter: ItemFilter;
}

const NIVELES: readonly string[] = ['linea', 'sublinea', 'sku'];
const MAX_CATEGORIA = 60;

// Productos controls from the query string. Reuses the main Productos item filter
// (líneas, sublíneas, text search: parameter-bound, LIKE wildcards escaped). The
// customer-group filter needs the CURRENT Dim_Customer, which legacy customers
// do not have, so `grupo` is always dropped.
export function parseHistProductosFilters(params: URLSearchParams): HistProductosFilters {
  const nivel = params.get('nivel');
  const categoria = (params.get('categoria') ?? '').trim();
  return {
    nivel: nivel !== null && NIVELES.includes(nivel) ? (nivel as HistNivel) : 'linea',
    metric: params.get('metric') === 'unidades' ? 'unidades' : 'ventas',
    currency: params.get('currency') === 'usd' ? 'usd' : 'bs',
    categoria: categoria !== '' && categoria.length <= MAX_CATEGORIA ? categoria : null,
    filter: { ...parseItemFilter(params), grupo: null },
  };
}
