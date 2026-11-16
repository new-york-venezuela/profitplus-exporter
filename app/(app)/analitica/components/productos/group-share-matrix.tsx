'use client';

import { moneyLabel, qty } from '../../lib/format';
import { pct } from '../../lib/productos-format';
import type { Metric } from '../../lib/productos-params';
import type { Currency } from '../../types';
import type { GroupShareMatrix } from '@/lib/productos/group-share';

interface Props {
  matrix: GroupShareMatrix;
  currency: Currency;
  metric: Metric;
  rowHeader: string;
  open: boolean;
  onToggle: () => void;
}

function amount(bs: number, usd: number | null, currency: Currency): string {
  if (currency === 'usd' && usd === null) return 'Sin datos';
  return moneyLabel({ bs, usd }, currency);
}

export function GroupShareMatrixTable({ matrix, currency, metric, rowHeader, open, onToggle }: Props) {
  const cols = [...matrix.columns].sort((a, b) =>
    metric === 'unidades' ? b.units - a.units : b.salesBs - a.salesBs);
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mb-2 text-xs font-medium text-blue-700 hover:underline"
      >
        {open ? 'Ocultar matriz' : 'Mostrar matriz'}
      </button>
      {open && (matrix.rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">Sin datos disponibles todavía.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" aria-label="Participación por grupo de cliente">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{rowHeader}</th>
                {cols.map(c => (
                  <th key={c.code} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">{c.name}</th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matrix.rows.map(row => (
                <tr key={row.label}>
                  <td className="px-3 py-2 text-gray-800">{row.label}</td>
                  {cols.map(c => {
                    const cell = row.cells[c.code];
                    if (!cell) return <td key={c.code} className="px-3 py-2 text-right text-gray-400">—</td>;
                    const share = metric === 'unidades' ? cell.unitShare : cell.share;
                    const value = metric === 'unidades' ? qty(cell.units) : amount(cell.salesBs, cell.salesUsd, currency);
                    return (
                      <td
                        key={c.code}
                        className="px-3 py-2 text-right"
                        style={{ backgroundColor: `rgba(37, 99, 235, ${(share * 0.35).toFixed(3)})` }}
                      >
                        <div className="font-bold text-gray-900">{value}</div>
                        <div className="text-xs text-gray-600">{pct(share)}</div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold text-gray-900">
                    {metric === 'unidades' ? qty(row.totalUnits) : amount(row.totalBs, row.totalUsd, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
