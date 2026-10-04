'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import { bucketLabels, bucketTitle, TREND_UNIT_LABEL } from '../lib/granularity';
import { RETURNS_BASIS_LABEL } from '../lib/net-sales';
import type { Granularity } from '../lib/granularity';
import type {
  BreakdownRow, Currency, DateRange, PivotDimension, VentasResponse, VentasRow,
  VentasKpisResponse, ComparisonOptionsResponse, VentasComparisonResponse, ReturnsBasis,
} from '../types';

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

function KpiCard({ label, value, delta, title }: { label: string; value: string; delta?: { pct: number | null; label: string }; title?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" title={title}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium ${delta.pct === null ? 'text-gray-400' : delta.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {delta.pct === null ? '—' : `${delta.pct >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct * 100).toFixed(1)}%`} {delta.label}
        </p>
      )}
    </div>
  );
}

const COMPARISON_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626'];

// Multi-select comparison chart (línea or cliente/cadena): up to 4 checkbox
// options, each toggled series becomes one <Line>. Shared between the
// "Por línea" and "Por cadena" comparison sections below — they differ only
// in which options/section param they fetch.
function ComparisonChart({
  options,
  selected,
  onToggle,
  data,
  loading,
  error,
  currency,
  maxSelected = 4,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  data: VentasComparisonResponse | null;
  loading: boolean;
  error: string | null;
  currency: Currency;
  maxSelected?: number;
}) {
  const mode = data?.trendMode ?? 'month';
  const xLabels = bucketLabels(mode, (data?.rows ?? []).map(r => r.bucket));
  const chartData = (data?.rows ?? []).map((row, i) => {
    const flat: Record<string, string | number | null> = { label: xLabels[i], title: bucketTitle(mode, row.bucket) };
    for (const [key, amount] of Object.entries(row.values)) {
      flat[key] = currency === 'usd' ? amount.usd : amount.bs;
    }
    return flat;
  });
  const labelFor = (value: string) => options.find(o => o.value === value)?.label ?? value;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {options.map(opt => {
          const isSelected = selected.includes(opt.value);
          const disabled = !isSelected && selected.length >= maxSelected;
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              disabled={disabled}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : disabled
                  ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected.length === 0 ? (
        <EmptyState message="Selecciona entre 1 y 4 opciones para comparar." />
      ) : loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      ) : chartData.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
            <Tooltip formatter={val => moneyTooltip(val, currency)} labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => labelFor(value)} />
            {selected.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                strokeWidth={2}
                dot
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// "Por cliente" always groups by cliente_entidad or cliente_tienda. The
// Entidad/Tienda toggle is rendered by GroupedDrilldownTable itself (its
// "Agrupar por" <select>, wired to clienteDimension via groupBy/
// onGroupByChange below) — there is no separate hand-rolled toggle here.
// Breakdown options are producto/vendedor per spec §5 — NOT cliente_tienda,
// which would collide aliases with a cliente_entidad parent (see
// query-builder.ts correlate()).
const CLIENTE_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'cliente_entidad', label: 'Entidad' },
  { value: 'cliente_tienda', label: 'Tienda' },
];

const BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
  { value: 'vendedor', label: 'Vendedor' },
];

// "Por línea" has no alternate grain (unlike cliente's Entidad/Tienda), but
// GroupedDrilldownTable requires a groupBy/groupByOptions pair — fixed to a
// single no-op option, same pattern as tab-vendedores.tsx.
const LINEA_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Línea' },
];

// Línea can only break down into its own products — reusing the shared
// 'producto' Dimension as a sentinel value the API routes to a dedicated
// línea→producto query, not the generic cliente-parent breakdown path.
const LINEA_BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
];

interface VentasTableRow extends VentasRow {
  label: string;
  value: string;
}

