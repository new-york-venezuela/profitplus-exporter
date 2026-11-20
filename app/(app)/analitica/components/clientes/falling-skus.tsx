'use client';

import { productosScopeQuery } from '@/lib/clientes/product-url';
import type { ClientesParams } from '../../lib/clientes-params';
import { moneyLabel } from '../../lib/format';
import { useDwhSection } from '../../lib/use-dwh-section';
import type { CatalogoResponse, CatalogoRow, Currency, DateRange } from '../../types';

const MAX_ITEMS = 10;
const amountOf = (a: { bs: number; usd: number | null } | null, currency: Currency): number | null =>
  a === null ? null : currency === 'usd' ? a.usd : a.bs;

// "SKUs en caída": the SKUs with the biggest drop in net sales against the previous equal period, within the
// Clientes scope (selected chain or store, grupo, ruta). A SKU with no prior base (null prevNet / trendPct, or a
// zero previous amount) is never listed as a drop. Each row opens Productos on that SKU with the same scope.
export function FallingSkus({ params, dateRange, currency }: { params: ClientesParams; dateRange: DateRange; currency: Currency }) {
  const url = `/api/dwh/productos?${productosScopeQuery(params, dateRange, { section: 'catalogo', nivel: 'sku', currency }).toString()}`;
  const { data, loading, error, retry } = useDwhSection<CatalogoResponse>(url);

  if (error) {
    return (
      <div className="text-sm bg-red-50 border border-red-200 rounded px-4 py-3 flex items-center gap-3">
        <span className="text-red-700">{error}</span>
        <button type="button" onClick={retry} className="px-2 py-1 rounded border border-red-300 bg-white text-red-700">Reintentar</button>
      </div>
    );
  }
  if (!data) return <div className="h-16 flex items-center justify-center text-sm text-gray-600">{loading ? 'Cargando…' : ''}</div>;
  if (data.rows.length === 0) return <p className="text-sm text-gray-700">Sin datos de productos para este alcance.</p>;

  const falling = data.rows
    .filter((r: CatalogoRow) => r.trendPct !== null && r.trendPct < 0 && (amountOf(r.prevNet, currency) ?? 0) > 0)
    .sort((a, b) => (a.trendPct as number) - (b.trendPct as number))
    .slice(0, MAX_ITEMS);
  if (falling.length === 0) return <p className="text-sm text-gray-700">Ningún SKU cae frente al período anterior.</p>;

  const href = (r: CatalogoRow): string => {
    const q = new URLSearchParams({ tab: 'productos', dateRange, nivel: 'sku', q: r.code ?? r.label });
    if (params.tienda) q.set('tienda', params.tienda);
    if (params.grupo) q.set('grupo', params.grupo);
    return `/analitica?${q.toString()}`;
  };

  return (
    <ul className={`divide-y divide-gray-100 text-sm ${loading ? 'opacity-60' : ''}`}>
      {falling.map(r => (
        <li key={r.key} className="py-2 flex items-center justify-between gap-4">
          <a href={href(r)} className="text-blue-800 hover:underline">{r.label}</a>
          <span className="flex items-center gap-4 text-gray-700">
            <span>{moneyLabel(r.salesNet, currency)}</span>
            <span className="text-xs font-medium text-red-700">▼ −{Math.abs((r.trendPct as number) * 100).toFixed(1)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
