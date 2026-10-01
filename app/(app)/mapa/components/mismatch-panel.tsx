'use client';

import { findDiscrepancies } from '@/lib/geo/discrepancies';
import type { MapCustomer, MapSeller } from '@/lib/geo/types';

interface Props { customers: MapCustomer[]; hasAreas: boolean; sellers: MapSeller[]; onFocus: (coCli: string) => void }

const btn = 'min-h-11 shrink-0 rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function MismatchPanel({ customers, hasAreas, sellers, onFocus }: Props) {
  const { mismatched, outside } = findDiscrepancies(customers, hasAreas);
  const sellerName = (code: string) => sellers.find(s => s.code === code)?.name ?? code;

  if (!hasAreas) return <p className="p-4 text-sm text-gray-500">Defina zonas para ver discrepancias.</p>;

  return (
    <div>
      <h3 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-600">Vendedor distinto al de la zona ({mismatched.length})</h3>
      {mismatched.length === 0 ? <p className="px-4 py-2 text-sm text-gray-500">Sin discrepancias.</p> : (
        <ul aria-label="Clientes con vendedor distinto al de la zona" className="divide-y divide-gray-100">
          {mismatched.map(c => (
            <li key={c.coCli} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {c.sellerName ?? c.coVen} · zona «{c.areaName}» ({c.areaSellerCodes.map(sellerName).join(', ')})
                </p>
              </div>
              <button type="button" className={btn} onClick={() => onFocus(c.coCli)}>Ver</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-600">Fuera de toda zona ({outside.length})</h3>
      {outside.length === 0 ? <p className="px-4 py-2 text-sm text-gray-500">Todos los clientes ubicados están en una zona.</p> : (
        <ul aria-label="Clientes fuera de toda zona" className="divide-y divide-gray-100">
          {outside.map(c => (
            <li key={c.coCli} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                <p className="truncate text-xs text-gray-500">{c.sellerName ?? c.coVen}</p>
              </div>
              <button type="button" className={btn} onClick={() => onFocus(c.coCli)}>Ver</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
