'use client';

import type { MapCustomer } from '@/lib/geo/types';

const REASON: Record<NonNullable<MapCustomer['coordinatesIssue']>, string> = {
  UNPARSEABLE: 'campo1 con formato inválido', SWAPPED_SUSPECTED: 'lat/lng invertidas', OUT_OF_RANGE: 'fuera de Venezuela',
};

export function UnlocatedList({ customers, onLocate }: { customers: MapCustomer[]; onLocate: (coCli: string) => void }) {
  if (customers.length === 0) return <p className="p-4 text-sm text-gray-500">Todos los clientes tienen ubicación.</p>;
  return (
    <ul aria-label="Clientes sin ubicación" className="divide-y divide-gray-100">
      {customers.map(c => (
        <li key={c.coCli} className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
            <p className="truncate text-xs text-gray-500">{c.coordinatesIssue ? REASON[c.coordinatesIssue] : (c.dirEnt2 ?? c.direc1 ?? 'Sin dirección')}</p>
          </div>
          <button type="button" onClick={() => onLocate(c.coCli)} className="min-h-11 shrink-0 rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            Ubicar
          </button>
        </li>
      ))}
    </ul>
  );
}
