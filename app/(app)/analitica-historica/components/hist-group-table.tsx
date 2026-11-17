import type { Currency, HistGroupRow } from '../types';
import { histMoney } from '../lib/format';

const nf = (n: number) => n.toLocaleString('es-VE');

// Flat drilldown table: gross, returns, net (signed, never clamped), return rate and units.
export function HistGroupTable({
  rows, currency, firstColumnLabel, onRowClick,
}: {
  rows: HistGroupRow[];
  currency: Currency;
  firstColumnLabel: string;
  onRowClick?: (row: HistGroupRow) => void;
}) {
  return (
    <div className="overflow-x-auto bg-white border border-gray-300 rounded-lg shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{firstColumnLabel}</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas brutas</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Devoluciones</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr
              key={row.value}
              className={`${i % 2 === 1 ? 'bg-gray-50' : ''} ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <td className="px-3 py-2 text-gray-800">{row.label}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-medium">{histMoney(row.salesGross, currency)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{histMoney(row.returns, currency)}</td>
              <td className="px-3 py-2 text-right text-gray-900">{histMoney(row.salesNet, currency)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'}</td>
              <td className="px-3 py-2 text-right text-gray-600">{nf(row.units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
