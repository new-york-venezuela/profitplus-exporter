'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { bucketLabels } from '../../lib/granularity';
import type { Granularity } from '../../lib/granularity';
import { moneyLabel, qty } from '../../lib/format';
import { useDwhSection } from '../../lib/use-dwh-section';
import type { Currency, DateRange, DualAmount, UnitsByLineaResponse } from '../../types';
import { SegmentedControl } from './segmented-control';

type Nivel = 'linea' | 'sku';
type ChartKind = 'barras' | 'lineas';
type Metric = 'ventas' | 'unidades';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569'];
const colorOf = (name: string, i: number) => (name === 'Otras' ? '#9ca3af' : COLORS[i % COLORS.length]);

// Evolution of ONE customer (a casa matriz or a store) by product línea or SKU: the Productos trend scoped to
// that customer (`tienda=e:<key>|t:<code>`), as bars or lines, in sales (active currency) or units, with a table
// alternative. Mounted only while the customer's row is open, so only open rows fetch. Toggles are local.
export function EvolutionPanel({ filterKey, dateRange, granularity, currency }: {
  filterKey: string;
  dateRange: DateRange;
  granularity: Granularity;
  currency: Currency;
}) {
  const [nivel, setNivel] = useState<Nivel>('linea');
  const [kind, setKind] = useState<ChartKind>('barras');
  const [metric, setMetric] = useState<Metric>('ventas');
  const [asTable, setAsTable] = useState(false);

  const q = new URLSearchParams({ section: 'porLineaMes', dateRange, granularity, nivel, tienda: filterKey });
  const { data, loading, error, retry } = useDwhSection<UnitsByLineaResponse>(`/api/dwh/productos?${q.toString()}`);

  const valueOf = (row: UnitsByLineaResponse['rows'][number], series: string): number | null => {
    if (metric === 'unidades') return row.units[series] ?? 0;
    const a: DualAmount = row.salesGross[series] ?? { bs: 0, usd: 0 };
    return currency === 'usd' ? a.usd : a.bs;
  };
  const format = (v: number | null): string => {
    if (v === null) return '—';
    return metric === 'unidades' ? qty(v) : moneyLabel(currency === 'usd' ? { bs: 0, usd: v } : { bs: v, usd: 0 }, currency);
  };

  const controls = (
    <div className="flex items-center gap-3 flex-wrap">
      <SegmentedControl ariaLabel="Nivel de producto" value={nivel} options={[{ value: 'linea', label: 'Línea' }, { value: 'sku', label: 'SKU' }]} onChange={setNivel} />
      <SegmentedControl ariaLabel="Tipo de gráfico" value={kind} options={[{ value: 'lineas', label: 'Líneas' }, { value: 'barras', label: 'Barras' }]} onChange={setKind} />
      <SegmentedControl ariaLabel="Medida" value={metric} options={[{ value: 'ventas', label: 'Ventas' }, { value: 'unidades', label: 'Unidades' }]} onChange={setMetric} />
      <button type="button" onClick={() => setAsTable(v => !v)} className="text-xs text-blue-700 hover:underline">{asTable ? 'Ver gráfico' : 'Ver tabla'}</button>
    </div>
  );

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="text-sm bg-red-50 border border-red-200 rounded px-4 py-3 flex items-center gap-3">
        <span className="text-red-700">{error}</span>
        <button type="button" onClick={retry} className="px-2 py-1 rounded border border-red-300 bg-white text-red-700">Reintentar</button>
      </div>
    );
  } else if (!data) {
    body = <div className="h-24 flex items-center justify-center text-sm text-gray-600">Cargando…</div>;
  } else if (data.rows.length === 0) {
    body = <div className="h-24 flex items-center justify-center text-sm text-gray-600">Sin ventas de productos en el período.</div>;
  } else {
    const labels = bucketLabels(data.trendMode, data.rows.map(r => r.bucket));
    const chartData = data.rows.map((r, i) => ({ label: labels[i], ...Object.fromEntries(data.lineas.map(s => [s, valueOf(r, s)])) }));
    body = asTable ? (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-600">
              <th className="px-3 py-2 text-left">Período</th>
              {data.lineas.map(s => <th key={s} className="px-3 py-2 text-right">{s}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.map((r, i) => (
              <tr key={r.bucket}>
                <td className="px-3 py-2">{labels[i]}</td>
                {data.lineas.map(s => <td key={s} className="px-3 py-2 text-right">{format(valueOf(r, s))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={300}>
        {kind === 'barras' ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => new Intl.NumberFormat('es-VE', { notation: 'compact' }).format(Number(v))} />
            <Tooltip formatter={(v: unknown) => format(v === null || v === undefined ? null : Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.lineas.map((s, i) => <Bar key={s} dataKey={s} stackId="evo" fill={colorOf(s, i)} />)}
          </BarChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => new Intl.NumberFormat('es-VE', { notation: 'compact' }).format(Number(v))} />
            <Tooltip formatter={(v: unknown) => format(v === null || v === undefined ? null : Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.lineas.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={colorOf(s, i)} strokeWidth={2} strokeDasharray={i % 3 === 1 ? '6 4' : i % 3 === 2 ? '2 3' : undefined} dot={false} connectNulls={false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    );
  }

  return (
    <div className="space-y-3" aria-label="Evolución por producto">
      {controls}
      <div className={loading && data ? 'opacity-60' : ''}>{body}</div>
    </div>
  );
}
