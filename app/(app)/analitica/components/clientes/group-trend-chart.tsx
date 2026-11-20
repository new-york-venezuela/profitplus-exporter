'use client';

import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { ClientesTrendGrupoResponse } from '@/lib/clientes/grupo-trend';
import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569'];
const colorOf = (i: number, code: string) => (code === '__otras' ? '#9ca3af' : COLORS[i % COLORS.length]);

// Sales per bucket stacked by customer grupo, in the active currency. An unknown USD amount is a gap in the
// chart and a dash in the table, never zero.
export function GroupTrendChart({ data, currency, loading, error, onRetry }: {
  data: ClientesTrendGrupoResponse | null;
  currency: Currency;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [asTable, setAsTable] = useState(false);

  if (error) {
    return (
      <div className="text-sm bg-red-50 border border-red-200 rounded px-4 py-3 flex items-center gap-3">
        <span className="text-red-700">{error}</span>
        <button type="button" onClick={onRetry} className="px-2 py-1 rounded border border-red-300 bg-white text-red-700">Reintentar</button>
      </div>
    );
  }
  if (!data || data.rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-600">{loading ? 'Cargando…' : 'Sin datos disponibles todavía.'}</div>;
  }

  const amount = (a: { bs: number; usd: number | null }) => (currency === 'usd' ? a.usd : a.bs);
  const chartData = data.rows.map(r => ({
    label: r.label,
    ...Object.fromEntries(data.series.map(s => [s.name, amount(r.sales[s.code] ?? { bs: 0, usd: 0 })])),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900">Ventas por grupo de cliente</h3>
        <button type="button" onClick={() => setAsTable(v => !v)} className="text-xs text-blue-700 hover:underline">
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>
      <div data-testid="grupo-trend-body" className={loading ? 'opacity-60' : ''}>
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-600">
                  <th className="px-3 py-2 text-left">Período</th>
                  {data.series.map(s => <th key={s.code} className="px-3 py-2 text-right">{s.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map(r => (
                  <tr key={r.bucketKey}>
                    <td className="px-3 py-2">{r.label}</td>
                    {data.series.map(s => (
                      <td key={s.code} className="px-3 py-2 text-right">
                        {amount(r.sales[s.code] ?? { bs: 0, usd: 0 }) === null ? '—' : moneyLabel(r.sales[s.code] ?? { bs: 0, usd: 0 }, currency)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => new Intl.NumberFormat('es-VE', { notation: 'compact' }).format(Number(v))} />
              <Tooltip formatter={(v: unknown) => (v === null || v === undefined ? '—' : moneyLabel(currency === 'usd' ? { bs: 0, usd: Number(v) } : { bs: Number(v), usd: 0 }, currency))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {data.series.map((s, i) => <Bar key={s.code} dataKey={s.name} stackId="grupo" fill={colorOf(i, s.code)} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
