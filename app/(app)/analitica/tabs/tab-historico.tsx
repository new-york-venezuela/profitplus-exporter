'use client';

import { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type {
  BreakdownRow, Currency, PivotDimension, HistoricoResponse, HistoricoRow, HistoricoKpisResponse,
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
      <p className="font-semibold mb-1">Datos del sistema anterior (enero 2025 – febrero 2026)</p>
      <p>
        Estos datos provienen del sistema anterior a la migración de marzo de 2026.
        Los clientes, productos y vendedores de este período son identidades
        independientes de los datos actuales — no se pueden cruzar ni sumar con
        las cifras de 2026 en adelante.
      </p>
    </div>
  );
}

// "Por línea" has no alternate grain — GroupedDrilldownTable requires a
// groupBy/groupByOptions pair, fixed to a single no-op option, same pattern
// as tab-ventas.tsx's LINEA_GROUP_BY_OPTIONS.
const LINEA_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Línea' },
];

const LINEA_BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
];

interface HistoricoTableRow extends HistoricoRow {
  label: string;
  value: string;
}

// Mirrors tab-ventas.tsx's formatBreakdownMoney: the línea→producto
// breakdown query (lineaProductBreakdownQuery in historico/route.ts) ships
// its money metric as two flat keys — salesNetBs/salesNetUsd — since
// BreakdownRow's index signature can't hold a nested DualAmount object.
// hiddenMetricKeys (passed to GroupedDrilldownTable below) keeps
// salesNetUsd from also rendering as its own column.
function formatBreakdownMoney(row: BreakdownRow, currency: Currency): string {
  const bs = row.salesNetBs;
  const usd = row.salesNetUsd;
  if (typeof bs !== 'number') return String(bs ?? '—');
  return moneyLabel({ bs, usd: typeof usd === 'number' ? usd : null }, currency);
}

export default function TabHistorico({ currency }: { currency: Currency }) {
  // Four independently-fetched sections, same shape as tab-ventas.tsx: each
  // section keeps its own loading/error/data state so one slow query
  // doesn't block the others from rendering. No dateRange prop — this
  // tab's window is fixed (Jan 2025-Feb 2026), so none of these effects
  // depend on it.
  const [mesData, setMesData] = useState<HistoricoResponse | null>(null);
  const [mesLoading, setMesLoading] = useState<boolean>(true);
  const [mesError, setMesError] = useState<string | null>(null);

  const [month, setMonth] = useState<string | null>(null);
  const [clienteData, setClienteData] = useState<HistoricoResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);

  const [lineaData, setLineaData] = useState<HistoricoResponse | null>(null);
  const [lineaLoading, setLineaLoading] = useState<boolean>(true);
  const [lineaError, setLineaError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  const [kpisData, setKpisData] = useState<HistoricoKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState<boolean>(true);
  const [kpisError, setKpisError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMesError(null);
      setMesLoading(true);
      try {
        const params = new URLSearchParams({ groupBy: 'mes' });
        const res = await fetch(`/api/dwh/historico?${params.toString()}`);
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setClienteError(null);
      setClienteLoading(true);
      try {
        const params = new URLSearchParams({ groupBy: 'cliente' });
        if (month) params.set('month', month);
        const res = await fetch(`/api/dwh/historico?${params.toString()}`);
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
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLineaError(null);
      setLineaLoading(true);
      try {
        const params = new URLSearchParams({ groupBy: 'linea' });
        const res = await fetch(`/api/dwh/historico?${params.toString()}`);
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setKpisError(null);
      setKpisLoading(true);
      try {
        const params = new URLSearchParams({ section: 'kpis' });
        const res = await fetch(`/api/dwh/historico?${params.toString()}`);
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
  }, []);

  // Clicking a month bar scopes the cliente section to that month and
  // scrolls it into view — same behavior as tab-ventas.tsx's handleBarClick.
  function handleBarClick(value: string) {
    setMonth(value);
    document.getElementById('historico-cliente-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const chartData = (mesData?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    salesNet: currency === 'usd' ? r.salesNet.usd : r.salesNet.bs,
  }));

  const clienteTableRows: HistoricoTableRow[] = (clienteData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) }));

  const lineaTableRows: HistoricoTableRow[] = (lineaData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) }));

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ groupBy: 'linea', breakdownBy: dimension, parentValue });
    const res = await fetch(`/api/dwh/historico?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const lineaColumns: DrilldownColumn<HistoricoTableRow>[] = [
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      format: row => moneyLabel(row.salesNet, currency),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      format: row => (row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'),
    },
  ];

  const kpis = kpisData?.kpis;

  return (
    <div className="p-6 max-w-7xl space-y-8">
      <DisclaimerBanner />

      {/* KPIs */}
      <section>
        {kpisLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!kpisLoading && kpisError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{kpisError}</p>
        )}
        {!kpisLoading && !kpisError && kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Ventas netas" value={moneyLabel(kpis.salesNet, currency)} />
            <KpiCard label="Clientes activos" value={kpis.activeClients.toLocaleString('es-VE')} />
            <KpiCard label="Ticket promedio" value={kpis.avgTicket !== null ? moneyLabel(kpis.avgTicket, currency) : '—'} />
            <KpiCard label="Unidades vendidas" value={kpis.unitsSold.toLocaleString('es-VE')} />
          </div>
        )}
      </section>

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
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
                  <Tooltip formatter={val => moneyTooltip(val, currency)} />
                  <Bar
                    dataKey="salesNet"
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

      {/* Por cliente */}
      <section id="historico-cliente-section">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Por cliente{month ? ` — ${month}` : ''}
        </h3>
        {clienteLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!clienteLoading && clienteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{clienteError}</p>
        )}
        {!clienteLoading && !clienteError && clienteData && clienteData.rows.length === 0 && <EmptyState />}
        {!clienteLoading && !clienteError && clienteData && clienteData.rows.length > 0 && (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clienteTableRows.map((row, i) => (
                  <tr key={row.value} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{row.label}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{moneyLabel(row.salesNet, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <GroupedDrilldownTable<HistoricoTableRow>
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
            hiddenMetricKeys={['salesNetUsd']}
          />
        )}
      </section>
    </div>
  );
}
