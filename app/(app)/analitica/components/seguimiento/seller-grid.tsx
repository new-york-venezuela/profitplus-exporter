'use client';

import type { ReactNode } from 'react';
import { gridStatus } from '@/lib/seguimiento/grid-status';
import type { RootKind, RootMetrics, SeguimientoRoot } from '@/lib/seguimiento/types';
import { moneyLabel, priceLabel, usdLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { pct, units } from './fmt';
import { StatusBadge } from './status-badge';

const ROOT_HEADER: Record<RootKind, string> = { vendedor: 'Vendedor', ruta: 'Ruta', grupo: 'Grupo de cliente' };

// The current week is the last one that is not in the future; future cells carry pct = null.
// The total is used so every row reads the same week, even a root with no assigned customers.
function currentWeekIndex(total: RootMetrics): number {
  return total.weeks.reduce((last, w, i) => (w.pct === null ? last : i), -1);
}

const muted = (text: ReactNode) => <div className="text-[11px] text-gray-500">{text}</div>;

function MetricCells({ m, withGoals, weekIdx, currency }: {
  m: RootMetrics; withGoals: boolean; weekIdx: number; currency: Currency;
}) {
  // Goals are in USD and measured against brutas, at the month-end projection.
  const salesStatus = gridStatus(m.projected?.usd ?? null, m.salesQuotaUsd);
  const unitsQuota = m.unitsQuota ?? null;
  const hasUnitsGoal = unitsQuota !== null && unitsQuota > 0;
  const unitsStatus = gridStatus(m.projectedUnits ?? null, unitsQuota);
  const week = weekIdx >= 0 ? m.weeks[weekIdx] : undefined;
  const nc = m.newCustomers;
  return (
    <>
      <td className="px-3 py-2 text-right align-top">
        <div className="font-medium text-gray-900">{moneyLabel(m.sales, currency)}</div>
        {withGoals && (
          <div className="mt-0.5 flex flex-col items-end gap-0.5">
            <StatusBadge status={salesStatus} title="Proyección del mes frente a la meta de ventas brutas (USD)" />
            {m.salesQuotaUsd !== null && m.salesQuotaUsd > 0 && muted(`Meta ${usdLabel(m.salesQuotaUsd)}`)}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top">
        <div>{moneyLabel(m.returns, currency)}</div>
        {muted(pct(m.returnRate))}
      </td>
      <td className="px-3 py-2 text-right align-top">{moneyLabel(m.net, currency)}</td>
      <td className="px-3 py-2 text-right align-top">
        <div className="font-medium text-gray-900">{hasUnitsGoal ? `${units(m.units)} / ${units(unitsQuota)}` : units(m.units)}</div>
        {withGoals && <div className="mt-0.5 flex justify-end"><StatusBadge status={unitsStatus} title="Proyección de unidades frente a la meta" /></div>}
        {muted(`dev. ${units(m.returnUnits)} · netas ${units(m.netUnits)}`)}
      </td>
      <td className="px-3 py-2 text-right align-top">{week ? `${week.active} / ${week.assigned}` : '—'}</td>
      <td className="px-3 py-2 text-right align-top">
        {nc.quota !== null && withGoals ? `${nc.count} / ${nc.quota}` : nc.count}
        {withGoals && nc.quota === null && muted('Sin meta')}
      </td>
      <td className="px-3 py-2 text-right align-top">{m.avgPrice ? priceLabel(m.avgPrice, currency) : '—'}</td>
      <td className="px-3 py-2 text-right align-top">{m.projected ? moneyLabel(m.projected, currency) : '—'}</td>
    </>
  );
}

export function SellerGrid({ roots, total, kind, currency, selected, onSelect }: {
  roots: SeguimientoRoot[];
  total: RootMetrics;
  kind: RootKind;
  currency: Currency;
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  const weekIdx = currentWeekIndex(total);
  // Goals exist per seller and in the Total row only (a seller's goal covers their whole portfolio).
  const rootsHaveGoals = kind === 'vendedor';
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table aria-label="Cuadrícula de seguimiento" className="min-w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-left">
            <th className="px-3 py-2">{ROOT_HEADER[kind]}</th>
            <th className="px-3 py-2 text-right">Brutas</th>
            <th className="px-3 py-2 text-right">Devoluciones</th>
            <th className="px-3 py-2 text-right">Netas</th>
            <th className="px-3 py-2 text-right">Unidades</th>
            <th className="px-3 py-2 text-right" title="Semana actual: clientes con factura / asignados">Clientes activos</th>
            <th className="px-3 py-2 text-right">Nuevos</th>
            <th className="px-3 py-2 text-right">Precio prom.</th>
            <th className="px-3 py-2 text-right" title="Proyección lineal de ventas brutas al cierre del mes">Proyección</th>
          </tr>
        </thead>
        <tbody>
          {roots.map(r => {
            const isSelected = selected === r.value;
            return (
              <tr
                key={r.value}
                onClick={() => onSelect(r.value)}
                className={`border-t border-gray-100 text-gray-700 cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <th scope="row" className="px-3 py-2 text-left font-normal align-top">
                  {/* The click bubbles to the row; the button gives keyboard access and announces the selection. */}
                  <button type="button" aria-pressed={isSelected} className="text-left font-medium text-blue-700 hover:underline">
                    {r.label}
                  </button>
                  {kind === 'vendedor' && r.routeLabels.length > 0 && muted(r.routeLabels.join(', '))}
                </th>
                <MetricCells m={r} withGoals={rootsHaveGoals} weekIdx={weekIdx} currency={currency} />
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-200 bg-gray-50 text-gray-700">
            <th scope="row" className="px-3 py-2 text-left font-semibold text-gray-900 align-top">Total</th>
            <MetricCells m={total} withGoals weekIdx={weekIdx} currency={currency} />
          </tr>
        </tbody>
      </table>
      {!rootsHaveGoals && (
        <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-100">
          Las metas se definen por vendedor: las filas de {ROOT_HEADER[kind].toLowerCase()} no tienen meta ni estado; el Total sí.
        </p>
      )}
    </div>
  );
}
