'use client';

import type { ReactNode } from 'react';
import type { Dual, RootMetrics, WeekCell, WeekHeader } from '@/lib/seguimiento/types';
import { moneyLabel, priceLabel, usdLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { addDuals, pct, units } from './fmt';
import { goalStatus, StatusBadge, type BadgeStatus } from './status-badge';

const ZERO: Dual = { bs: 0, usd: 0 };
const sumDuals = (items: Dual[]): Dual => items.reduce(addDuals, ZERO);
const avgPrice = (sales: Dual, n: number): Dual | null =>
  n > 0 ? { bs: sales.bs / n, usd: sales.usd === null ? null : sales.usd / n } : null;

interface MatrixRow {
  label: string;
  week: (w: WeekCell) => ReactNode;
  total: ReactNode;
}

function Estimado({ root }: { root: RootMetrics }) {
  // Always USD: the goal is a USD figure, so a Bs. projection beside it would read as a mismatch.
  const quotaUsd = root.salesQuotaUsd;
  const unitsQuota = root.unitsQuota ?? null;
  const projectedUnits = root.projectedUnits ?? null;
  const line = (label: string, value: string, goal: string | null, status: BadgeStatus) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-500 w-40">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
      {goal === null
        ? <span className="text-xs text-gray-500">Sin meta</span>
        : <><span className="text-xs text-gray-500">({goal})</span><StatusBadge status={status} /></>}
    </div>
  );
  return (
    <section aria-label="Estimado" className="space-y-1">
      <h4 className="text-xs font-semibold uppercase text-gray-500">Estimado al cierre del mes</h4>
      {line(
        'Proyección unidades',
        projectedUnits === null ? '—' : units(projectedUnits),
        unitsQuota !== null && unitsQuota > 0 ? `meta ${units(unitsQuota)}` : null,
        goalStatus(projectedUnits, unitsQuota),
      )}
      {line(
        'Proyección USD',
        root.projected ? moneyLabel(root.projected, 'usd') : '—',
        quotaUsd !== null && quotaUsd > 0 ? `meta ${usdLabel(quotaUsd)}` : null,
        goalStatus(root.projected?.usd, quotaUsd),
      )}
    </section>
  );
}

function Categories({ root, currency }: { root: RootMetrics; currency: Currency }) {
  if (root.mix.length === 0) return <div className="text-xs text-gray-400">Sin ventas por categoría.</div>;
  // Same linear projection as the root's, applied to each line's share.
  const factor = root.projected && root.sales.bs > 0 ? root.projected.bs / root.sales.bs : null;
  return (
    <table aria-label="Categorías" className="min-w-full text-xs">
      <thead>
        <tr className="text-gray-500 text-left">
          <th className="pr-4 py-1">Categoría</th>
          <th className="pr-4 py-1 text-right">Brutas</th>
          <th className="pr-4 py-1 text-right">% del total</th>
          <th className="py-1 text-right">Proyección</th>
        </tr>
      </thead>
      <tbody>
        {root.mix.map(s => (
          <tr key={s.line} className="border-t border-gray-100 text-gray-700">
            <th scope="row" className="pr-4 py-1 text-left font-normal">{s.line}</th>
            <td className="pr-4 py-1 text-right">{moneyLabel(s.sales, currency)}</td>
            <td className="pr-4 py-1 text-right">{pct(s.share)}</td>
            <td className="py-1 text-right">
              {factor === null ? '—' : moneyLabel({ bs: s.sales.bs * factor, usd: s.sales.usd === null ? null : s.sales.usd * factor }, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Weekly "Real" block (Sem 1..5 + Total), then the Estimado block and the category list, for one root of any kind.
export function WeeklyMatrix({ root, headers, currency }: {
  root: RootMetrics;
  headers: WeekHeader[];
  currency: Currency;
}) {
  const cur = currency === 'usd' ? 'USD' : 'Bs.';
  const past = root.weeks.filter((_, i) => !(headers[i]?.isFuture ?? false));
  const sales = sumDuals(past.map(w => w.sales));
  const returns = sumDuals(past.map(w => w.returns));
  const net = sumDuals(past.map(w => w.net));
  const soldUnits = past.reduce((s, w) => s + w.units, 0);
  const returnUnits = past.reduce((s, w) => s + w.returnUnits, 0);
  // Month-distinct active customers, counted over the same assigned group as customerCount. A response cached
  // before the field existed has it undefined: show a dash rather than a guess.
  const activeInMonth = typeof root.activeCustomers === 'number' ? root.activeCustomers : null;

  const rows: MatrixRow[] = [
    { label: 'Clientes asignados', week: w => w.assigned, total: root.customerCount },
    { label: 'Clientes activos', week: w => w.active, total: activeInMonth ?? '—' },
    {
      label: '% activos', week: w => pct(w.pct),
      total: pct(activeInMonth !== null && root.customerCount > 0 ? activeInMonth / root.customerCount : null),
    },
    { label: `Brutas ${cur}`, week: w => moneyLabel(w.sales, currency), total: moneyLabel(sales, currency) },
    { label: 'Brutas unidades', week: w => units(w.units), total: units(soldUnits) },
    { label: `Devoluciones ${cur}`, week: w => moneyLabel(w.returns, currency), total: moneyLabel(returns, currency) },
    { label: 'Devoluciones unidades', week: w => units(w.returnUnits), total: units(returnUnits) },
    { label: `Netas ${cur}`, week: w => moneyLabel(w.net, currency), total: moneyLabel(net, currency) },
    { label: 'Netas unidades', week: w => units(w.units - w.returnUnits), total: units(soldUnits - returnUnits) },
    {
      label: 'Precio promedio', week: w => (w.avgPrice ? priceLabel(w.avgPrice, currency) : '—'),
      total: (() => { const p = avgPrice(sales, soldUnits); return p ? priceLabel(p, currency) : '—'; })(),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table aria-label="Real por semana" className="min-w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="pr-4 py-1 text-left font-semibold">Real (brutas, devoluciones y netas)</th>
              {root.weeks.map((w, i) => {
                const h = headers[i];
                return (
                  <th key={w.yearWeek} className="px-2 py-1 text-right" title={h ? `${h.label}: ${h.weekStart} a ${h.weekEnd}${h.isFuture ? ' (futura)' : ''}` : undefined}>
                    Sem {i + 1}
                  </th>
                );
              })}
              <th className="pl-2 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-t border-gray-100 text-gray-700">
                <th scope="row" className="pr-4 py-1 text-left font-normal text-gray-600">{r.label}</th>
                {root.weeks.map((w, i) => (
                  <td key={w.yearWeek} className="px-2 py-1 text-right tabular-nums">
                    {headers[i]?.isFuture ? '' : r.week(w)}
                  </td>
                ))}
                <td className="pl-2 py-1 text-right font-medium text-gray-900 tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-gray-500">La semana actual es parcial; las semanas futuras quedan en blanco.</p>
      </div>
      <Estimado root={root} />
      <section aria-label="Categorías por línea" className="space-y-1">
        <h4 className="text-xs font-semibold uppercase text-gray-500">Categorías (brutas por línea)</h4>
        <Categories root={root} currency={currency} />
      </section>
    </div>
  );
}
