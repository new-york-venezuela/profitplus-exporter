'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { HistoryPoint } from '../../../../../lib/seguimiento/types';
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
export function buildHistoryRows(points: HistoryPoint[], endMonth: string, currency: Currency, partialMonth: string): HistoryRow[] {
  const byMonth = new Map(points.map(p => [p.month, p]));
  const pick = (d: { bs: number; usd: number | null }) => (currency === 'usd' ? d.usd : d.bs);
  const months = historyMonths(endMonth);
  const rows: HistoryRow[] = months.map(month => {
    const p = byMonth.get(month);
    const gross = p ? pick(p.sales) : null;
    const returns = p ? pick(p.returns) : null;
    const partial = month === partialMonth;
    const mm = SHORT[Number(month.slice(5, 7)) - 1];
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

function HistoryTooltip({ active, payload, currency }: { active?: boolean; payload?: Array<{ payload: HistoryRow }>; currency: Currency }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
      <p className="font-semibold text-gray-900 mb-1">{r.title}</p>
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
  const end = endMonth || partialMonth || points.map(p => p.month).sort().at(-1) || '';
  const rows = points.length === 0 || !end ? [] : buildHistoryRows(points, end, currency, partialMonth);
  const currencyName = currency === 'usd' ? 'USD' : 'Bs.';
  return (
    <section aria-label="Historial mes a mes" className="bg-white border border-gray-200 rounded-lg p-4 w-full">
      <h3 className="text-sm font-bold text-gray-900">Mes a mes · {scopeLabel}</h3>
      <p className="text-xs text-gray-500 mb-2">
        Últimos 12 meses, ventas brutas sin IVA (antes de devoluciones). Un mes sin datos queda vacío.
        {partialMonth && <> {monthLabel(partialMonth)} es parcial.</>}
      </p>
      {rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sin datos</div>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700 mb-2">
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="#2563eb" /></svg>
              Ventas brutas ({currencyName})
            </li>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
              <YAxis yAxisId="units" orientation="right" tick={{ fontSize: 12 }} tickFormatter={v => num(v)} />
              <Tooltip content={<HistoryTooltip currency={currency} />} />
              <Bar yAxisId="amt" dataKey="gross" name={`Ventas brutas (${currencyName})`} fill="#2563eb" />
              <Line yAxisId="units" type="monotone" dataKey="units" name="Unidades brutas" stroke="#111827" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#fff' }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}
