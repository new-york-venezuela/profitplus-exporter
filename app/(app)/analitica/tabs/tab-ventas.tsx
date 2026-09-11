'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { Currency, DateRange, VentasResponse, GroupBy } from '../types';

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
  { value: 'cliente', label: 'Por cliente' },
  { value: 'linea', label: 'Por línea' },
];

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

        {groupBy === 'cliente' && (
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
        )}

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

      {!loading && !error && data && (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                  {groupBy === 'mes' ? 'Mes' : groupBy === 'cliente' ? 'Cliente' : 'Línea'}
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