// BreakdownRow's index signature can't hold a nested DualAmount object, so
// the salesGross money metric ships as two flat keys — salesGrossBs/salesGrossUsd
// (see the ventas route's breakdown queries) — and this picks the right one
// for the caller's currency toggle, formatting via moneyLabel like every
// other money cell in this tab. hiddenMetricKeys (passed to
// GroupedDrilldownTable below) keeps salesGrossUsd from also rendering as its
// own column.
function formatBreakdownMoney(row: BreakdownRow, currency: Currency): string {
  const bs = row.salesGrossBs;
  const usd = row.salesGrossUsd;
  if (typeof bs !== 'number') return String(bs ?? '—');
  return moneyLabel({ bs, usd: typeof usd === 'number' ? usd : null }, currency);
}

export default function TabVentas({
  dateRange,
  currency,
  granularity,
}: {
  dateRange: DateRange;
  currency: Currency;
  granularity: Granularity;
}) {
  // Three independently-fetched sections, always rendered together (Part 1
  // of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md
  // — no more groupBy toggle hiding two of the three). Each section keeps
  // its own loading/error/data state so one slow query doesn't block the
  // others from rendering.
  // Which date devoluciones are attributed to (see ReturnsBasis in
  // query-builder.ts). 'factura' (default) makes "Ventas netas" match a
  // per-factura reconciliation; 'devolucion' shows returns in the period the
  // nota de crédito was issued.
  const [returnsBasis, setReturnsBasis] = useState<ReturnsBasis>('factura');
  const [mesData, setMesData] = useState<VentasResponse | null>(null);
  const [mesLoading, setMesLoading] = useState<boolean>(true);
  const [mesError, setMesError] = useState<string | null>(null);

  // The clicked trend bar. A bucket key only means something for the
  // granularity/range it was clicked under, so it is dropped (derived, not
  // reset in an effect) as soon as either changes.
  const [bucketSel, setBucketSel] = useState<{ key: string; granularity: Granularity; dateRange: DateRange } | null>(null);
  const bucket = bucketSel && bucketSel.granularity === granularity && bucketSel.dateRange === dateRange ? bucketSel.key : null;
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [clienteData, setClienteData] = useState<VentasResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  const [lineaData, setLineaData] = useState<VentasResponse | null>(null);
  const [lineaLoading, setLineaLoading] = useState<boolean>(true);
  const [lineaError, setLineaError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  const [kpisData, setKpisData] = useState<VentasKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState<boolean>(true);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const [comparisonOptions, setComparisonOptions] = useState<ComparisonOptionsResponse | null>(null);

  const [lineaCompareKeys, setLineaCompareKeys] = useState<string[]>([]);
  const [lineaCompareData, setLineaCompareData] = useState<VentasComparisonResponse | null>(null);
  const [lineaCompareLoading, setLineaCompareLoading] = useState<boolean>(false);
  const [lineaCompareError, setLineaCompareError] = useState<string | null>(null);

  const [clienteCompareKeys, setClienteCompareKeys] = useState<string[]>([]);
  const [clienteCompareData, setClienteCompareData] = useState<VentasComparisonResponse | null>(null);
  const [clienteCompareLoading, setClienteCompareLoading] = useState<boolean>(false);
  const [clienteCompareError, setClienteCompareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMesError(null);
      setMesLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, groupBy: 'mes', granularity, returnsBasis });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMesError(body.error ?? 'Error desconocido');
          return;
        }
        setMesData(await res.json());
      } catch {
        if (!cancelled) setMesError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setMesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, granularity, returnsBasis]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setClienteError(null);
      setClienteLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, groupBy: 'cliente', clienteDimension, granularity, returnsBasis });
        if (bucket) params.set('bucket', bucket);
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setClienteError(body.error ?? 'Error desconocido');
          return;
        }
        setClienteData(await res.json());
      } catch {
        if (!cancelled) setClienteError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setClienteLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, clienteDimension, granularity, bucket, returnsBasis]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLineaError(null);
      setLineaLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, groupBy: 'linea', returnsBasis });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLineaError(body.error ?? 'Error desconocido');
          return;
        }
        setLineaData(await res.json());
      } catch {
        if (!cancelled) setLineaError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLineaLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, returnsBasis]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setKpisError(null);
      setKpisLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, section: 'kpis', returnsBasis });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setKpisError(body.error ?? 'Error desconocido');
          return;
        }
        setKpisData(await res.json());
      } catch {
        if (!cancelled) setKpisError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setKpisLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, returnsBasis]);

  // Comparison option catalogs (top líneas / top cadenas by sales in range)
  // — refetched whenever dateRange changes so the multi-select always offers
  // series that actually have data in the current window; selections are
  // reset when the option list changes underneath them (handled in the
  // effect below) rather than left pointing at now-irrelevant keys.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({ dateRange, section: 'comparisonOptions' });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled || !res.ok) return;
        const body: ComparisonOptionsResponse = await res.json();
        if (cancelled) return;
        setComparisonOptions(body);
        setLineaCompareKeys(prev => {
          const valid = new Set(body.lineas.map(o => o.value));
          const kept = prev.filter(k => valid.has(k));
          return kept.length > 0 ? kept : body.lineas.slice(0, 2).map(o => o.value);
        });
        setClienteCompareKeys(prev => {
          const valid = new Set(body.clientes.map(o => o.value));
          const kept = prev.filter(k => valid.has(k));
          return kept.length > 0 ? kept : body.clientes.slice(0, 2).map(o => o.value);
        });
      } catch {
        // Non-critical for the rest of the tab — comparison charts simply
        // stay empty if this fails; no dedicated error state needed here.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    // No fetch when nothing is selected — ComparisonChart already renders
    // its own "select 1-4 options" empty state from `selected.length === 0`
    // regardless of stale `data`, so there's nothing to clear here.
    if (lineaCompareKeys.length === 0) return;
    let cancelled = false;
    async function load() {
      setLineaCompareError(null);
      setLineaCompareLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, section: 'comparisonLinea', keys: lineaCompareKeys.join(','), granularity });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLineaCompareError(body.error ?? 'Error desconocido');
          return;
        }
        setLineaCompareData(await res.json());
      } catch {
        if (!cancelled) setLineaCompareError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLineaCompareLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, granularity, lineaCompareKeys]);

  useEffect(() => {
    if (clienteCompareKeys.length === 0) return;
    let cancelled = false;
    async function load() {
      setClienteCompareError(null);
      setClienteCompareLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, section: 'comparisonCliente', keys: clienteCompareKeys.join(','), granularity });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setClienteCompareError(body.error ?? 'Error desconocido');
          return;
        }
        setClienteCompareData(await res.json());
      } catch {
        if (!cancelled) setClienteCompareError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setClienteCompareLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, granularity, clienteCompareKeys]);

  function toggleLineaCompare(value: string) {
    setLineaCompareKeys(prev => (prev.includes(value) ? prev.filter(v => v !== value) : prev.length >= 4 ? prev : [...prev, value]));
  }

  function toggleClienteCompare(value: string) {
    setClienteCompareKeys(prev => (prev.includes(value) ? prev.filter(v => v !== value) : prev.length >= 4 ? prev : [...prev, value]));
  }

  // Clicking a trend bar no longer swaps which section is visible (there is
  // only one layout now) — it just scopes the always-visible cliente
  // section to that day/week/month and scrolls it into view.
  function handleBarClick(value: string) {
    setBucketSel({ key: value, granularity, dateRange });
    document.getElementById('ventas-cliente-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const trendMode = mesData?.trendMode ?? 'month';
  const chartData = (mesData?.rows ?? []).map(r => ({
    label: r.label,
    title: r.title ?? r.label,
    value: String(r.value),
    salesGross: currency === 'usd' ? r.salesGross.usd : r.salesGross.bs,
    salesNet: currency === 'usd' ? r.salesNet.usd : r.salesNet.bs,
  }));

  const clienteTableRows: VentasTableRow[] = useMemo(
    () => (clienteData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [clienteData]
  );

  const lineaTableRows: VentasTableRow[] = useMemo(
    () => (lineaData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [lineaData]
  );

  async function handleFetchBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      groupBy: 'cliente',
      clienteDimension,
      breakdownBy: dimension,
      parentValue,
    });
    params.set('granularity', granularity);
    if (bucket) params.set('bucket', bucket);
    const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      groupBy: 'linea',
      breakdownBy: dimension,
      parentValue,
    });
    const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const basisLabel = RETURNS_BASIS_LABEL[returnsBasis];
  const moneyColumns: DrilldownColumn<VentasTableRow>[] = [
    {
      key: 'salesGross',
      label: 'Ventas brutas',
      align: 'right',
      title: 'Facturas sin IVA, sin anuladas, netas de descuentos, antes de devoluciones.',
      format: row => moneyLabel(row.salesGross, currency),
    },
    {
      key: 'returns',
      label: 'Devoluciones',
      align: 'right',
      title: `Devoluciones sin IVA, ${basisLabel}.`,
      format: row => moneyLabel(row.returns, currency),
    },
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      title: `Ventas brutas − devoluciones (${basisLabel}).`,
      format: row => moneyLabel(row.salesNet, currency),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      title: 'Devoluciones ÷ ventas brutas.',
      format: row => (row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];
  const clienteColumns = moneyColumns;
  const lineaColumns = moneyColumns;

  const kpis = kpisData?.kpis;
  const salesDelta = kpis && kpis.salesNetPrevPeriod !== null && kpis.salesNetPrevPeriod.bs !== 0
    ? (kpis.salesNet.bs - kpis.salesNetPrevPeriod.bs) / kpis.salesNetPrevPeriod.bs
    : null;

  return (
    <div className="p-6 max-w-7xl space-y-8">
      {/* Returns attribution toggle — applies to every section of this tab
          except the comparison charts (which plot ventas brutas only). */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <span>Devoluciones:</span>
        <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label="Fecha de atribución de devoluciones">
          {(['factura', 'devolucion'] as const).map(b => (
            <button
              key={b}
              onClick={() => setReturnsBasis(b)}
              aria-pressed={returnsBasis === b}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                returnsBasis === b ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {RETURNS_BASIS_LABEL[b]}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">
          {returnsBasis === 'factura'
            ? 'Cada devolución resta del período de su factura original (cuadra con un cálculo por factura; un mes cerrado puede cambiar si llegan devoluciones después).'
            : 'Cada devolución resta del período en que se emitió la nota de crédito.'}
        </span>
      </div>

      {/* KPIs */}
      <section>
        {kpisLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!kpisLoading && kpisError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{kpisError}</p>
        )}
        {!kpisLoading && !kpisError && kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Ventas brutas"
              value={moneyLabel(kpis.salesGross, currency)}
              title="Facturas sin IVA, sin anuladas, netas de descuentos, por fecha de factura, antes de devoluciones."
            />
            <KpiCard
              label="Devoluciones"
              value={moneyLabel(kpis.returns, currency)}
              title={`Devoluciones sin IVA, ${basisLabel}.`}
            />
            <KpiCard
              label="Ventas netas"
              value={moneyLabel(kpis.salesNet, currency)}
              delta={{ pct: salesDelta, label: 'vs. período anterior' }}
              title={`Ventas brutas − devoluciones (${basisLabel}).`}
            />
            <KpiCard
              label="Tasa de devolución"
              value={kpis.returnRate !== null ? `${(kpis.returnRate * 100).toFixed(1)}%` : '—'}
              title="Devoluciones ÷ ventas brutas."
            />
            <KpiCard label="Clientes activos" value={kpis.activeClients.toLocaleString('es-VE')} />
            <KpiCard label="Ticket promedio" value={kpis.avgTicket !== null ? moneyLabel(kpis.avgTicket, currency) : '—'} title="Ventas brutas ÷ facturas." />
            <KpiCard label="Unidades vendidas" value={kpis.unitsSold.toLocaleString('es-VE')} title="Unidades facturadas, antes de devoluciones." />
            <KpiCard
              label="Ventas brutas por cliente activo"
              value={kpis.salesPerActiveClient !== null ? moneyLabel(kpis.salesPerActiveClient, currency) : '—'}
            />
          </div>
        )}
      </section>

      {/* Por mes */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por {TREND_UNIT_LABEL[trendMode]}</h3>
        {mesLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!mesLoading && mesError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{mesError}</p>
        )}
        {!mesLoading && !mesError && (
          <ChartCard title="Tendencia de ventas" subtitle={`Ventas brutas (barras) y ventas netas de devoluciones ${basisLabel} (línea) por ${TREND_UNIT_LABEL[trendMode]}${trendMode === 'range' ? '' : ` — clic en una barra para ver clientes de ese ${TREND_UNIT_LABEL[trendMode]}`}`}>
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart data={chartData} margin={{ top: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
                  <Tooltip formatter={val => moneyTooltip(val, currency)} labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="salesGross"
                    name="Ventas brutas"
                    fill="#2563eb"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: { payload?: { value: string } }) => {
                      if (entry.payload) handleBarClick(entry.payload.value);
                    }}
                  />
                  <Line type="monotone" dataKey="salesNet" name="Ventas netas" stroke="#16a34a" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </section>

      {/* Por cliente */}
      <section id="ventas-cliente-section">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Por cliente{bucket ? ` — ${bucketTitle(trendMode, bucket)}` : ''}
        </h3>
        {clienteLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!clienteLoading && clienteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{clienteError}</p>
        )}
        {!clienteLoading && !clienteError && clienteData && (
          <GroupedDrilldownTable<VentasTableRow>
            rows={clienteTableRows}
            columns={clienteColumns}
            groupByOptions={CLIENTE_GROUP_BY_OPTIONS}
            groupBy={clienteDimension}
            onGroupByChange={next => setClienteDimension(next as 'cliente_entidad' | 'cliente_tienda')}
            breakdownByOptions={BREAKDOWN_BY_OPTIONS}
            breakdownBy={breakdownBy}
            onBreakdownByChange={setBreakdownBy}
            onFetchBreakdown={handleFetchBreakdown}
            formatBreakdownMetric={(_key, _value, row) => formatBreakdownMoney(row, currency)}
            hiddenMetricKeys={['salesGrossUsd']}
          />
        )}
        {bucket && (
          <button
            onClick={() => setBucketSel(null)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Quitar filtro de {TREND_UNIT_LABEL[trendMode]}
          </button>
        )}
      </section>

      {/* Por línea */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por línea</h3>
        {lineaLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!lineaLoading && lineaError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{lineaError}</p>
        )}
        {!lineaLoading && !lineaError && lineaData && (
          <GroupedDrilldownTable<VentasTableRow>
            rows={lineaTableRows}
            columns={lineaColumns}
            groupByOptions={LINEA_GROUP_BY_OPTIONS}
            groupBy="producto"
            onGroupByChange={() => {}}
            breakdownByOptions={LINEA_BREAKDOWN_BY_OPTIONS}
            breakdownBy={lineaBreakdownBy}
            onBreakdownByChange={setLineaBreakdownBy}
            onFetchBreakdown={handleFetchLineaBreakdown}
            formatBreakdownMetric={(_key, _value, row) => formatBreakdownMoney(row, currency)}
            hiddenMetricKeys={['salesGrossUsd']}
          />
        )}
      </section>

      {/* Comparación por línea */}
      <ChartCard title="Comparar ventas por línea" subtitle="Selecciona hasta 4 líneas para comparar su tendencia de ventas brutas (antes de devoluciones)">
        <ComparisonChart
          options={comparisonOptions?.lineas ?? []}
          selected={lineaCompareKeys}
          onToggle={toggleLineaCompare}
          data={lineaCompareData}
          loading={lineaCompareLoading}
          error={lineaCompareError}
          currency={currency}
        />
      </ChartCard>

      {/* Comparación por cadena */}
      <ChartCard title="Comparar ventas por cadena" subtitle="Selecciona hasta 4 clientes (entidad/cadena) para comparar su tendencia de ventas brutas (antes de devoluciones)">
        <ComparisonChart
          options={comparisonOptions?.clientes ?? []}
          selected={clienteCompareKeys}
          onToggle={toggleClienteCompare}
          data={clienteCompareData}
          loading={clienteCompareLoading}
          error={clienteCompareError}
          currency={currency}
        />
      </ChartCard>
    </div>
  );
}
