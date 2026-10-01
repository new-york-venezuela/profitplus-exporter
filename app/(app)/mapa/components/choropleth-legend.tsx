'use client';

import type { Scale } from '@/lib/geo/color-scale';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ChoroplethLegend({ scale }: { scale: Scale }) {
  return (
    <div className="absolute bottom-6 left-3 z-[500] rounded-md bg-white p-3 text-xs text-gray-800 shadow" role="group" aria-label="Leyenda de ingresos por zona">
      <p className="mb-1 font-semibold">Ingresos por zona (USD)</p>
      <ul className="space-y-1">
        {scale.breaks.map(b => (
          <li key={b} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-6 rounded-sm border border-gray-400" style={{ background: scale.colorFor(b) }} />
            <span className="tabular-nums">{usd.format(b)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-gray-500">Clientes según los filtros activos</p>
    </div>
  );
}
