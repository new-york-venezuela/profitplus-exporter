'use client';

import { useState } from 'react';
import { moneyLabel, priceLabel, qty } from '../../lib/format';
import { pct, signedPct } from '../../lib/productos-format';
import type { ClientesBreakdownState } from '../../lib/use-clientes-breakdown';
import type { ClienteRow, Currency, DualAmount } from '../../types';
import { RETURN_RATE_WARN } from '@/lib/productos/thresholds';
import { OVERDUE_FACTOR, OVERDUE_LOOKBACK_MONTHS, OVERDUE_MIN_ORDERS, RETURN_WARN_MULTIPLE } from '@/lib/productos/customer-breakdown';

const OVERDUE_LEGEND = `Vencido = más de ${OVERDUE_FACTOR} veces el intervalo promedio entre pedidos del cliente para este ítem (últimos ${OVERDUE_LOOKBACK_MONTHS} meses, mínimo ${OVERDUE_MIN_ORDERS} pedidos). Sin historial = menos de ${OVERDUE_MIN_ORDERS} pedidos.`;

type Pill = 'todos' | 'alta' | 'vencido';

// Null USD (no rate) is "Sin datos", never $0.
function amountText(amount: DualAmount, currency: Currency, format = moneyLabel): string {
  return (currency === 'usd' ? amount.usd : amount.bs) === null ? 'Sin datos' : format(amount, currency);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function OverdueCell({ row }: { row: ClienteRow }) {
  if (row.overdue === null) return <span className="text-gray-500">Sin historial</span>;
  return (
    <div>
      {row.overdue && (
        <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
          <span aria-hidden="true">⚠</span>Vencido
        </span>
      )}
      {row.daysSinceLastOrder !== null && (
        <div className="text-xs text-gray-700">Hace {plural(row.daysSinceLastOrder, 'día', 'días')}</div>
      )}
      {row.lastOrderDate && <div className="text-xs text-gray-500 tabular-nums">{row.lastOrderDate}</div>}
    </div>
  );
}

export default function CustomerAccordion({ state, currency }: { state: ClientesBreakdownState; currency: Currency }) {
  const [pill, setPill] = useState<Pill>('todos');

  if (state.status === 'idle' || state.status === 'loading') {
    return <div className="px-4 py-6 text-sm text-gray-500">Cargando clientes…</div>;
  }
  if (state.status === 'error') {
    return <p role="alert" className="m-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{state.error}</p>;
  }

  const { data } = state;
  const highCount = data.rows.filter(r => r.highReturn).length;
  const overdueCount = data.rows.filter(r => r.overdue === true).length;
  const rows = pill === 'alta' ? data.rows.filter(r => r.highReturn)
    : pill === 'vencido' ? data.rows.filter(r => r.overdue === true)
      : data.rows;
  const pills: { id: Pill; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: data.rows.length },
    { id: 'alta', label: `Alta devolución (>${Math.round(RETURN_RATE_WARN * 100)} %)`, count: highCount },
    { id: 'vencido', label: 'Vencido / en riesgo', count: overdueCount },
  ];

  return (
    <div className="px-4 py-3">
      {data.top3SharePct !== null && (
        <p className="mb-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Los 3 principales clientes concentran {pct(data.top3SharePct)} de las ventas netas de este ítem
        </p>
      )}
      <div role="group" aria-label="Filtrar clientes" className="mb-3 flex flex-wrap gap-2">
        {pills.map(p => (
          <button
            key={p.id}
            type="button"
            aria-pressed={pill === p.id}
            onClick={() => setPill(p.id)}
            className={`rounded-full border px-3 py-1 text-xs ${pill === p.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
          >
            {p.label} ({p.count})
          </button>
        ))}
      </div>
      <p data-testid="overdue-legend" className="mb-3 text-xs text-gray-600">{OVERDUE_LEGEND}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">Ningún cliente coincide con este filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs" aria-label="Clientes del ítem">
            <thead>
              <tr className="border-b border-gray-200 text-left uppercase text-gray-600">
                <th className="px-2 py-1.5">Cliente</th>
                <th className="px-2 py-1.5 text-right" title="Tiendas que lo compraron / tiendas del cliente">Tiendas</th>
                <th className="px-2 py-1.5 text-right">Ventas netas</th>
                <th className="px-2 py-1.5 text-right">Unidades</th>
                <th className="px-2 py-1.5 text-right">Precio prom.</th>
                <th className="px-2 py-1.5 text-right">Devolución</th>
                <th className="px-2 py-1.5 text-right">Pedidos</th>
                <th className="px-2 py-1.5" title={OVERDUE_LEGEND}>Última compra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.id} data-testid="cliente-row" className="align-top">
                  <td className="px-2 py-1.5">
                    <span data-name className="font-medium text-gray-800">{r.name}</span>
                    {r.group && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{r.group.name}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.posItem} / {r.posTotal}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <div className="font-medium text-gray-900">{amountText(r.net, currency)}</div>
                    {r.sharePct !== null && <div className="text-gray-500">{signedPct(r.sharePct)}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{qty(r.units)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.units === 0 ? 'Sin datos' : amountText(r.avgPrice, currency, priceLabel)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.returnRate === null ? <span className="text-gray-400">—</span> : pct(r.returnRate)}
                    {r.returnWarn && (
                      <span
                        role="img"
                        aria-label={`Devolución más de ${RETURN_WARN_MULTIPLE} veces el promedio del ítem`}
                        title={`Devolución más de ${RETURN_WARN_MULTIPLE} veces el promedio del ítem`}
                        className="ml-1 text-amber-600"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.orders}</td>
                  <td className="px-2 py-1.5"><OverdueCell row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
