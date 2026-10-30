'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { Currency, DateRange, ResumenResponse } from '../types';
import { periodLabel } from '../lib/period-label';
import type { Granularity } from '../lib/granularity';
import { SectionTitle } from '../components/resumen/stat-card';
import { VentasStrip } from '../components/resumen/ventas-strip';
import { ClientesCards } from '../components/resumen/clientes-cards';
import { CxcCards } from '../components/resumen/cxc-cards';
import { SalesReturnsChart } from '../components/resumen/sales-returns-chart';

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
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-gray-500">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 space-y-3">
        <EmptyState />
      </div>
    );
  }

  const topCustomersData = data.topCustomers.map(c => ({
    name: c.name,
    salesGross: currency === 'usd' ? c.salesGross.usd : c.salesGross.bs,
  }));
  const topProductsData = data.topProducts.map(p => ({
    name: p.name,
    salesGross: currency === 'usd' ? p.salesGross.usd : p.salesGross.bs,
  }));

  const periodo = periodLabel(dateRange);

  return (
    <div className="p-6 w-full space-y-6">
      {/* KPI row — every figure is for the selected range (periodo). */}
      <p className="text-xs text-gray-500">
        Período: {periodo}. Devoluciones atribuidas a la fecha de su factura original, sin IVA.
      </p>
      <section>
        <SectionTitle>Ventas del período</SectionTitle>
        <VentasStrip kpis={data.kpis} currency={currency} />
      </section>
      <section>
        <SectionTitle>Clientes</SectionTitle>
        <ClientesCards kpis={data.kpis} />
      </section>
      <section>
        <SectionTitle>Cuentas por cobrar</SectionTitle>
        <CxcCards
          kpis={data.kpis}
          currency={currency}
          snapshotLabel={data.snapshotDateKey !== null ? `al ${formatSnapshotDate(data.snapshotDateKey)}` : undefined}
        />
      </section>
      <SalesReturnsChart rows={data.monthlyTrend} trendMode={data.trendMode} currency={currency} />

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

      {/* Sales rep performance */}
      <ChartCard title="Desempeño por vendedor" subtitle="Todas las facturas, incluida la facturación de consignación (la pestaña Seguimiento la excluye). Devoluciones por fecha de factura.">
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
