'use client';

import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';
import type { GroupShareMatrix } from '@/lib/productos/group-share';

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function GroupShareMatrixTable({ matrix, currency, rowHeader }: { matrix: GroupShareMatrix; currency: Currency; rowHeader: string }) {
  if (matrix.rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">Sin datos disponibles todavía.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Participación por grupo de cliente">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{rowHeader}</th>
            {matrix.columns.map(c => (
              <th key={c.code} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">{c.name}</th>
            ))}
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {matrix.rows.map(row => (
            <tr key={row.label}>
              <td className="px-3 py-2 text-gray-800">{row.label}</td>
              {matrix.columns.map(c => {
                const cell = row.cells[c.code];
                if (!cell) return <td key={c.code} className="px-3 py-2 text-right text-gray-400">—</td>;
                return (
                  <td
                    key={c.code}
                    className="px-3 py-2 text-right text-gray-900"
                    style={{ backgroundColor: `rgba(37, 99, 235, ${(cell.share * 0.5).toFixed(2)})` }}
                    title={moneyLabel({ bs: cell.salesBs, usd: cell.salesUsd }, currency)}
                  >
                    {pct(cell.share)}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-medium text-gray-900">
                {moneyLabel({ bs: row.totalBs, usd: row.totalUsd }, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
