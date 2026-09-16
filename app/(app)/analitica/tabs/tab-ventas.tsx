'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { BreakdownRow, Currency, DateRange, PivotDimension, VentasResponse, VentasRow } from '../types';

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

export default function TabVentas({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  // Three independently-fetched sections, always rendered together (Part 1
  // of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md
  // — no more groupBy toggle hiding two of the three). Each section keeps
  // its own loading/error/data state so one slow query doesn't block the
  // others from rendering.
  const [mesData, setMesData] = useState<VentasResponse | null>(null);
  const [mesLoading, setMesLoading] = useState<boolean>(true);
  const [mesError, setMesError] = useState<string | null>(null);

  const [month, setMonth] = useState<string | null>(null);
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [clienteData, setClienteData] = useState<VentasResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  const [lineaData, setLineaData] = useState<VentasResponse | null>(null);
  const [lineaLoading, setLineaLoading] = useState<boolean>(true);
  const [lineaError, setLineaError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMesError(null);
      setMesLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'mes' });
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
  }, [dateRange, currency]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setClienteError(null);
      setClienteLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'cliente', clienteDimension });
        if (month) params.set('month', month);
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
  }, [dateRange, currency, clienteDimension, month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLineaError(null);
      setLineaLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea' });
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
  }, [dateRange, currency]);

  // Clicking a month bar no longer swaps which section is visible (there is
  // only one layout now) — it just scopes the always-visible cliente
  // section to that month and scrolls it into view.
  function handleBarClick(value: string) {
    setMonth(value);
    document.getElementById('ventas-cliente-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const mesRate = mesData?.usdRate ?? undefined;
  const chartData = (mesData?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    salesNet: r.salesNet,
  }));

  const clienteRate = clienteData?.usdRate ?? undefined;
  const clienteTableRows: VentasTableRow[] = useMemo(
    () => (clienteData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [clienteData]
  );

  const lineaRate = lineaData?.usdRate ?? undefined;
  const lineaTableRows: VentasTableRow[] = useMemo(
    () => (lineaData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [lineaData]
  );

  async function handleFetchBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      currency,
      groupBy: 'cliente',
      clienteDimension,
      breakdownBy: dimension,
      parentValue,
    });
    if (month) params.set('month', month);
    const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      currency,
      groupBy: 'linea',
      breakdownBy: dimension,
      parentValue,
    });
    const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const clienteColumns: DrilldownColumn<VentasTableRow>[] = [
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      format: row => moneyLabel(row.salesNet, currency, clienteRate),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      format: row => (row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  const lineaColumns: DrilldownColumn<VentasTableRow>[] = [
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      format: row => moneyLabel(row.salesNet, currency, lineaRate),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      format: row => (row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  return (
    <div className="p-6 max-w-7xl space-y-8">
      {/* Por mes */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por mes</h3>
        {mesLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!mesLoading && mesError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{mesError}</p>
        )}
        {!mesLoading && !mesError && (
          <ChartCard title="Tendencia de ventas" subtitle="Ventas netas por mes — clic en una barra para ver clientes de ese mes">
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={chartData} margin={{ top: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, mesRate)} />
                  <Tooltip formatter={val => moneyTooltip(val, currency, mesRate)} />
                  <Bar
                    dataKey="salesNet"
                    fill="#2563eb"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: any) => handleBarClick(entry.payload?.value)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </section>

      {/* Por cliente */}
      <section id="ventas-cliente-section">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Por cliente{month ? ` — ${month}` : ''}
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
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, clienteRate) : String(value ?? '—'))}
          />
        )}
        {month && (
          <button
            onClick={() => setMonth(null)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Quitar filtro de mes
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
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, lineaRate) : String(value ?? '—'))}
          />
        )}
      </section>
    </div>
  );
}
