'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { BreakdownRow, Currency, DateRange, PivotDimension, VentasResponse, VentasRow, GroupBy } from '../types';

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

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'mes', label: 'Por mes' },
  { value: 'cliente', label: 'Por cliente' },
  { value: 'linea', label: 'Por línea' },
];

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
  const [groupBy, setGroupBy] = useState<GroupBy>('mes');
  const [month, setMonth] = useState<string | null>(null);
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [data, setData] = useState<VentasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy === 'cliente') {
          params.set('clienteDimension', clienteDimension);
          if (month) params.set('month', month);
        }
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: VentasResponse = await res.json();
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, groupBy, month, clienteDimension]);

  function handleGroupByChange(next: GroupBy) {
    if (next !== 'cliente') setMonth(null);
    setGroupBy(next);
  }

  function handleBarClick(value: string) {
    if (groupBy === 'mes') {
      setMonth(value);
      setGroupBy('cliente');
    }
  }

  function handleBreadcrumbClick(index: number, crumbGroupBy: GroupBy) {
    if (index === 0) {
      setMonth(null);
    }
    setGroupBy(crumbGroupBy);
  }

  const rate = data?.usdRate ?? undefined;
  const chartData = (data?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    salesNet: r.salesNet,
  }));

  const tableRows: VentasTableRow[] = useMemo(
    () => (data?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [data]
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
      format: row => moneyLabel(row.salesNet, currency, rate),
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

  const subtitleByGroupBy: Record<GroupBy, string> = {
    mes: 'Ventas netas por mes — clic en una barra para ver clientes de ese mes',
    cliente: month ? 'Top clientes del mes seleccionado' : 'Top clientes por ingreso neto',
    linea: 'Ventas netas por línea de producto',
  };

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Drill-down toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
          {GROUP_BY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleGroupByChange(opt.value)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                groupBy === opt.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        {data && data.breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            {data.breadcrumb.map((crumb, i) => (
              <span key={`${crumb.groupBy}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">/</span>}
                {i === data.breadcrumb.length - 1 ? (
                  <span className="font-medium text-gray-800">{crumb.label}</span>
                ) : (
                  <button
                    onClick={() => handleBreadcrumbClick(i, crumb.groupBy)}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {crumb.label}
                  </button>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {loading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}

      {!loading && error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      )}

      {!loading && !error && (
        <ChartCard title="Tendencia de ventas" subtitle={subtitleByGroupBy[groupBy]}>
          {chartData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={chartData} layout={groupBy === 'mes' ? 'horizontal' : 'vertical'} margin={{ top: 8, left: groupBy === 'mes' ? 0 : 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                {groupBy === 'mes' ? (
                  <>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
                  </>
                ) : (
                  <>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => money(v, currency, rate)} />
                    <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />
                  </>
                )}
                <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
                <Bar
                  dataKey="salesNet"
                  fill="#2563eb"
                  radius={groupBy === 'mes' ? [3, 3, 0, 0] : [0, 3, 3, 0]}
                  cursor={groupBy === 'mes' ? 'pointer' : undefined}
                  onClick={groupBy === 'mes' ? (entry: any) => handleBarClick(entry.payload?.value) : undefined}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {!loading && !error && data && groupBy === 'cliente' && (
        <GroupedDrilldownTable<VentasTableRow>
          rows={tableRows}
          columns={clienteColumns}
          groupByOptions={CLIENTE_GROUP_BY_OPTIONS}
          groupBy={clienteDimension}
          onGroupByChange={next => setClienteDimension(next as 'cliente_entidad' | 'cliente_tienda')}
          breakdownByOptions={BREAKDOWN_BY_OPTIONS}
          breakdownBy={breakdownBy}
          onBreakdownByChange={setBreakdownBy}
          onFetchBreakdown={handleFetchBreakdown}
          formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
        />
      )}

      {!loading && !error && data && groupBy === 'linea' && (
        <GroupedDrilldownTable<VentasTableRow>
          rows={tableRows}
          columns={clienteColumns}
          groupByOptions={LINEA_GROUP_BY_OPTIONS}
          groupBy="producto"
          onGroupByChange={() => {}}
          breakdownByOptions={LINEA_BREAKDOWN_BY_OPTIONS}
          breakdownBy={lineaBreakdownBy}
          onBreakdownByChange={setLineaBreakdownBy}
          onFetchBreakdown={handleFetchLineaBreakdown}
          formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
        />
      )}

      {!loading && !error && data && groupBy === 'mes' && (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                  Mes
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Desc. prom.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    Sin datos disponibles todavía.
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={`${r.value}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="px-3 py-2 text-gray-800">{r.label}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(r.salesNet, currency, rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.returnRate !== null ? `${(r.returnRate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.avgDiscount !== null ? `${(r.avgDiscount * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
