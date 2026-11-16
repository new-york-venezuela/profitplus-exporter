'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { BUBBLE_CAP, BUBBLE_CLAMP, buildBubbleData, type BubblePoint, type BubbleY } from '@/lib/productos/bubble-data';
import type { ParetoClass } from '@/lib/productos/pareto';
import { moneyLabel, qty } from '../../lib/format';
import { pct, signedPct } from '../../lib/productos-format';
import type { CatalogoRow, Currency } from '../../types';

// Same hues as the table's ParetoBadge (blue / slate / light gray) so the legend matches.
const FILL: Record<ParetoClass | 'none', { fill: string; stroke: string; label: string }> = {
  A: { fill: '#2563eb', stroke: '#1e40af', label: 'A' },
  B: { fill: '#64748b', stroke: '#334155', label: 'B' },
  C: { fill: '#e5e7eb', stroke: '#6b7280', label: 'C' },
  none: { fill: '#ffffff', stroke: '#9ca3af', label: 'Sin clase' },
};

const Y_LABEL: Record<BubbleY, string> = { trend: 'Tendencia vs. período anterior', returnRate: 'Tasa de devolución' };

function style(p: ParetoClass | null) {
  return FILL[p ?? 'none'];
}

// Recharts hands the clicked datum back either flat or wrapped in `payload`.
export function bubbleKeyFromClick(arg: unknown): string | null {
  const a = arg as { key?: unknown; payload?: { key?: unknown } } | null;
  const k = a?.key ?? a?.payload?.key;
  return typeof k === 'string' ? k : null;
}

function BubbleTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: BubblePoint }[]; currency: Currency }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const net = moneyLabel(currency === 'usd' ? { bs: 0, usd: p.net } : { bs: p.net, usd: 0 }, currency);
  return (
    <div className="rounded border border-gray-300 bg-white px-3 py-2 text-xs shadow">
      <div className="font-semibold text-gray-900">{p.label}</div>
      <div>Clase Pareto: {p.pareto ?? 'Sin clase'}</div>
      <div>Ventas netas: {net}</div>
      <div>Unid./mes: {qty(p.x)}</div>
      <div>Tendencia: {p.trendPct === null ? 'Sin datos' : signedPct(p.trendPct)}</div>
      <div>Tasa dev.: {p.returnRate === null ? 'Sin datos' : pct(p.returnRate)}</div>
    </div>
  );
}

export default function BubblePlot({
  rows, currency, onSelect,
}: {
  rows: CatalogoRow[];
  currency: Currency;
  onSelect: (key: string) => void;
}) {
  const [yMode, setYMode] = useState<BubbleY>('trend');
  const { points, missing, truncated } = buildBubbleData(rows, yMode, currency);
  const classes: (ParetoClass | 'none')[] = ['A', 'B', 'C'];
  if (points.some(p => p.pareto === null)) classes.push('none');

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Eje vertical" className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
          {(['trend', 'returnRate'] as const).map(m => (
            <button
              key={m}
              type="button"
              aria-pressed={yMode === m}
              onClick={() => setYMode(m)}
              className={`px-3 py-1 ${yMode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {Y_LABEL[m]}
            </button>
          ))}
        </div>
        <ul aria-label="Leyenda de clases Pareto" className="flex items-center gap-3 text-xs text-gray-600">
          {classes.map(c => (
            <li key={c} className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full border"
                style={{ background: FILL[c].fill, borderColor: FILL[c].stroke }}
              />
              {FILL[c].label}
            </li>
          ))}
        </ul>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number" dataKey="x" name="Unid./mes" tick={{ fontSize: 12 }} tickFormatter={v => qty(Number(v))}
            label={{ value: 'Unidades por mes (promedio)', position: 'insideBottom', offset: -12, fontSize: 12 }}
          />
          <YAxis
            type="number" dataKey="y" name={Y_LABEL[yMode]} tick={{ fontSize: 12 }}
            tickFormatter={v => (yMode === 'trend' ? signedPct(Number(v)) : pct(Number(v)))}
            label={{ value: Y_LABEL[yMode], angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <ZAxis type="number" dataKey="size" range={[60, 900]} name="Ventas netas" />
          {yMode === 'trend' && <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />}
          <Tooltip content={<BubbleTooltip currency={currency} />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            data={points}
            cursor="pointer"
            onClick={(arg: unknown) => {
              const key = bubbleKeyFromClick(arg);
              if (key !== null) onSelect(key);
            }}
          >
            {points.map(p => (
              <Cell key={p.key} fill={style(p.pareto).fill} stroke={style(p.pareto).stroke} fillOpacity={0.75} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-gray-500">
        Eje X: unidades por mes (promedio); tamaño de la burbuja: ventas netas. Clic en una burbuja para ir a su fila.
        {yMode === 'trend' && ` La tendencia se recorta a ±${BUBBLE_CLAMP * 100} % en el gráfico; el valor real se ve al pasar el cursor.`}
      </p>
      {missing > 0 && <p className="text-xs text-gray-400">{missing} sin datos</p>}
      {truncated > 0 && <p className="text-xs text-gray-400">Mostrando los {BUBBLE_CAP} principales</p>}
    </div>
  );
}
