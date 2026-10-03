'use client';

import { useMemo } from 'react';
import type { GridRow } from '@/lib/pricing/client-types';
import type { BulkOp, Staged } from '@/lib/pricing/rates-staging';
import { rowIdentityKey } from '@/lib/pricing/rates-staging';
import { FOCUS, PctCell, PriceCell, fmt } from './rate-cells';
import { BulkBar } from './rates-grid';

export interface PromoItemsGridProps {
  /** Rows already mapped so that `referenceMonto` is the CURRENT price (the promotion's reference). */
  rows: GridRow[];
  staged: Staged;
  onStage: (coArt: string, monto: number | null) => void;
  selected: Set<string>;
  onToggle: (coArt: string) => void;
  onToggleAll: (visible: string[], all: boolean) => void;
  onBulk: (op: BulkOp) => void;
  search: string;
  onSearchChange: (v: string) => void;
  showUnpriced: boolean;
  onShowUnpricedChange: (v: boolean) => void;
  discardNonce: number;
  currency: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const BTN = `min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS}`;

export default function PromoItemsGrid(p: PromoItemsGridProps) {
  const visible = useMemo(() => {
    const q = p.search.trim().toLowerCase();
    return p.rows
      .filter(r => (p.showUnpriced || r.current !== null || p.staged[r.coArt] !== undefined)
        && (!q || r.coArt.toLowerCase().includes(q) || r.artDes.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => a.artDes.localeCompare(b.artDes, 'es'));
  }, [p.rows, p.search, p.showUnpriced, p.staged]);

  const selectable = visible.filter(r => r.current !== null && !r.ambiguous).map(r => r.coArt);
  const allSelected = selectable.length > 0 && selectable.every(c => p.selected.has(c));
  const stagedCount = useMemo(
    () => p.rows.filter(r => r.current !== null && !r.ambiguous && p.staged[r.coArt] !== undefined).length,
    [p.rows, p.staged],
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {p.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{p.error}</span>
          <button type="button" onClick={p.onRetry} className={`${BTN} border-red-300 text-red-700`}>Reintentar</button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <input
          type="search"
          aria-label="Buscar artículo"
          placeholder="Buscar artículo"
          value={p.search}
          onChange={e => p.onSearchChange(e.target.value)}
          className={`min-h-[44px] w-64 rounded-md border border-gray-300 px-3 py-2 text-sm ${FOCUS}`}
        />
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={p.showUnpriced} onChange={e => p.onShowUnpricedChange(e.target.checked)}
            className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
          Mostrar artículos sin precio
        </label>
      </div>

      {p.selected.size > 0 && <BulkBar count={p.selected.size} onBulk={p.onBulk} />}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Artículos con precio en la lista elegida</caption>
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th scope="col" className="w-12 px-2">
                <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                  <input type="checkbox" aria-label="Seleccionar todos los artículos visibles" checked={allSelected}
                    disabled={selectable.length === 0} onChange={e => p.onToggleAll(selectable, e.target.checked)}
                    className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
                </label>
              </th>
              <th scope="col" className="px-3 py-2">Artículo</th>
              <th scope="col" className="px-3 py-2 text-right">Precio regular{p.currency ? ` (${p.currency})` : ''}</th>
              <th scope="col" className="px-3 py-2 text-right">Precio promo</th>
              <th scope="col" className="px-3 py-2 text-right">Δ% vs regular</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {p.loading ? (
              [0, 1, 2, 3, 4].map(i => (
                <tr key={i} aria-hidden="true"><td colSpan={5} className="px-3 py-2"><div className="h-8 animate-pulse rounded bg-gray-100" /></td></tr>
              ))
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                {p.rows.length === 0 ? 'Esta lista no tiene artículos' : 'No hay artículos que coincidan con el filtro'}
              </td></tr>
            ) : visible.map(r => {
              const selectableRow = r.current !== null && !r.ambiguous;
              return (
                <tr key={r.coArt} className={p.selected.has(r.coArt) ? 'bg-blue-50' : undefined}>
                  <td className="px-2">
                    <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                      <input type="checkbox" aria-label={`Seleccionar ${r.artDes}`} checked={p.selected.has(r.coArt)}
                        disabled={!selectableRow} onChange={() => p.onToggle(r.coArt)}
                        className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">{r.coArt}</span>
                      <span className="font-medium text-gray-900">{r.artDes}</span>
                      {r.ambiguous && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">varios almacenes</span>}
                      {r.current === null && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">sin precio</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.current ? fmt(r.current.monto) : '—'}</td>
                  <td className="px-3 py-2"><PriceCell key={rowIdentityKey(r, p.discardNonce)} row={r} staged={p.staged} onStage={p.onStage} readOnly={!selectableRow} /></td>
                  <td className="px-3 py-2"><PctCell key={rowIdentityKey(r, p.discardNonce)} row={r} staged={p.staged} onStage={p.onStage} readOnly={!selectableRow} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p aria-live="polite" className="text-sm font-medium text-gray-900">
        {stagedCount} {stagedCount === 1 ? 'artículo con precio promocional' : 'artículos con precio promocional'}
      </p>
    </div>
  );
}
