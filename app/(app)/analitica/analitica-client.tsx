'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';

interface MonthlyTrendRow { yearMonth: string; salesNet: number; returnsNet: number }
interface NamedAmount { name: string; netRevenue: number }
interface SalesRepRow { name: string; salesNet: number; returnsNet: number }
interface AgingBucketRow { bucket: string; amount: number }
interface DebtorRow { name: string; outstanding: number }

interface DashboardResponse {
  monthlyTrend: MonthlyTrendRow[];
  topCustomers: NamedAmount[];
  topProducts:  NamedAmount[];
  salesReps:    SalesRepRow[];
  agingBuckets: AgingBucketRow[];
  topDebtors:   DebtorRow[];
  snapshotDateKey: number | null;
  kpis: {
    salesNet12mo:   number;
    returnsNet12mo: number;
    returnRate:     number | null;
    collected12mo:  number;
  };
}

const BUCKET_ORDER = ['Current', '1-30', '31-60', '61-90', '>90'];
const BUCKET_COLORS: Record<string, string> = {
  Current: '#16a34a',
  '1-30':  '#84cc16',
  '31-60': '#eab308',
  '61-90': '#f97316',
  '>90':   '#dc2626',
};

function money(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(n);
}

function moneyTooltip(value: unknown): string {
  return `Bs. ${money(Number(Array.isArray(value) ? value[0] : value))}`;
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatSnapshotDate(key: number | null): string {
  if (key === null) return 'sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
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

export function AnaliticaClient() {
  const [data, setData]       = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await fetch('/api/dwh/dashboard');
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body.error ?? 'No se pudo cargar el panel analítico');
          return;
        }
        const body: DashboardResponse = await res.json();
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando panel analítico…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const trendData = data.monthlyTrend.map(r => ({
    label: formatYearMonth(r.yearMonth),
    Ventas: r.salesNet,
    Devoluciones: r.returnsNet,
  }));

  const orderedBuckets = BUCKET_ORDER
    .map(bucket => data.agingBuckets.find(b => b.bucket === bucket))
    .filter((b): b is AgingBucketRow => b !== undefined);
  const agingData = orderedBuckets.map(b => ({ bucket: b.bucket, Monto: b.amount }));
  const overdueShare = (() => {
    const total = orderedBuckets.reduce((sum, b) => sum + b.amount, 0);
    const overdue = orderedBuckets.filter(b => b.bucket !== 'Current').reduce((sum, b) => sum + b.amount, 0);
    return total > 0 ? overdue / total : null;
  })();

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Analítico</h1>
        <p className="text-sm text-gray-500">
          Ventas, devoluciones, cobranza y cartera — últimos 12 meses, datos del Data Warehouse
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ventas netas (12m)" value={`Bs. ${money(data.kpis.salesNet12mo)}`} />
        <KpiCard label="Devoluciones (12m)" value={`Bs. ${money(data.kpis.returnsNet12mo)}`} />
        <KpiCard
          label="Tasa de devolución"
          value={pct(data.kpis.returnRate)}
          tone={data.kpis.returnRate !== null && data.kpis.returnRate > 0.05 ? 'warn' : 'default'}
        />
        <KpiCard label="Cobrado (12m)" value={`Bs. ${money(data.kpis.collected12mo)}`} />
      </div>

      {/* Sales & returns trend */}
      <ChartCard title="Tendencia de ventas y devoluciones" subtitle="Monto neto por mes, últimos 12 meses">
        {trendData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v)} />
              <Tooltip formatter={moneyTooltip} />
              <Legend />
              <Bar dataKey="Ventas" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Devoluciones" stroke="#dc2626" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top customers */}
        <ChartCard title="Top 10 clientes" subtitle="Por ingreso neto, últimos 12 meses">
          {data.topCustomers.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.topCustomers} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="netRevenue" fill="#2563eb" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top products */}
        <ChartCard title="Top 10 productos" subtitle="Por ingreso neto, últimos 12 meses">
          {data.topProducts.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.topProducts} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="netRevenue" fill="#0891b2" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AR aging */}
        <ChartCard
          title="Antigüedad de saldos (AR Aging)"
          subtitle={`Corte al ${formatSnapshotDate(data.snapshotDateKey)}${overdueShare !== null ? ` — ${pct(overdueShare)} vencido` : ''}`}
        >
          {data.snapshotDateKey === null ? (
            <EmptyState message="Aún no se ha corrido el snapshot diario de cuentas por cobrar (dwh.Snapshot_Fact_AR)." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v)} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="Monto" radius={[3, 3, 0, 0]}>
                  {agingData.map(d => (
                    <Cell key={d.bucket} fill={BUCKET_COLORS[d.bucket] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top debtors */}
        <ChartCard title="Mayor concentración de crédito" subtitle="Top 10 clientes por saldo pendiente">
          {data.topDebtors.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topDebtors.map(d => (
                    <tr key={d.name}>
                      <td className="px-3 py-2 text-gray-800">{d.name}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">Bs. {money(d.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Sales rep performance */}
      <ChartCard title="Desempeño por vendedor" subtitle="Ventas netas y devoluciones, últimos 12 meses">
        {data.salesReps.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Devoluciones</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.salesReps.map(r => (
                  <tr key={r.name}>
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">Bs. {money(r.salesNet)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">Bs. {money(r.returnsNet)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.salesNet > 0 ? pct(r.returnsNet / r.salesNet) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <p className="text-xs text-gray-400">
        Los volúmenes y tiempos de carga del Data Warehouse reflejan el entorno de datos actual —
        ver dwh-migrations/README.md para más contexto.
      </p>
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
