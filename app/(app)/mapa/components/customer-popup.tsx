'use client';

import type { MapCustomer, RouteDto } from '@/lib/geo/types';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CustomerPopup({
  customer, routes, onEditLocation, onChangeSeller,
}: { customer: MapCustomer; routes: RouteDto[]; onEditLocation: (coCli: string) => void; onChangeSeller: (coCli: string) => void }) {
  const customerRoutes = routes.filter(r => customer.routeIds.includes(r.id));
  return (
    <div className="min-w-56 max-w-72 text-sm text-gray-800">
      <p className="font-semibold text-gray-900">{customer.name}</p>
      <p className="text-xs text-gray-500">{customer.coCli}{customer.rif ? ` · ${customer.rif}` : ''}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-gray-500">Ingresos</dt>
        <dd className="font-medium">{customer.revenueUsd === null ? 'Sin tasa' : usd.format(customer.revenueUsd)}</dd>
        <dt className="text-gray-500">Segmento</dt>
        <dd>{customer.pareto ?? 'Sin ventas'}</dd>
        <dt className="text-gray-500">Vendedor</dt>
        <dd>{customer.sellerName ?? customer.coVen}</dd>
        <dt className="text-gray-500">Zona</dt>
        <dd>{customer.areaName ?? 'Sin zona'}</dd>
        <dt className="text-gray-500">Entrega</dt>
        <dd>{customer.dirEnt2 ?? customer.direc1 ?? '—'}</dd>
        <dt className="text-gray-500">Rutas</dt>
        <dd>{customerRoutes.length ? customerRoutes.map(r => r.name).join(', ') : '—'}</dd>
      </dl>
      {customer.sellerMismatch && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900" role="note">
          Vendedor distinto al de la zona ({customer.areaSellerCodes.join(', ')})
        </p>
      )}
      <button
        type="button"
        onClick={() => onEditLocation(customer.coCli)}
        className="mt-3 min-h-11 w-full rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        Editar ubicación
      </button>
      <button
        type="button"
        onClick={() => onChangeSeller(customer.coCli)}
        className="mt-2 min-h-11 w-full rounded-md border border-gray-400 px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        Cambiar vendedor
      </button>
    </div>
  );
}
