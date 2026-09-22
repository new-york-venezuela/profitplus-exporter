'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { BreakdownRow, ComprasResponse, ComprasRow, Currency, DateRange, PivotDimension } from '../types';

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
  const [mesData, setMesData] = useState<ComprasResponse | null>(null);
  const [mesLoading, setMesLoading] = useState<boolean>(true);
  const [mesError, setMesError] = useState<string | null>(null);

  const [month, setMonth] = useState<string | null>(null);
  const [proveedorData, setProveedorData] = useState<ComprasResponse | null>(null);
  const [proveedorLoading, setProveedorLoading] = useState<boolean>(true);
  const [proveedorError, setProveedorError] = useState<string | null>(null);

  const [lineaData, setLineaData] = useState<ComprasResponse | null>(null);
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
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
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
      setProveedorError(null);
      setProveedorLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'proveedor' });
        if (month) params.set('month', month);
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setProveedorError(body.error ?? 'Error desconocido');
          return;
        }
        setProveedorData(await res.json());
      } catch {
        if (!cancelled) setProveedorError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setProveedorLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLineaError(null);
      setLineaLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea' });
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
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

  function handleBarClick(value: string) {
    setMonth(value);
    document.getElementById('compras-proveedor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const mesRate = mesData?.usdRate ?? undefined;
  const chartData = (mesData?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    purchasesNet: r.purchasesNet,
  }));

  const proveedorRate = proveedorData?.usdRate ?? undefined;
  const proveedorTableRows: ComprasTableRow[] = useMemo(
    () => (proveedorData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [proveedorData]
  );

  const lineaRate = lineaData?.usdRate ?? undefined;
  const lineaTableRows: ComprasTableRow[] = useMemo(
    () => (lineaData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [lineaData]
  );

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea', breakdownBy: dimension, parentValue });
    const res = await fetch(`/api/dwh/compras?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const proveedorColumns: DrilldownColumn<ComprasTableRow>[] = [
    {
      key: 'purchasesNet',
      label: 'Compras netas',
      align: 'right',
      format: row => moneyLabel(row.purchasesNet, currency, proveedorRate),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  const lineaColumns: DrilldownColumn<ComprasTableRow>[] = [
    {
      key: 'purchasesNet',
      label: 'Compras netas',
      align: 'right',
      format: row => moneyLabel(row.purchasesNet, currency, lineaRate),
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
          <ChartCard title="Tendencia de compras" subtitle="Compras netas por mes — clic en una barra para ver proveedores de ese mes">
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
                    dataKey="purchasesNet"
                    fill="#2563eb"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: { payload?: { value: string } }) => {
                      if (entry.payload) handleBarClick(entry.payload.value);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </section>

      {/* Por proveedor */}
      <section id="compras-proveedor-section">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Por proveedor{month ? ` — ${month}` : ''}
        </h3>
        {proveedorLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!proveedorLoading && proveedorError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{proveedorError}</p>
        )}
        {!proveedorLoading && !proveedorError && proveedorData && (
          <GroupedDrilldownTable<ComprasTableRow>
            rows={proveedorTableRows}
            columns={proveedorColumns}
            groupByOptions={PROVEEDOR_GROUP_BY_OPTIONS}
            groupBy="proveedor"
            onGroupByChange={() => {}}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, proveedorRate) : String(value ?? '—'))}
          />
        )}
        {month && (
          <button onClick={() => setMonth(null)} className="mt-2 text-xs text-blue-600 hover:underline">
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
          <GroupedDrilldownTable<ComprasTableRow>
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
