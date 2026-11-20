'use client';

import { useState } from 'react';
import { productosScopeQuery } from '@/lib/clientes/product-url';
import type { ClientesParams } from '../../lib/clientes-params';
import type { Granularity } from '../../lib/granularity';
import { trendClickPatch } from '../../lib/productos-params';
import { useClientesBreakdown } from '../../lib/use-clientes-breakdown';
import { useDwhSection } from '../../lib/use-dwh-section';
import type { CatalogoResponse, Currency, DateRange, UnitsByLineaResponse } from '../../types';
import CustomerAccordion from '../productos/customer-accordion';
import MasterTable from '../productos/master-table';
import TrendCard from '../productos/trend-card';

// Mounted only while its row is expanded, so only open rows fetch (cached per URL in the hook).
function ClientesPanel({ url, currency }: { url: string; currency: Currency }) {
  return <CustomerAccordion state={useClientesBreakdown(url)} currency={currency} />;
}

const NO_KEYS: ReadonlySet<string> = new Set();

// Q1 product view: units by línea / sublínea / SKU over time plus a ranked table with a per-row customer
// accordion, scoped to the selected chain or store, grupo and ruta. Reuses the Productos route, trend card and
// master table, so both tabs read the same numbers.
export function ProductBreakdown({ params, dateRange, granularity, currency, onParams }: {
  params: ClientesParams;
  dateRange: DateRange;
  granularity: Granularity;
  currency: Currency;
  onParams: (patch: Partial<ClientesParams>) => void;
}) {
  const catalogoUrl = `/api/dwh/productos?${productosScopeQuery(params, dateRange, { section: 'catalogo', currency }).toString()}`;
  const trendUrl = `/api/dwh/productos?${productosScopeQuery(params, dateRange, { section: 'porLineaMes', granularity }).toString()}`;
  const catalogo = useDwhSection<CatalogoResponse>(catalogoUrl);
  const trend = useDwhSection<UnitsByLineaResponse>(trendUrl);

  // Expansion belongs to the catalogue it was opened on: any change of scope or filters drops it.
  const [expansion, setExpansion] = useState<{ scope: string; keys: ReadonlySet<string> }>({ scope: '', keys: NO_KEYS });
  const expanded = expansion.scope === catalogoUrl ? expansion.keys : NO_KEYS;
  function toggleRow(key: string) {
    const next = new Set(expanded);
    if (!next.delete(key)) next.add(key);
    setExpansion({ scope: catalogoUrl, keys: next });
  }
  function clientesUrl(key: string): string {
    const q = productosScopeQuery(params, dateRange, { section: 'clientes', currency });
    q.set('key', key);
    return `/api/dwh/productos?${q.toString()}`;
  }

  // A click on a stacked segment drills one level down (línea -> sublíneas -> SKUs). "Otras" does nothing.
  function handleSeriesClick(name: string) {
    const patch = trendClickPatch(trend.data?.nivel ?? params.nivel, trend.data?.seriesMeta?.[name], name);
    if (patch === null) return;
    onParams(patch as Partial<ClientesParams>);
  }

  const drilled = params.lineas.length > 0 || params.sublineas.length > 0 || params.q !== '';

  return (
    <div className="space-y-4">
      {drilled && (
        <div>
          <button
            type="button"
            onClick={() => onParams({ lineas: [], sublineas: [], q: '', nivel: 'linea' })}
            className="text-sm text-blue-800 hover:underline"
          >
            Quitar filtro de producto
          </button>
        </div>
      )}
      <TrendCard
        data={trend.data}
        loading={trend.loading && !trend.data}
        error={trend.error}
        nivel={params.nivel}
        currency={currency}
        onSeriesClick={handleSeriesClick}
      />
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Productos del alcance seleccionado</h3>
        <p className="text-xs text-gray-600 mb-3">Ventas sin IVA; la tendencia compara con el período anterior equivalente.</p>
        <MasterTable
          rows={catalogo.data?.rows ?? []}
          currency={currency}
          metric="ventas"
          nivel={params.nivel}
          loading={catalogo.loading && !catalogo.data}
          error={catalogo.error}
          expandedKeys={expanded}
          onToggleRow={toggleRow}
          renderExpanded={row => <ClientesPanel url={clientesUrl(row.key)} currency={currency} />}
        />
      </div>
    </div>
  );
}
