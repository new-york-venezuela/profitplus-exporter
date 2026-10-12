'use client';

import { moneyLabel } from '../../lib/format';
import type { Currency, ProfundidadLineaRow } from '../../types';
import type { DepthTier } from '@/lib/dwh/depth-tier';

const TIER_LABEL: Record<DepthTier, string> = {
  primera: 'Primera línea',
  segunda: 'Segunda línea',
  addon: 'Addon',
  'sin-ventas': 'Sin ventas',
};
const TIER_CLASS: Record<DepthTier, string> = {
  primera: 'bg-green-100 text-green-800',
  segunda: 'bg-blue-100 text-blue-800',
  addon: 'bg-gray-100 text-gray-600',
  'sin-ventas': 'bg-gray-50 text-gray-400',
};

function pct(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`;
}
function qty(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n);
}

export function DepthTable({ rows, currency }: { rows: ProfundidadLineaRow[]; currency: Currency }) {
  if (rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">Sin datos disponibles todavía.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Presencia por producto">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Clientes</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tiendas</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase" title="Primera línea: lo compra al menos el 70% de los clientes activos; segunda línea: al menos el 30%.">Clasificación</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Precio prom./mes</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades prom./mes</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={`${row.sku}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="px-3 py-2 text-gray-800">{row.sku}</td>
              <td className="px-3 py-2 text-right text-gray-600">
                {qty(row.clientCount)} <span className="text-gray-400">({pct(row.clientShare)})</span>
              </td>
              <td className="px-3 py-2 text-right text-gray-600">
                {qty(row.storeCount)} <span className="text-gray-400">({pct(row.storeShare)})</span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${TIER_CLASS[row.tier]}`}>{TIER_LABEL[row.tier]}</span>
              </td>
              <td className="px-3 py-2 text-right text-gray-600">{moneyLabel(row.avgMonthlyPrice, currency)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{qty(row.avgMonthlyUnits)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{pct(row.returnRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
