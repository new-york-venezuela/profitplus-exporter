'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';
import type { Granularity } from '../../lib/granularity';
import type { ClientesTrendRow } from '../../types';

const GRANULARITY_NOUN: Record<Granularity, string> = { day: 'día', week: 'semana', month: 'mes' };

function pct(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

// Clientes activos (solid, left axis) and tasa de abandono (dashed, right axis) per bucket. Series differ by
// line style and direct end labels, not hue alone; "Ver tabla" shows the same values as a table.
export function ActivityTrendChart({ rows, granularity, loading, error, onRetry }: {
  rows: ClientesTrendRow[];
  granularity: Granularity;
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
  if (rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-600">{loading ? 'Cargando…' : 'Sin datos disponibles todavía.'}</div>;
  }
  if (rows.length === 1) {
    const r = rows[0];
    return (
      <div data-testid="trend-body" className={`text-sm text-gray-800 py-6 ${loading ? 'opacity-60' : ''}`}>
        {r.label}: <strong>{r.activeCustomers} clientes activos</strong>
        {r.churnRate !== null && <> · abandono {pct(r.churnRate)}</>}
      </div>
    );
  }

  const data = rows.map(r => ({
    label: r.label,
    'Clientes activos': r.activeCustomers,
    'Tasa de abandono': r.churnRate === null ? null : r.churnRate * 100,
  }));
  const last = data.length - 1;
  const endLabel = (color: string, fmt: (v: number) => string) => ({ x, y, value, index }: { x?: number | string; y?: number | string; value?: number | string | null; index?: number }) =>
    index === last && value !== null && value !== undefined
      ? <text x={Number(x) + 6} y={Number(y)} fill={color} fontSize={12} dominantBaseline="middle">{fmt(Number(value))}</text>
      : null;

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button type="button" onClick={() => setAsTable(v => !v)} className="text-xs text-blue-700 hover:underline">
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>
      <div data-testid="trend-body" className={loading ? 'opacity-60' : ''}>
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-600">
                  <th className="px-3 py-2 text-left capitalize">{GRANULARITY_NOUN[granularity]}</th>
                  <th className="px-3 py-2 text-right">Clientes activos</th>
                  <th className="px-3 py-2 text-right">Tasa de abandono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.bucketKey}>
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right">{r.activeCustomers}</td>
                    <td className="px-3 py-2 text-right">{pct(r.churnRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ right: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Clientes activos', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} label={{ value: 'Tasa de abandono', angle: 90, position: 'insideRight', fontSize: 12 }} />
              <Tooltip formatter={(val: unknown, name: unknown) => (val === null ? '—' : name === 'Tasa de abandono' ? `${Number(val).toFixed(1)}%` : String(val))} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Clientes activos" stroke="#2563eb" strokeWidth={2} dot={false}>
                <LabelList dataKey="Clientes activos" content={endLabel('#2563eb', v => String(v)) as never} />
              </Line>
              <Line yAxisId="right" type="monotone" dataKey="Tasa de abandono" stroke="#b91c1c" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls>
                <LabelList dataKey="Tasa de abandono" content={endLabel('#b91c1c', v => `${v.toFixed(1)}%`) as never} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
