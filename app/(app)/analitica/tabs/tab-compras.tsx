'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import type { BreakdownRow, ComprasResponse, ComprasRow, Currency, DateRange, GroupBy, PivotDimension } from '../types';

function money(n: number, currency: Currency = 'bs', rate?: number): string {
  if (currency === 'usd' && rate) {
    n = n / rate;
  }
  const format = currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  return format.format(n);
}

function moneyLabel(n: number, currency: Currency, rate?: number): string {
  return `${currency === 'usd' ? '$' : 'Bs. '}${money(n, currency, rate)}`;
}

function moneyTooltip(value: unknown, currency: Currency = 'bs', rate?: number): string {
  const numVal = Number(Array.isArray(value) ? value[0] : value);
  return moneyLabel(numVal, currency, rate);
}

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
  { value: 'proveedor', label: 'Por proveedor' },
  { value: 'linea', label: 'Por línea' },
];

// "Por proveedor" has a single grain (unlike Ventas' cliente Entidad/Tienda
// toggle) — suppliers don't have the multi-store fragmentation problem
// customers do. GroupedDrilldownTable still requires a groupBy/groupByOptions
// pair, so this is fixed to a single no-op option, same pattern Ventas uses
// for its "linea" view below.
const PROVEEDOR_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'proveedor', label: 'Proveedor' },
];

const LINEA_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Línea' },
];

// Línea can only break down into its own products — reusing the shared
// 'producto' Dimension as a sentinel value the API routes to a dedicated
// línea→producto query, not the generic proveedor-parent breakdown path.
const LINEA_BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
];

interface ComprasTableRow extends ComprasRow {
  label: string;
  value: string;
}

export default function TabCompras({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>('mes');
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<ComprasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy === 'proveedor' && month) params.set('month', month);
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ComprasResponse = await res.json();
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
  }, [dateRange, currency, groupBy, month]);

  function handleGroupByChange(next: GroupBy) {
    if (next !== 'proveedor') setMonth(null);
    setGroupBy(next);
  }

  function handleBarClick(value: string) {
    if (groupBy === 'mes') {
      setMonth(value);
      setGroupBy('proveedor');
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
    purchasesNet: r.purchasesNet,
  }));

  const tableRows: ComprasTableRow[] = useMemo(
    () => (data?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [data]
  );

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea', breakdownBy: dimension, parentValue });
    const res = await fetch(`/api/dwh/compras?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const columns: DrilldownColumn<ComprasTableRow>[] = [
    {
      key: 'purchasesNet',
      label: 'Compras netas',
      align: 'right',
      format: row => moneyLabel(row.purchasesNet, currency, rate),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  const subtitleByGroupBy: Record<GroupBy, string> = {
    mes: 'Compras netas por mes — clic en una barra para ver proveedores de ese mes',
    proveedor: month ? 'Top proveedores del mes seleccionado' : 'Top proveedores por monto',
    linea: 'Compras netas por línea de producto',
  };

  return (
    <div className="p-6 max-w-7xl space-y-6">
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
        <ChartCard title="Tendencia de compras" subtitle={subtitleByGroupBy[groupBy]}>
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
                  dataKey="purchasesNet"
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

      {!loading && !error && data && groupBy === 'proveedor' && (
        <GroupedDrilldownTable<ComprasTableRow>
          rows={tableRows}
          columns={columns}
          groupByOptions={PROVEEDOR_GROUP_BY_OPTIONS}
          groupBy="proveedor"
          onGroupByChange={() => {}}
          formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
        />
      )}

      {!loading && !error && data && groupBy === 'linea' && (
        <GroupedDrilldownTable<ComprasTableRow>
          rows={tableRows}
          columns={columns}
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
    </div>
  );
}
