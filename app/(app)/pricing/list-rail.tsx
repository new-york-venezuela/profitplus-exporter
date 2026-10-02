'use client';

import type { PriceListDto } from '@/lib/pricing/client-types';

interface ListRailProps {
  lists: PriceListDto[];
  selected: string | null;
  onSelect: (coPrecio: string) => void;
  onNew: () => void;
  canEdit: boolean;
  loading: boolean;
  showEmpty: boolean;
  onToggleEmpty: (v: boolean) => void;
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

export default function ListRail({ lists, selected, onSelect, onNew, canEdit, loading, showEmpty, onToggleEmpty }: ListRailProps) {
  const visible = lists.filter(l => showEmpty || !l.isEmpty || l.coPrecio === selected);

  return (
    <nav aria-label="Listas de precio" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Listas</h2>
        {canEdit && (
          <button
            type="button"
            onClick={onNew}
            className={`min-h-[44px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-offset-2 ${FOCUS}`}
          >
            + Nueva lista
          </button>
        )}
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={showEmpty}
          onChange={e => onToggleEmpty(e.target.checked)}
          className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`}
        />
        Mostrar listas vacías o anuladas
      </label>
      {loading ? (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando listas">
          {[0, 1, 2, 3].map(i => (
            <li key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">No hay listas de precio</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {visible.map(l => {
            const isSelected = l.coPrecio === selected;
            return (
              <li key={l.coPrecio}>
                <button
                  type="button"
                  onClick={() => onSelect(l.coPrecio)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left ${FOCUS} ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="block w-full truncate text-sm font-medium text-gray-900">
                    {l.coPrecio} · {l.desPrecio}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {l.coMone ?? 'Sin moneda'} · {l.rateCount} tarifas
                  </span>
                  <span className="block text-xs text-gray-500">
                    {l.segmentCount} segmentos / {l.customerCount} clientes
                    {l.isEmpty ? ' · vacía' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
