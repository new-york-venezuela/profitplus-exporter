'use client';

import { useId } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { HistoryPoint } from '../../../../../lib/seguimiento/types';
import { OTHER_LINE_LABEL } from '../../../../../lib/seguimiento/category-mix';
import { historyCategories, stackMonth, type StackSegment } from '../../../../../lib/seguimiento/history-stack';
import { lineColor } from './colors';
import { moneyTooltip } from '../../lib/format';
import { money } from '../../lib/format';
import type { Currency } from '../../types';
import { monthLabel, num, units as unitsLabel } from './fmt';

const MONTHS = 12;

export interface HistoryRow {
  month: string;
  label: string;
  title: string;
  /** Brutas / devoluciones / neta in the selected currency; null = no data (gap or USD without rate). */
  gross: number | null;
  returns: number | null;
  net: number | null;
  units: number | null;
  returnUnits: number | null;
  netUnits: number | null;
  /** Gross change vs the previous calendar month; null when there is no usable previous month or this month is partial. */
  change: number | null;
  unitsChange: number | null;
  partial: boolean;
  /** This month's stacked segments, bottom to top: biggest first, "Otros" always last (top). */
  segments: StackSegment[];
  /**
   * Recharts stacks bars in a fixed series order, so the per-month order is positional: slot i
   * (i < visible categories) holds this month's i-th biggest visible category, the last slot holds
   * "Otros". Empty slots and gap months are null (no bar).
   */
  slots: (StackSegment | null)[];
}

