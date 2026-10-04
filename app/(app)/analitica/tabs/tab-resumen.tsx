'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { Currency, DateRange, ResumenResponse, AgingBucketRow } from '../types';
import { bucketLabels, bucketTitle, TREND_UNIT_LABEL } from '../lib/granularity';
import { periodLabel } from '../lib/period-label';
import type { Granularity } from '../lib/granularity';
import { KpiCard } from '../components/kpi-card';
import { KpiGroup } from '../components/kpi-group';

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

function formatSnapshotDate(key: number | null): string {
  if (key === null) return 'sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
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
  granularity,
}: {
  dateRange: DateRange;
  currency: Currency;
  granularity: Granularity;
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
        const res = await fetch(`/api/dwh/resumen?dateRange=${dateRange}&granularity=${granularity}`);
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
  }, [dateRange, granularity]);

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

  const trendKeys = data.monthlyTrend.map(r => r.bucket);
  const trendXLabels = bucketLabels(data.trendMode, trendKeys);
  const trendData = data.monthlyTrend.map((r, i) => ({
    label: trendXLabels[i],
    title: bucketTitle(data.trendMode, r.bucket),
    'Ventas brutas': currency === 'usd' ? r.salesGross.usd : r.salesGross.bs,
    Devoluciones: currency === 'usd' ? r.returnsNet.usd : r.returnsNet.bs,
    'Ventas netas': currency === 'usd' ? r.salesNet.usd : r.salesNet.bs,
  }));

  const orderedBuckets = BUCKET_ORDER
    .map(bucket => data.agingBuckets.find(b => b.bucket === bucket))
    .filter((b): b is AgingBucketRow => b !== undefined);
  const agingData = orderedBuckets.map(b => ({ bucket: b.bucket, Monto: currency === 'usd' ? b.amount.usd : b.amount.bs }));
  const overdueShare = (() => {
    const total = orderedBuckets.reduce((sum, b) => sum + b.amount.bs, 0);
    const overdue = orderedBuckets.filter(b => b.bucket !== 'Current').reduce((sum, b) => sum + b.amount.bs, 0);
    return total > 0 ? overdue / total : null;
  })();

  const topCustomersData = data.topCustomers.map(c => ({
    name: c.name,
    salesGross: currency === 'usd' ? c.salesGross.usd : c.salesGross.bs,
  }));
  const topProductsData = data.topProducts.map(p => ({
    name: p.name,
    salesGross: currency === 'usd' ? p.salesGross.usd : p.salesGross.bs,
  }));

  const periodo = periodLabel(dateRange);
  const activeCustomersDelta =
    data.kpis.activeCustomersPrevPeriod !== null && data.kpis.activeCustomersPrevPeriod > 0
      ? (data.kpis.activeCustomers - data.kpis.activeCustomersPrevPeriod) / data.kpis.activeCustomersPrevPeriod
      : null;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* KPI row — every figure is for the selected range (periodo). */}
      <p className="text-xs text-gray-500 -mb-3">
        Período: {periodo}. Devoluciones atribuidas a la fecha de su factura original, sin IVA.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KpiGroup title="Ventas" tone="sales">
          <KpiCard label={`Ventas brutas (${periodo})`} value={moneyLabel(data.kpis.salesGross, currency)} />
          <KpiCard label={`Ventas netas (${periodo})`} value={moneyLabel(data.kpis.salesNet, currency)} />
          <KpiCard
            label={`Unidades vendidas (${periodo})`}
            value={data.kpis.unitsSold.toLocaleString('es-VE')}
            title="Unidades facturadas, antes de devoluciones (misma definición que la pestaña Ventas)."
          />
        </KpiGroup>
        <KpiGroup title="Devoluciones" tone="returns">
          <KpiCard label={`Devoluciones (${periodo})`} value={moneyLabel(data.kpis.returns, currency)} />
          <KpiCard
            label="Tasa de devolución"
            value={pct(data.kpis.returnRate)}
            tone={data.kpis.returnRate !== null && data.kpis.returnRate > 0.05 ? 'warn' : 'default'}
          />
        </KpiGroup>
        <KpiGroup title="Cuentas por cobrar" tone="collections">
          <KpiCard label={`Cobrado (${periodo})`} value={moneyLabel(data.kpis.collected, currency)} />
          <KpiCard
            label="Pendiente por cobrar"
            value={data.kpis.receivable ? moneyLabel(data.kpis.receivable, currency) : 'Sin datos'}
            subtitle={data.snapshotDateKey !== null ? `al ${formatSnapshotDate(data.snapshotDateKey)}` : 'sin snapshot al cierre del período'}
            title="Saldo pendiente total en el snapshot de CxC más reciente al último día del período seleccionado."
          />
        </KpiGroup>
        <KpiGroup title="Clientes" tone="customers">
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
        </KpiGroup>
      </div>

      {/* Sales & returns trend */}
      <ChartCard title="Tendencia de ventas y devoluciones" subtitle={`Ventas brutas, devoluciones (por fecha de factura) y ventas netas por ${TREND_UNIT_LABEL[data.trendMode]}, sin IVA`}>
        {trendData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
              <Tooltip formatter={val => moneyTooltip(val, currency)} labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label} />
              <Legend />
              <Bar dataKey="Ventas brutas" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Ventas netas" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Devoluciones" stroke="#dc2626" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top customers */}
        <ChartCard title="Top 10 clientes" subtitle="Por ventas brutas (sin IVA, antes de devoluciones)">
          {data.topCustomers.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topCustomersData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={val => moneyTooltip(val, currency)} />
                <Bar dataKey="salesGross" name="Ventas brutas" fill="#2563eb" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top products */}
        <ChartCard title="Top 10 productos" subtitle="Por ventas brutas (sin IVA, antes de devoluciones)">
          {data.topProducts.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topProductsData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={val => moneyTooltip(val, currency)} />
                <Bar dataKey="salesGross" name="Ventas brutas" fill="#0891b2" radius={[0, 3, 3, 0]} />
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
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
                <Tooltip formatter={val => moneyTooltip(val, currency)} />
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
                        {moneyLabel(d.outstanding, currency)}
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
      <ChartCard title="Desempeño por vendedor" subtitle="Todas las facturas, incluida la facturación de consignación (la pestaña Vendedores la excluye). Devoluciones por fecha de factura.">
        {data.salesReps.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas brutas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Devoluciones</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.salesReps.map((r, i) => (
                  <tr key={r.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(r.salesGross, currency)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {moneyLabel(r.returnsNet, currency)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {moneyLabel(r.salesNet, currency)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.units.toLocaleString('es-VE')}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.salesGross.bs > 0 ? pct(r.returnsNet.bs / r.salesGross.bs) : '—'}
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
