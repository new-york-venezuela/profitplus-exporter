'use client';

import { useState } from 'react';
import { moneyLabel, priceLabel, qty } from '../../lib/format';
import type { Metric, Nivel } from '../../lib/productos-params';
import type { CatalogoRow, Currency, DualAmount } from '../../types';
import { pct, signedPct } from '../../lib/productos-format';
import ParetoBadge from './pareto-badge';

import { RETURN_RATE_ALERT, RETURN_RATE_WARN } from '@/lib/productos/thresholds';

// Return rate thresholds live in lib/productos/thresholds.ts; re-exported so existing importers keep working.
export { RETURN_RATE_ALERT, RETURN_RATE_WARN };

export interface MasterTableProps {
  rows: CatalogoRow[];
  currency: Currency;
  metric: Metric;
  nivel: Nivel;
  loading: boolean;
  error: string | null;
  highlightKey?: string | null;
}

type SortKey = 'label' | 'pareto' | 'net' | 'trend' | 'gross' | 'returnRate' | 'units' | 'avgUnits' | 'avgPrice' | 'reach';
type SortDir = 'asc' | 'desc';

const NIVEL_LABEL: Record<Nivel, string> = { linea: 'Línea', sublinea: 'Sublínea', sku: 'SKU' };
const PARETO_RANK = { A: 0, B: 1, C: 2 } as const;

const COLUMNS: { key: SortKey; label: string | null; title?: string; align: 'left' | 'right' }[] = [
  { key: 'label', label: null, align: 'left' },
  { key: 'pareto', label: 'Pareto', title: 'Clase ABC por ventas netas: A hasta el 80% acumulado, B hasta el 95%, C el resto', align: 'left' },
  { key: 'net', label: 'Ventas netas', title: 'Ventas brutas menos devoluciones (por fecha de devolución), sin IVA', align: 'right' },
  { key: 'trend', label: 'Δ vs. período anterior', title: 'Variación de las ventas netas frente al período anterior de igual duración', align: 'right' },
  { key: 'gross', label: 'Ventas brutas', title: 'Ventas sin IVA antes de devoluciones; debajo, las devoluciones', align: 'right' },
  { key: 'returnRate', label: 'Tasa dev.', title: 'Devoluciones ÷ ventas brutas (Bs)', align: 'right' },
  { key: 'units', label: 'Unidades', align: 'right' },
  { key: 'avgUnits', label: 'Unid./mes', title: 'Unidades ÷ meses con ventas en el período', align: 'right' },
  { key: 'avgPrice', label: 'Precio prom.', title: 'Precio promedio realizado: ventas brutas ÷ unidades', align: 'right' },
  { key: 'reach', label: 'Alcance', title: 'Clientes (entidades legales) y tiendas (códigos de cliente) que lo compraron', align: 'right' },
];

function pick(amount: DualAmount, currency: Currency): number | null {
  return currency === 'usd' ? amount.usd : amount.bs;
}

function sortValue(row: CatalogoRow, key: SortKey, currency: Currency): number | string | null {
  switch (key) {
    case 'label': return row.label;
    case 'pareto': return row.pareto === null ? null : PARETO_RANK[row.pareto];
    case 'net': return pick(row.salesNet, currency);
    case 'trend': return row.trendPct;
    case 'gross': return pick(row.salesGross, currency);
    case 'returnRate': return row.returnRate;
    case 'units': return row.units;
    case 'avgUnits': return row.avgUnitsPerMonth;
    case 'avgPrice': return pick(row.avgPrice, currency);
    case 'reach': return row.clientCount * 1e6 + row.posCount;
  }
}

function sortRows(rows: CatalogoRow[], key: SortKey, dir: SortDir, currency: Currency): CatalogoRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key, currency);
    const bv = sortValue(b, key, currency);
    // Nulls last in both directions.
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    let cmp = 0;
    if (av !== null && bv !== null) {
      cmp = typeof av === 'string' ? av.localeCompare(String(bv), 'es') : (av as number) - (bv as number);
    }
    return sign * cmp || a.label.localeCompare(b.label, 'es') || a.key.localeCompare(b.key);
  });
}

function defaultSort(metric: Metric): { key: SortKey; dir: SortDir } {
  return { key: metric === 'unidades' ? 'units' : 'net', dir: 'desc' };
}

function firstDir(key: SortKey): SortDir {
  return key === 'label' || key === 'pareto' ? 'asc' : 'desc';
}

// Null USD (no rate) is "Sin datos", never $0.
function amountText(amount: DualAmount, currency: Currency, format = moneyLabel): string {
  return pick(amount, currency) === null ? 'Sin datos' : format(amount, currency);
}