/** The 12 months ending in `endMonth` (YYYY-MM), oldest first. */
export function historyMonths(endMonth: string): string[] {
  const [y, m] = endMonth.split('-').map(Number);
  const out: string[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function changeOf(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  const c = (cur - prev) / prev;
  return Number.isFinite(c) ? c : null;
}

/** Pure shaping: a month missing from `points` is a gap (null), never zero. */
// Segments for one month. A point without byLine (a response cached before the breakdown existed)
// stacks its whole brutas as one "Otros" segment, so the bar still equals the month's brutas.
function segmentsOf(p: HistoryPoint | undefined, visible: readonly string[], currency: Currency): StackSegment[] {
  if (!p) return [];
  return stackMonth(p.byLine ?? [{ line: null, sales: p.sales, units: p.units }], visible, currency);
}

function slotsOf(segments: StackSegment[], visibleCount: number): (StackSegment | null)[] {
  const slots: (StackSegment | null)[] = Array(visibleCount + 1).fill(null);
  let i = 0;
  for (const s of segments) {
    if (s.category === OTHER_LINE_LABEL) slots[visibleCount] = s;
    else slots[i++] = s;
  }
  return slots;
}

export function buildHistoryRows(points: HistoryPoint[], endMonth: string, currency: Currency, partialMonth: string): HistoryRow[] {
  const byMonth = new Map(points.map(p => [p.month, p]));
  const pick = (d: { bs: number; usd: number | null }) => (currency === 'usd' ? d.usd : d.bs);
  const visible = historyCategories(points);
  const months = historyMonths(endMonth);
  const rows: HistoryRow[] = months.map(month => {
    const p = byMonth.get(month);
    const gross = p ? pick(p.sales) : null;
    const returns = p ? pick(p.returns) : null;
    const partial = month === partialMonth;
    const mm = SHORT[Number(month.slice(5, 7)) - 1];
    // A month without brutas (gap, or USD without a rate) draws no bar at all.
    const segments = gross === null ? [] : segmentsOf(p, visible, currency);
    return {
      month,
      label: `${mm} ${month.slice(2, 4)}${partial ? ' (parcial)' : ''}`,
      title: `${monthLabel(month)}${partial ? ' (parcial)' : ''}`,
      gross,
      returns,
      net: gross === null || returns === null ? null : gross - returns,
      units: p ? p.units : null,
      returnUnits: p ? p.returnUnits : null,
      netUnits: p ? p.units - p.returnUnits : null,
      change: null,
      unitsChange: null,
      partial,
      segments,
      slots: slotsOf(segments, visible.length),
    };
  });
  for (let i = 1; i < rows.length; i++) {
    // A partial month against a full one would always read as a drop: no change for it.
    if (rows[i].partial) continue;
    rows[i].change = changeOf(rows[i].gross, rows[i - 1].gross);
    rows[i].unitsChange = changeOf(rows[i].units, rows[i - 1].units);
  }
  return rows;
}

const cur = (n: number | null, currency: Currency) => (n === null ? '—' : moneyTooltip(n, currency));
const pctChange = (c: number | null) => (c === null ? '—' : `${c >= 0 ? '+' : ''}${(c * 100).toFixed(1)}%`);

// Each category has a colour (the Categorías block's lineColor) AND a distinct texture, so segments
// can be told apart without colour. Index = position among the visible categories; Otros is grey with
// its own texture.
type Texture = 'solid' | 'diag' | 'dots' | 'horiz' | 'cross' | 'vert' | 'backdiag';
const TEXTURES: Texture[] = ['solid', 'diag', 'dots', 'horiz', 'cross', 'vert'];
const OTHER_TEXTURE: Texture = 'backdiag';

function textureOf(category: string, visible: readonly string[]): Texture {
  if (category === OTHER_LINE_LABEL) return OTHER_TEXTURE;
  const i = visible.indexOf(category);
  return TEXTURES[(i < 0 ? 0 : i) % TEXTURES.length];
}

function texturePattern(id: string, texture: Texture, color: string) {
  const mark = { stroke: '#fff', strokeWidth: 1.5 };
  return (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill={color} />
      {texture === 'diag' && <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" {...mark} />}
      {texture === 'backdiag' && <path d="M-1,5 l2,2 M0,0 l6,6 M5,-1 l2,2" {...mark} />}
      {texture === 'dots' && <circle cx="3" cy="3" r="1.2" fill="#fff" />}
      {texture === 'horiz' && <path d="M0,3 h6" {...mark} />}
      {texture === 'vert' && <path d="M3,0 v6" {...mark} />}
      {texture === 'cross' && <path d="M0,3 h6 M3,0 v6" {...mark} />}
    </pattern>
  );
}

const safeId = (raw: string) => raw.replace(/[^A-Za-z0-9_-]/g, '');

export function HistoryTooltip({ active, payload, currency }: { active?: boolean; payload?: Array<{ payload: HistoryRow }>; currency: Currency }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
      <p className="font-semibold text-gray-900 mb-1">{r.title}</p>
      {r.segments.length > 0 && (
        <ul aria-label="Categorías" className="mb-1">
          {r.segments.map(sg => <li key={sg.category}>{sg.category}: {cur(sg.value, currency)}</li>)}
        </ul>
      )}
      <p>Brutas: {cur(r.gross, currency)} · {r.units === null ? '—' : `${unitsLabel(r.units)} u.`}</p>
      <p>Devoluciones: {cur(r.returns, currency)} · {r.returnUnits === null ? '—' : `${unitsLabel(r.returnUnits)} u.`}</p>
      <p>Neta: {cur(r.net, currency)} · {r.netUnits === null ? '—' : `${unitsLabel(r.netUnits)} u.`}</p>
      {r.partial
        ? <p>Cambio vs mes anterior: — (mes parcial)</p>
        : <p>Cambio vs mes anterior: {pctChange(r.change)} (ventas) · {pctChange(r.unitsChange)} (unidades)</p>}
    </div>
  );
}

// `scopeLabel`: the selected root's label, or Total when none is selected.
export function HistoryChart({ points, currency, partialMonth, endMonth, scopeLabel = 'Total' }: {
  points: HistoryPoint[]; currency: Currency; partialMonth: string; endMonth?: string; scopeLabel?: string;
}) {
  const uid = safeId(useId());
  const end = endMonth || partialMonth || points.map(p => p.month).sort().at(-1) || '';
  const rows = points.length === 0 || !end ? [] : buildHistoryRows(points, end, currency, partialMonth);
  const currencyName = currency === 'usd' ? 'USD' : 'Bs.';
  const visible = historyCategories(points);
  const hasOther = rows.some(r => r.slots[visible.length] !== null);
  const legendCats = hasOther ? [...visible, OTHER_LINE_LABEL] : visible;
  const patternId = (category: string, where: 'chart' | 'legend') =>
    `hist-${uid}-${where}-${category === OTHER_LINE_LABEL ? 'otros' : visible.indexOf(category)}`;
  const fillOf = (category: string) => `url(#${patternId(category, 'chart')})`;
  const colorOf = (category: string) => lineColor(category, visible);
  const slotCount = visible.length + 1;
  return (
    <section aria-label="Historial mes a mes" className="bg-white border border-gray-200 rounded-lg p-4 w-full">
      <h3 className="text-sm font-bold text-gray-900">Mes a mes · {scopeLabel}</h3>
      <p className="text-xs text-gray-500 mb-2">
        Últimos 12 meses, ventas brutas sin IVA (antes de devoluciones), apiladas por categoría: la mayor del mes abajo, Otros arriba. Un mes sin datos queda vacío.
        {partialMonth && <> {monthLabel(partialMonth)} es parcial.</>}
      </p>
      {rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sin datos</div>
      ) : (
        <>
          <p className="text-xs text-gray-700 mb-1">Ventas brutas ({currencyName}) por categoría:</p>
          <ul aria-label="Leyenda" className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700 mb-2">
            {legendCats.map(cat => (
              <li key={cat} className="flex items-center gap-1.5">
                <svg width="14" height="14" aria-hidden="true">
                  <defs>{texturePattern(patternId(cat, 'legend'), textureOf(cat, visible), colorOf(cat))}</defs>
                  <rect width="14" height="14" fill={`url(#${patternId(cat, 'legend')})`} stroke={colorOf(cat)} />
                </svg>
                {cat}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <svg width="22" height="14" aria-hidden="true">
                <line x1="0" y1="7" x2="22" y2="7" stroke="#111827" strokeWidth="2.5" strokeDasharray="5 3" />
                <circle cx="11" cy="7" r="3.5" fill="#fff" stroke="#111827" strokeWidth="2" />
              </svg>
              Unidades brutas (eje der.)
            </li>
          </ul>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={rows}>
              <defs>{legendCats.map(cat => texturePattern(patternId(cat, 'chart'), textureOf(cat, visible), colorOf(cat)))}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
              <YAxis yAxisId="units" orientation="right" tick={{ fontSize: 12 }} tickFormatter={v => num(v)} />
              <Tooltip content={<HistoryTooltip currency={currency} />} />
              {Array.from({ length: slotCount }, (_, i) => (
                <Bar
                  key={i}
                  yAxisId="amt"
                  stackId="categories"
                  dataKey={(r: HistoryRow) => r.slots[i]?.value ?? null}
                  name={`Ventas brutas (${currencyName})`}
                  isAnimationActive={false}
                >
                  {rows.map(r => {
                    const sg = r.slots[i];
                    return <Cell key={r.month} fill={sg ? fillOf(sg.category) : 'transparent'} stroke={sg ? colorOf(sg.category) : undefined} />;
                  })}
                </Bar>
              ))}
              <Line yAxisId="units" type="monotone" dataKey="units" name="Unidades brutas" stroke="#111827" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#fff' }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <table className="sr-only">
            <caption>Mes a mes por categoría, ventas brutas en {currencyName} · {scopeLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                {legendCats.map(cat => <th key={cat} scope="col">{cat}</th>)}
                <th scope="col">Ventas brutas</th>
                <th scope="col">Unidades brutas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.month}>
                  <th scope="row">{r.title}</th>
                  {legendCats.map(cat => {
                    const sg = r.segments.find(x => x.category === cat);
                    return <td key={cat}>{cur(sg ? sg.value : null, currency)}</td>;
                  })}
                  <td>{cur(r.gross, currency)}</td>
                  <td>{r.units === null ? '—' : unitsLabel(r.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
