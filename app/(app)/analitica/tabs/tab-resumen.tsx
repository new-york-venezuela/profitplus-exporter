'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { Currency, DateRange, ResumenResponse, AgingBucketRow } from '../types';

const BUCKET_ORDER = ['Current', '1-30', '31-60', '61-90', '>90'];
const BUCKET_COLORS: Record<string, string> = {
  Current: '#16a34a',
  '1-30': '#84cc16',
  '31-60': '#eab308',
  '61-90': '#f97316',
  '>90': '#dc2626',
};

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

function KpiCard({
  label,
  value,
  tone,
  delta,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
  delta?: { pct: number | null; label: string; goodDirection?: 'up' | 'down' };
}) {
  const isGood =
    delta && delta.pct !== null && ((delta.goodDirection ?? 'up') === 'up' ? delta.pct >= 0 : delta.pct <= 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium ${delta.pct === null ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-600'}`}>
          {delta.pct === null ? '—' : `${delta.pct >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct * 100).toFixed(1)}%`} {delta.label}
        </p>
      )}
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

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

export default function TabResumen({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/dwh/resumen?dateRange=${dateRange}&currency=${currency}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ResumenResponse = await res.json();
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
  }, [dateRange, currency]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <EmptyState />
      </div>
    );
  }

  const rate = data.usdRate ?? undefined;

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

  const activeCustomersDelta =
    data.kpis.activeCustomersPrevPeriod !== null && data.kpis.activeCustomersPrevPeriod > 0
      ? (data.kpis.activeCustomers - data.kpis.activeCustomersPrevPeriod) / data.kpis.activeCustomersPrevPeriod
      : null;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Ventas netas (12m)" value={moneyLabel(data.kpis.salesNet12mo, currency, rate)} />
        <KpiCard label="Devoluciones (12m)" value={moneyLabel(data.kpis.returnsNet12mo, currency, rate)} />
        <KpiCard
          label="Tasa de devolución"
          value={pct(data.kpis.returnRate)}
          tone={data.kpis.returnRate !== null && data.kpis.returnRate > 0.05 ? 'warn' : 'default'}
        />
        <KpiCard label="Cobrado (12m)" value={moneyLabel(data.kpis.collected12mo, currency, rate)} />
        <KpiCard
          label="Clientes activos"
          value={data.kpis.activeCustomers.toLocaleString('es-VE')}
          delta={{ pct: activeCustomersDelta, label: 'vs. período anterior' }}
        />
        <KpiCard
          label="Tasa de abandono"
          value={pct(data.kpis.churnRate)}
          tone={data.kpis.churnRate !== null && data.kpis.churnRate > 0.2 ? 'warn' : 'default'}
        />
      </div>

      {/* Sales & returns trend */}
      <ChartCard title="Tendencia de ventas y devoluciones" subtitle="Monto neto por mes">
        {trendData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
              <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
              <Legend />
              <Bar dataKey="Ventas" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Devoluciones" stroke="#dc2626" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top customers */}
        <ChartCard title="Top 10 clientes" subtitle="Por ingreso neto">
          {data.topCustomers.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.topCustomers} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => money(v, currency, rate)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
                <Bar dataKey="netRevenue" fill="#2563eb" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top products */}
        <ChartCard title="Top 10 productos" subtitle="Por ingreso neto">
          {data.topProducts.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.topProducts} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => money(v, currency, rate)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
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
            <EmptyState message="Aún no se ha corrido el snapshot diario de cuentas por cobrar (fact.Fact_AR_Snapshot)." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
                <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
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
                  {data.topDebtors.map((d, i) => (
                    <tr key={d.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                      <td className="px-3 py-2 text-gray-800">{d.name}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {moneyLabel(d.outstanding, currency, rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Sales rep performance */}
      <ChartCard title="Desempeño por vendedor" subtitle="Ventas netas y devoluciones">
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
                {data.salesReps.map((r, i) => (
                  <tr key={r.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(r.salesNet, currency, rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {moneyLabel(r.returnsNet, currency, rate)}
                    </td>
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
    </div>
  );
}
