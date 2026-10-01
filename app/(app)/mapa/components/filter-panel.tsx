'use client';

import SearchableSelect from '@/lib/components/searchable-select';
import { periodOptions, previousMonthRange } from '@/lib/geo/date-range';
import { filterChips, type MapFilters } from '@/lib/geo/filters';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { MapSeller, Pareto, RouteDto } from '@/lib/geo/types';

interface Props {
  filters: MapFilters;
  sellers: MapSeller[];
  routes: RouteDto[];
  areas: AreaDto[];
  onChange: (f: MapFilters) => void;
  onFit: () => void;
  counts: { shown: number; total: number };
}

const fieldLabel = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600';
const controlClass = 'min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function FilterPanel({ filters, sellers, routes, areas, onChange, onFit, counts }: Props) {
  const chips = filterChips(filters, { sellers, routes, areas });
  const visibleRoutes = filters.seller ? routes.filter(r => r.sellerCode === filters.seller) : routes;

  function clear(key: (typeof chips)[number]['key']) {
    const next = { ...filters };
    if (key === 'dateRange') next.dateRange = previousMonthRange();
    if (key === 'seller') next.seller = null;
    if (key === 'route') next.route = null;
    if (key === 'area') next.area = null;
    if (key === 'pareto') next.pareto = null;
    if (key === 'noCoords') next.noCoords = false;
    onChange(next);
  }

  return (
    <section aria-label="Filtros" className="space-y-4 p-4">
      <div>
        <label htmlFor="mapa-periodo" className={fieldLabel}>Período</label>
        <select
          id="mapa-periodo"
          className={controlClass}
          value={filters.dateRange}
          onChange={e => onChange({ ...filters, dateRange: e.target.value })}
        >
          {periodOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <span className={fieldLabel}>Vendedor</span>
        <SearchableSelect
          value={filters.seller}
          onChange={seller => onChange({ ...filters, seller })}
          options={sellers.map(s => ({ value: s.code, label: s.name }))}
          placeholder="Buscar vendedor…"
          allLabel="Todos los vendedores"
        />
      </div>

      <div>
        <span className={fieldLabel}>Ruta</span>
        <SearchableSelect
          value={filters.route === null ? null : String(filters.route)}
          onChange={v => onChange({ ...filters, route: v === null ? null : Number(v) })}
          options={visibleRoutes.map(r => ({ value: String(r.id), label: r.name }))}
          placeholder="Buscar ruta…"
          allLabel="Todas las rutas"
        />
      </div>

      <div>
        <span className={fieldLabel}>Zona</span>
        <SearchableSelect
          value={filters.area === null ? null : String(filters.area)}
          onChange={v => onChange({ ...filters, area: v === null ? null : Number(v) })}
          options={areas.map(a => ({ value: String(a.id), label: a.name }))}
          placeholder="Buscar zona…"
          allLabel="Todas las zonas"
        />
      </div>

      <div>
        <label htmlFor="mapa-segmento" className={fieldLabel}>Segmento (Pareto)</label>
        <select
          id="mapa-segmento"
          className={controlClass}
          value={filters.pareto ?? ''}
          onChange={e => onChange({ ...filters, pareto: (e.target.value || null) as Pareto | null })}
        >
          <option value="">Todos</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={filters.noCoords}
          onChange={e => onChange({ ...filters, noCoords: e.target.checked })}
        />
        Solo clientes sin coordenadas
      </label>

      {chips.length > 0 && (
        <ul aria-label="Filtros activos" className="flex flex-wrap gap-2">
          {chips.map(chip => (
            <li key={chip.key} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-xs text-blue-900">
              {chip.label}
              <button
                type="button"
                onClick={() => clear(chip.key)}
                aria-label={`Quitar filtro ${chip.label}`}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600" aria-live="polite">{counts.shown} de {counts.total} clientes</p>
        <button type="button" onClick={onFit} className="min-h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          Ajustar al resultado
        </button>
      </div>
    </section>
  );
}
