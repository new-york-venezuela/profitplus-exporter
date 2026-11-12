'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { Currency, MonthlyTrendRow } from '../../types';
import { bucketLabels, bucketTitle } from '../../lib/granularity';
import type { BucketMode } from '../../lib/granularity';
import { money, moneyTooltip } from '../../lib/format';
import { returnRate } from '../../lib/net-sales';
import { BAR_Z_INDEX, haloLineProps, trendLineProps } from '../../lib/line-halo';
import { SectionTitle } from './stat-card';

export const HATCH_ID = 'returns-hatch';
const LEGEND_HATCH_ID = 'returns-hatch-legend';

function hatchPattern(id: string) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="#fee2e2" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="#b91c1c" strokeWidth="2.5" />
    </pattern>
  );
}

export interface ChartRow {
  label: string;
  title: string;
  gross: number | null;
  net: number | null;
  returns: number | null;
  rate: number | null;
}

export function buildChartRows(rows: MonthlyTrendRow[], mode: BucketMode, currency: Currency): ChartRow[] {
  const labels = bucketLabels(mode, rows.map(r => r.bucket));
  const pick = (d: { bs: number; usd: number | null }) => (currency === 'usd' ? d.usd : d.bs);
  return rows.map((r, i) => ({
    label: labels[i],
    title: bucketTitle(mode, r.bucket),
    gross: pick(r.salesGross),
    net: pick(r.salesNet),
    returns: pick(r.returnsNet),
    rate: returnRate(r.returnsNet, r.salesGross),
  }));
}

const pctLabel = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: Array<{ payload: ChartRow }>; currency: Currency }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
      <p className="font-semibold text-gray-900 mb-1">{r.title}</p>
      <p>Ventas brutas: {moneyTooltip(r.gross, currency)}</p>
      <p>Ventas netas: {moneyTooltip(r.net, currency)}</p>
      <p>Devoluciones: {moneyTooltip(r.returns, currency)}</p>
      <p>Tasa de devolución: {pctLabel(r.rate)}</p>
    </div>
  );
}

export function SalesReturnsChart({ rows, trendMode, currency }: { rows: MonthlyTrendRow[]; trendMode: BucketMode; currency: Currency }) {
  const data = buildChartRows(rows, trendMode, currency);
  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 w-full">
      <SectionTitle>Ventas netas y devoluciones</SectionTitle>
      <p className="text-xs text-gray-500 mb-2">Ventas netas + devoluciones = ventas brutas (sin IVA, devoluciones por fecha de factura)</p>
      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sin datos disponibles todavía.</div>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700 mb-2">
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="#2563eb" /></svg>
              Ventas netas
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true">
                <defs>{hatchPattern(LEGEND_HATCH_ID)}</defs>
                <rect width="14" height="14" fill={`url(#${LEGEND_HATCH_ID})`} stroke="#b91c1c" />
              </svg>
              Devoluciones
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="18" height="14" aria-hidden="true"><line x1="0" y1="7" x2="18" y2="7" stroke="#111827" strokeWidth="2.5" strokeDasharray="4 2" /></svg>
              Tasa de devolución (eje der.)
            </li>
          </ul>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data}>
              {/* The bars' own pattern lives in the chart's SVG, so it never depends on the legend being mounted. */}
              <defs>{hatchPattern(HATCH_ID)}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
              <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 12 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              <Bar yAxisId="amt" dataKey="net" name="Ventas netas" stackId="s" fill="#2563eb" zIndex={BAR_Z_INDEX} />
              <Bar yAxisId="amt" dataKey="returns" name="Devoluciones" stackId="s" fill={`url(#${HATCH_ID})`} stroke="#b91c1c" zIndex={BAR_Z_INDEX} />
              <Line yAxisId="rate" dataKey="rate" name="Tasa de devolución" {...haloLineProps()} />
              <Line yAxisId="rate" dataKey="rate" name="Tasa de devolución" {...trendLineProps()} />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
