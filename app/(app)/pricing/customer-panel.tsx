'use client';

import type { CustomerPage, FilterOption, SegmentDto } from '@/lib/pricing/client-types';
import type { CustomerSortKey } from '@/lib/pricing/customers-query';
import SearchableSelect from '@/lib/components/searchable-select';

export interface CustomerPanelFilters {
  search: string; zona: string; vendedor: string;
  sort: CustomerSortKey; dir: 'asc' | 'desc'; page: number;
}

interface CustomerPanelProps {
  segment: SegmentDto;
  page: CustomerPage | null;
  loading: boolean;
  error: string | null;
  filters: CustomerPanelFilters;
  onFiltersChange: (patch: Partial<CustomerPanelFilters>) => void;
  zonas: FilterOption[];
  vendedores: FilterOption[];
  selected: Set<string>;
  onToggle: (coCli: string) => void;
  onTogglePage: (all: boolean) => void;
  canEdit: boolean;
  onRepoint: () => void;
  onMove: () => void;
  onSpecial: () => void;
}

const COLUMNS: { key: CustomerSortKey; label: string }[] = [
  { key: 'cliDes', label: 'Cliente' },
  { key: 'coZon', label: 'Zona' },
  { key: 'coVen', label: 'Vendedor' },
  { key: 'ultimoPedido', label: 'Último pedido' },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const BTN = `min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export default function CustomerPanel(props: CustomerPanelProps) {
  const {
    segment, page, loading, error, filters, onFiltersChange, zonas, vendedores,
    selected, onToggle, onTogglePage, canEdit, onRepoint, onMove, onSpecial,
  } = props;

  const customers = page?.customers ?? [];
  const totalPages = page ? Math.max(Math.ceil(page.total / page.pageSize), 1) : 1;
  const hasFilters = Boolean(filters.search || filters.zona || filters.vendedor);
  const allOnPage = customers.length > 0 && customers.every(c => selected.has(c.coCli));
  const someOnPage = customers.some(c => selected.has(c.coCli));

  function sortBy(key: CustomerSortKey) {
    if (filters.sort === key) onFiltersChange({ dir: filters.dir === 'asc' ? 'desc' : 'asc', page: 1 });
    else onFiltersChange({ sort: key, dir: 'asc', page: 1 });
  }

  return (
    <section aria-label={`Clientes de ${segment.desTipo}`} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {segment.desTipo} <span className="font-normal text-gray-600">→ {segment.desPrecio ?? segment.coPrecio}</span>
          </h2>
          <p className="text-sm text-gray-600">
            {segment.customerCount} clientes
            {segment.kind === 'special' && segment.expiresAt && <> · Vence {segment.expiresAt}</>}
          </p>
          {segment.kind === 'special' && segment.reason && (
            <p className="text-sm text-gray-500">{segment.reason}</p>
          )}
        </div>
        {canEdit && (
          <button type="button" onClick={onRepoint} className={BTN}>Cambiar lista</button>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Buscar cliente
          <input
            type="search"
            value={filters.search}
            onChange={e => onFiltersChange({ search: e.target.value, page: 1 })}
            placeholder="Nombre o código"
            className={`rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900 ${FOCUS}`}
          />
        </label>
        <div className="flex w-48 flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Zona</span>
          <SearchableSelect
            value={filters.zona || null}
            onChange={v => onFiltersChange({ zona: v ?? '', page: 1 })}
            options={zonas}
            allLabel="Todas"
            placeholder="Zona"
          />
        </div>
        <div className="flex w-48 flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Vendedor</span>
          <SearchableSelect
            value={filters.vendedor || null}
            onChange={v => onFiltersChange({ vendedor: v ?? '', page: 1 })}
            options={vendedores}
            allLabel="Todos"
            placeholder="Vendedor"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th scope="col" className="w-12 p-0">
                {canEdit && (
                  <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos (página)"
                      checked={allOnPage}
                      ref={el => { if (el) el.indeterminate = someOnPage && !allOnPage; }}
                      disabled={customers.length === 0}
                      onChange={e => onTogglePage(e.target.checked)}
                      className={`h-4 w-4 ${FOCUS}`}
                    />
                  </label>
                )}
              </th>
              {COLUMNS.map(col => {
                const active = filters.sort === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-2"
                  >
                    <button type="button" onClick={() => sortBy(col.key)} className={`inline-flex min-h-[44px] items-center gap-1 font-semibold uppercase ${FOCUS}`}>
                      {col.label}
                      <span aria-hidden="true">{active ? (filters.dir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [0, 1, 2, 3, 4].map(i => (
                <tr key={i} aria-hidden="true">
                  <td colSpan={5} className="px-3 py-3"><div className="h-6 animate-pulse rounded bg-gray-100" /></td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  {!error && (page?.total === 0 || page === null) &&
                    (hasFilters ? 'Ningún cliente coincide con los filtros' : 'Este segmento no tiene clientes')}
                </td>
              </tr>
            ) : (
              customers.map(c => (
                <tr key={c.coCli} className={selected.has(c.coCli) ? 'bg-blue-50' : undefined}>
                  <td className="w-12 p-0">
                    {canEdit && (
                      <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${c.cliDes}`}
                          checked={selected.has(c.coCli)}
                          onChange={() => onToggle(c.coCli)}
                          className={`h-4 w-4 ${FOCUS}`}
                        />
                      </label>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {c.cliDes} <span className="text-xs text-gray-500">{c.coCli}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{c.zonDes ?? c.coZon ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{c.venDes ?? c.coVen ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{c.ultimoPedido ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page && page.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
          <span>Página {page.page} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" className={BTN} disabled={page.page <= 1 || loading} onClick={() => onFiltersChange({ page: page.page - 1 })}>
              Anterior
            </button>
            <button type="button" className={BTN} disabled={page.page >= totalPages || loading} onClick={() => onFiltersChange({ page: page.page + 1 })}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {canEdit && selected.size > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-gray-900">
            {selected.size} {selected.size === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <button type="button" onClick={onMove} className={BTN}>Mover a segmento…</button>
          <button
            type="button"
            onClick={onSpecial}
            disabled={selected.size !== 1}
            title={selected.size !== 1 ? 'Selecciona exactamente un cliente para crear un precio especial' : undefined}
            className={BTN}
          >
            Precio especial
          </button>
          <button type="button" onClick={() => onTogglePage(false)} className={BTN}>Limpiar selección</button>
        </div>
      )}
    </section>
  );
}