function TrendCell({ trendPct }: { trendPct: number | null }) {
  if (trendPct === null) return <span className="text-gray-400">Sin datos</span>;
  const text = signedPct(trendPct);
  const tone = text.startsWith('+') ? 'up' : text.startsWith('−') ? 'down' : 'flat';
  const cls = tone === 'up' ? 'text-green-700' : tone === 'down' ? 'text-red-700' : 'text-gray-600';
  return (
    <span data-trend={tone} className={`inline-flex items-center gap-1 font-medium tabular-nums ${cls}`}>
      <span aria-hidden="true">{tone === 'up' ? '▲' : tone === 'down' ? '▼' : '■'}</span>
      {text}
    </span>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${new Intl.NumberFormat('es-VE').format(n)} ${n === 1 ? one : many}`;
}

function ReturnRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-400">—</span>;
  const tone = rate > RETURN_RATE_ALERT ? 'alert' : rate > RETURN_RATE_WARN ? 'warn' : 'neutral';
  const cls = tone === 'alert'
    ? 'bg-red-100 text-red-800 border-red-200'
    : tone === 'warn'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';
  const title = tone === 'alert'
    ? `Tasa de devolución muy alta (más de ${pct(RETURN_RATE_ALERT)})`
    : tone === 'warn' ? `Tasa de devolución alta (más de ${pct(RETURN_RATE_WARN)})` : undefined;
  return (
    <span data-tone={tone} title={title} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {tone !== 'neutral' && <span aria-hidden="true">{tone === 'alert' ? '▲▲' : '▲'}</span>}
      {pct(rate)}
    </span>
  );
}

export default function MasterTable({ rows, currency, metric, nivel, loading, error, highlightKey = null }: MasterTableProps) {
  const [sort, setSort] = useState<{ metric: Metric; key: SortKey; dir: SortDir } | null>(null);
  // A metric switch resets to that metric's default sort.
  const active = sort !== null && sort.metric === metric ? sort : { metric, ...defaultSort(metric) };
  const metricKey: SortKey = metric === 'unidades' ? 'units' : 'net';

  if (loading) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>;
  }
  if (error) {
    return <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
        Sin productos para los filtros seleccionados.
      </div>
    );
  }

  const sorted = sortRows(rows, active.key, active.dir, currency);

  function handleSort(key: SortKey) {
    setSort(active.key === key
      ? { metric, key, dir: active.dir === 'asc' ? 'desc' : 'asc' }
      : { metric, key, dir: firstDir(key) });
  }

  const highlight = (key: SortKey) => (key === metricKey ? 'bg-blue-50/60' : '');

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Catálogo de productos">
        <thead>
          <tr className="border-b border-gray-200">
            {COLUMNS.map(col => {
              const isSorted = active.key === col.key;
              const ariaSort = isSorted ? (active.dir === 'asc' ? 'ascending' : 'descending') : 'none';
              return (
                <th
                  key={col.key}
                  aria-sort={ariaSort}
                  title={col.title}
                  className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${highlight(col.key)}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={`inline-flex items-center gap-1 uppercase hover:text-gray-900 ${isSorted ? 'text-gray-900' : ''}`}
                  >
                    {col.label ?? NIVEL_LABEL[nivel]}
                    <span aria-hidden="true" className={isSorted ? '' : 'text-gray-300'}>
                      {isSorted ? (active.dir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(row => (
            <tr
              key={row.key}
              id={`prod-row-${row.key}`}
              aria-current={highlightKey === row.key ? 'true' : undefined}
              className={`align-top ${highlightKey === row.key ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : 'hover:bg-gray-50'}`}
            >
              <td className="px-3 py-2 text-gray-800">
                <span data-label className="font-medium">{row.label}</span>
                {nivel === 'sku' && row.code && row.code !== row.label && (
                  <div className="text-xs text-gray-500 tabular-nums">{row.code}</div>
                )}
                {nivel === 'sublinea' && <div className="text-xs text-gray-500">{row.linea}</div>}
                {nivel === 'sku' && (
                  <div title={`${row.linea} › ${row.sublinea}`} className="mt-1 flex items-center gap-1 text-[11px] text-gray-600">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">{row.linea}</span>
                    <span aria-hidden="true" className="text-gray-400">›</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">{row.sublinea}</span>
                  </div>
                )}
              </td>
              <td className="px-3 py-2"><ParetoBadge value={row.pareto} /></td>
              <td className={`px-3 py-2 text-right tabular-nums ${highlight('net')}`}>
                <div className="font-medium text-gray-900">{amountText(row.salesNet, currency)}</div>
                {row.sharePct !== null && <div className="text-xs text-gray-500">{pct(row.sharePct)} del total</div>}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap"><TrendCell trendPct={row.trendPct} /></td>
              <td className="px-3 py-2 text-right tabular-nums">
                <div className="text-gray-900">{amountText(row.salesGross, currency)}</div>
                <div data-returns title="Devoluciones" className="text-xs text-red-600">
                  − {amountText(row.returns, currency)}
                </div>
              </td>
              <td className="px-3 py-2 text-right"><ReturnRateBadge rate={row.returnRate} /></td>
              <td className={`px-3 py-2 text-right tabular-nums text-gray-900 ${highlight('units')}`}>{qty(row.units)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{qty(row.avgUnitsPerMonth)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{row.units === 0 ? 'Sin datos' : amountText(row.avgPrice, currency, priceLabel)}</td>
              <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                {plural(row.clientCount, 'cliente', 'clientes')} · {plural(row.posCount, 'tienda', 'tiendas')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
