'use client';

import { useState } from 'react';
import { frequencyLabel, selectUnbilled } from '@/lib/seguimiento/unbilled';
import type { SeguimientoCustomer } from '@/lib/seguimiento/types';

const CARDS_COLLAPSED = 10;

function lastSale(c: SeguimientoCustomer): string {
  const v = c.visit;
  if (!c.lastInvoiceDate || v.daysSinceLastInvoice === null) return 'Nunca ha comprado';
  return `${c.lastInvoiceDate} · hace ${v.daysSinceLastInvoice} d`;
}

function overdueText(c: SeguimientoCustomer): string {
  return c.visit.status === 'overdue' ? `+${c.visit.daysOverdue} d` : '—';
}

// Screen: cards (scannable, wrap on narrow widths). Print: one compact table (cards waste paper).
export function UnbilledSection({ customers, asOf }: { customers: SeguimientoCustomer[]; asOf: string }) {
  const [showAll, setShowAll] = useState(false);
  const { rows, withFrequency, skippedNoFrequency } = selectUnbilled(customers);
  const shown = showAll ? rows : rows.slice(0, CARDS_COLLAPSED);

  return (
    <section aria-label="Clientes sin facturar" className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-auto">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-gray-900">Clientes sin facturar en su período</h2>
        <p role="status" className="text-xs text-gray-600">
          {rows.length === 0
            ? 'Todos los clientes con frecuencia facturaron dentro de su período.'
            : `${rows.length} de ${withFrequency} clientes con frecuencia · ${Math.round((rows.length / withFrequency) * 100)} % de la cartera`}
        </p>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Sin factura dentro de su frecuencia de visita (semanal 7 d, quincenal 15 d, mensual 30 d) al {asOf}. Los más atrasados primero.
      </p>

      {rows.length > 0 && (
        <>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 print:hidden">
            {shown.map(c => (
              <li key={c.customerCode} className="border border-gray-200 rounded-md px-3 py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.customerName}</div>
                  <div className="text-xs text-gray-600">Última venta: {lastSale(c)}</div>
                  <div className="text-xs text-gray-500">
                    {frequencyLabel(c.visit.intervalDays)}{c.routeLabel ? ` · ${c.routeLabel}` : ''}
                  </div>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                  c.visit.status === 'overdue' && (c.visit.daysOverdue ?? 0) > 7 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {c.visit.status === 'overdue' ? `Vencido ${overdueText(c)}` : 'Sin compras'}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > CARDS_COLLAPSED && (
            <button onClick={() => setShowAll(s => !s)} className="mt-2 text-xs text-blue-600 hover:underline print:hidden">
              {showAll ? `Ver solo los ${CARDS_COLLAPSED} más atrasados` : `Ver los ${rows.length}`}
            </button>
          )}

          <table className="hidden print:table w-full mt-3 text-[10pt] border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-800">
                <th className="py-1 pr-2 w-8">#</th>
                <th className="py-1 pr-2">Cliente</th>
                <th className="py-1 pr-2">Ruta</th>
                <th className="py-1 pr-2">Frecuencia</th>
                <th className="py-1 pr-2">Última factura</th>
                <th className="py-1 pr-2 text-right">Días sin facturar</th>
                <th className="py-1 text-right">Vencido por</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.customerCode} className="border-b border-gray-300 break-inside-avoid">
                  <td className="py-1 pr-2">{i + 1}</td>
                  <td className="py-1 pr-2">{c.customerName}</td>
                  <td className="py-1 pr-2">{c.routeLabel ?? '—'}</td>
                  <td className="py-1 pr-2">{frequencyLabel(c.visit.intervalDays)}</td>
                  <td className="py-1 pr-2">{c.lastInvoiceDate ?? 'Nunca'}</td>
                  <td className="py-1 pr-2 text-right">{c.visit.daysSinceLastInvoice ?? '—'}</td>
                  <td className="py-1 text-right font-semibold">{overdueText(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {skippedNoFrequency > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {skippedNoFrequency} {skippedNoFrequency === 1 ? 'cliente' : 'clientes'} sin frecuencia de visita no se evalúan.
        </p>
      )}
    </section>
  );
}
