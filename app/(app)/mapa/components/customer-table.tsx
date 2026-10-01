'use client';

import { useMemo, useState } from 'react';
import type { MapCustomer } from '@/lib/geo/types';

type SortKey = 'name' | 'revenueUsd' | 'pareto' | 'seller';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const ISSUE_TEXT: Record<NonNullable<MapCustomer['coordinatesIssue']>, string> = {
  UNPARSEABLE: 'campo1 con formato inválido',
  SWAPPED_SUSPECTED: 'lat/lng invertidas',
  OUT_OF_RANGE: 'fuera de Venezuela',
};

export function CustomerTable({ customers, onSelect }: { customers: MapCustomer[]; onSelect: (coCli: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'revenueUsd', dir: -1 });

  const rows = useMemo(() => {
    const val = (c: MapCustomer) =>
      sort.key === 'name' ? c.name : sort.key === 'pareto' ? c.pareto ?? 'Z' : sort.key === 'seller' ? c.sellerName ?? c.coVen : c.revenueUsd ?? -1;
    return [...customers].sort((a, b) => {
      const [x, y] = [val(a), val(b)];
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * sort.dir;
    });
  }, [customers, sort]);

  function header(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
        <button type="button" className="min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
          {label}{active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
        </button>
      </th>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <table className="min-w-full text-sm" aria-label="Clientes">
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            {header('name', 'Cliente')}
            {header('seller', 'Vendedor')}
            {header('revenueUsd', 'Ingresos (USD)')}
            {header('pareto', 'Segmento')}
            <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Zona</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Ubicación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(c => (
            <tr key={c.coCli} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <button type="button" className="min-h-11 text-left font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => onSelect(c.coCli)}>
                  {c.name}
                </button>
                <span className="block text-xs text-gray-500">{c.coCli}</span>
              </td>
              <td className="px-3 py-2">{c.sellerName ?? c.coVen}</td>
              <td className="px-3 py-2 tabular-nums">{c.revenueUsd === null ? 'Sin tasa' : usd.format(c.revenueUsd)}</td>
              <td className="px-3 py-2">{c.pareto ?? '—'}</td>
              <td className="px-3 py-2">
                {c.areaName ?? '—'}
                {c.sellerMismatch && <span className="block text-xs text-amber-800">⚠ vendedor distinto</span>}
              </td>
              <td className="px-3 py-2">
                {c.lat !== null ? `${c.lat.toFixed(5)}, ${c.lng!.toFixed(5)}` : (
                  <span className="text-amber-800">{c.coordinatesIssue ? ISSUE_TEXT[c.coordinatesIssue] : 'Sin coordenadas'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Ningún cliente coincide con los filtros.</p>}
    </div>
  );
}
