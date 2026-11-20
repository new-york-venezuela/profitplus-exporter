'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { moneyLabel, qty } from '../../lib/format';
import { bucketLabels, bucketTitle, TREND_UNIT_LABEL } from '../../lib/granularity';
import type { Nivel } from '../../lib/productos-params';
import { normalizeStack } from '@/lib/productos/normalize-stack';
import type { Currency, UnitsByLineaResponse } from '../../types';

// Stable palette across the (up to 10) series a given range/filter surfaces — "Otras" (always last
// in `lineas`, see the productos route) gets the trailing gray so it reads as a catch-all, not another series.
const LINEA_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
];

function lineaColor(linea: string, lineas: string[]): string {
  if (linea === 'Otras') return '#9ca3af';
  const idx = lineas.indexOf(linea);
  return LINEA_COLORS[idx % LINEA_COLORS.length];
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const NIVEL_SERIES_LABEL: Record<Nivel, string> = { linea: 'línea', sublinea: 'sublínea', sku: 'SKU' };

// Units sold per bucket, stacked by the item of the active nivel (section=porLineaMes), with an
// Absoluto | 100 % toggle (local state) and click-to-drill: the consumer decides what a click does.
export default function TrendCard({ data, loading, error, nivel, currency, onSeriesClick }: {
  data: UnitsByLineaResponse | null;
  loading: boolean;
  error: string | null;
  nivel: Nivel;
  currency: Currency;
  onSeriesClick: (seriesName: string) => void;
}) {
  const [shareMode, setShareMode] = useState(false);
  const trendMode = data?.trendMode ?? 'month';
  const labels = bucketLabels(trendMode, (data?.rows ?? []).map(r => r.bucket));
  const keys = data?.lineas ?? [];
  const shares = normalizeStack((data?.rows ?? []).map(r => r.units), keys);
  const chartData = (data?.rows ?? []).map((r, i) => ({
    ...(shareMode ? shares[i] : r.units),
    label: labels[i],
    bucket: r.bucket,
    realUnits: r.units,
    title: bucketTitle(trendMode, r.bucket),
  }));

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900">{`Unidades vendidas por ${TREND_UNIT_LABEL[trendMode]}, por ${NIVEL_SERIES_LABEL[nivel]}`}</h2>
        <div role="group" aria-label="Escala del gráfico" className="inline-flex rounded border border-gray-300 text-xs overflow-hidden shrink-0">
          <button type="button" aria-pressed={!shareMode} onClick={() => setShareMode(false)} className={`px-2 py-1 ${!shareMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>Absoluto</button>
          <button type="button" aria-pressed={shareMode} onClick={() => setShareMode(true)} className={`px-2 py-1 ${shareMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>100 %</button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">Clic en un segmento para filtrar la tabla</p>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      ) : !data || chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">Sin datos disponibles todavía.</div>
      ) : (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData} margin={{ top: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={shareMode ? [0, 1] : undefined} tickFormatter={v => (shareMode ? `${Math.round(Number(v) * 100)}%` : qty(Number(v)))} />
            <Tooltip
              formatter={(value, name, entry) => {
                const row = data.rows.find(r => r.bucket === (entry.payload as { bucket: string })?.bucket);
                const lineaName = String(name);
                const realUnits = (entry.payload as { realUnits?: Record<string, number> })?.realUnits?.[lineaName] ?? Number(value);
                const salesGrossAmount = row?.salesGross[lineaName] ?? { bs: 0, usd: 0 };
                const totalBs = row?.totalSalesGross.bs ?? 0;
                const share = totalBs > 0 ? salesGrossAmount.bs / totalBs : null;
                return [`${qty(realUnits)} u. — ${moneyLabel(salesGrossAmount, currency)} (${pct(share)} del ${TREND_UNIT_LABEL[trendMode]})`, lineaName];
              }}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.lineas.map(lineaName => (
              <Bar
                key={lineaName}
                dataKey={lineaName}
                stackId="lineas"
                fill={lineaColor(lineaName, data.lineas)}
                cursor={lineaName === 'Otras' ? 'default' : 'pointer'}
                onClick={() => onSeriesClick(lineaName)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
