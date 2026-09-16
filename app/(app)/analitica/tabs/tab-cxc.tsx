'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import { money, moneyLabel, moneyTooltip } from '../lib/format';
import type { Currency, CxcResponse, DateRange } from '../types';

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

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

export default function TabCxc({ currency }: { dateRange: DateRange; currency: Currency }) {
  const [data, setData] = useState<CxcResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ currency, clienteDimension });
        const res = await fetch(`/api/dwh/cxc?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: CxcResponse = await res.json();
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
  }, [currency, clienteDimension]);

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

  const orderedBuckets = BUCKET_ORDER
    .map(bucket => data.agingBuckets.find(b => b.bucket === bucket))
    .filter((b): b is { bucket: string; amount: number } => b !== undefined);
  const agingData = orderedBuckets.map(b => ({ bucket: b.bucket, Monto: b.amount }));

  const totalOutstanding = data.agingBuckets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Saldo total pendiente" value={moneyLabel(totalOutstanding, currency, rate)} />
        <KpiCard
          label="% vencido"
          value={pct(data.overdueShare)}
          tone={data.overdueShare !== null && data.overdueShare > 0.3 ? 'warn' : 'default'}
        />
        <KpiCard label="Corte del snapshot" value={formatSnapshotDate(data.snapshotDateKey)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AR aging */}
        <ChartCard
          title="Antigüedad de saldos (AR Aging)"
          subtitle={`Corte al ${formatSnapshotDate(data.snapshotDateKey)}${data.overdueShare !== null ? ` — ${pct(data.overdueShare)} vencido` : ''}`}
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
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Mayor concentración de crédito</h2>
              <p className="text-xs text-gray-500">Top 10 clientes por saldo pendiente</p>
            </div>
            <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setClienteDimension('cliente_entidad')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${clienteDimension === 'cliente_entidad' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Entidad
              </button>
              <button
                onClick={() => setClienteDimension('cliente_tienda')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${clienteDimension === 'cliente_tienda' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Tienda
              </button>
            </div>
          </div>
          {data.topDebtors.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Saldo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Días prom. de pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topDebtors.map((d, i) => (
                    <tr key={d.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                      <td className="px-3 py-2 text-gray-800">{d.name}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {moneyLabel(d.outstanding, currency, rate)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {d.avgDaysToPay !== null ? d.avgDaysToPay.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Weekday x vencimiento */}
      <ChartCard
        title="Cobros por día de semana y estado de vencimiento"
        subtitle="Monto cobrado, agrupado por día de la semana del pago y si la factura ya había vencido en ese momento"
      >
        {data.weekdayVencimiento.length === 0 ? (
          <EmptyState message="Sin cobros con fecha de vencimiento resolvible todavía." />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.weekdayVencimiento}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
              <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="noVencida" name="Aún no vencía" stackId="v" fill="#16a34a" />
              <Bar dataKey="venceHoy" name="Vencía ese día" stackId="v" fill="#eab308" />
              <Bar dataKey="vencida" name="Ya estaba vencida" stackId="v" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* DSO trend */}
      <ChartCard
        title="Tendencia de DSO (Days Sales Outstanding)"
        subtitle="Saldo de cartera al cierre de cada mes con snapshot / ventas netas de los 90 días previos × 90"
      >
        {data.dsoTrend.filter(d => d.dso !== null).length === 0 ? (
          <EmptyState message="Se necesita más de un snapshot de cuentas por cobrar (fact.Fact_AR_Snapshot) para trazar una tendencia." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.dsoTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val: unknown) => (val === null ? 'Sin datos' : `${Number(val).toFixed(1)} días`)} />
              <Line type="monotone" dataKey="dso" name="DSO (días)" stroke="#2563eb" strokeWidth={2} dot connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Aging trend */}
      <ChartCard
        title="Tendencia de antigüedad de saldos"
        subtitle="Misma clasificación (Current/1-30/31-60/61-90/>90) que el corte actual, trazada mes a mes"
      >
        {data.agingTrend.length === 0 ? (
          <EmptyState message="Se necesita al menos un snapshot de cuentas por cobrar (fact.Fact_AR_Snapshot) para trazar esta tendencia." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={data.agingTrend.map(row => {
                const flat: Record<string, string | number> = { yearMonth: row.yearMonth };
                for (const bucket of BUCKET_ORDER) {
                  flat[bucket] = row.buckets.find(b => b.bucket === bucket)?.amount ?? 0;
                }
                return flat;
              })}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
              <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {BUCKET_ORDER.map(bucket => (
                <Area
                  key={bucket}
                  type="monotone"
                  dataKey={bucket}
                  name={bucket}
                  stackId="aging"
                  stroke={BUCKET_COLORS[bucket]}
                  fill={BUCKET_COLORS[bucket]}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
