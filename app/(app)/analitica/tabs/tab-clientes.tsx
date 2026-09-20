'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { moneyLabel } from '../lib/format';
import type { ClientesResponse, ClientesRow, ClientesTrendResponse, Currency, DateRange } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
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

function useClientesTrend(dateRange: DateRange, clienteDimension: 'cliente_entidad' | 'cliente_tienda') {
  const [data, setData] = useState<ClientesTrendResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, clienteDimension, section: 'trend' });
        const res = await fetch(`/api/dwh/clientes?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ClientesTrendResponse = await res.json();
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
  }, [dateRange, clienteDimension]);

  return { data, loading, error };
}

type Segment = ClientesRow['pareto'];
type SegmentFilter = Segment | 'all';

const SEGMENT_BADGE_CLASSES: Record<Segment, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-gray-100 text-gray-700',
};

function SegmentBadge({ segment }: { segment: Segment }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${SEGMENT_BADGE_CLASSES[segment]}`}
    >
      {segment}
    </span>
  );
}

type SortKey = 'name' | 'salesNet' | 'returnsNet' | 'returnRate' | 'pareto';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortKey;
  label: string;
  align: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Cliente', align: 'left' },
  { key: 'salesNet', label: 'Ventas netas', align: 'right' },
  { key: 'returnsNet', label: 'Devoluciones', align: 'right' },
  { key: 'returnRate', label: 'Tasa dev.', align: 'right' },
  { key: 'pareto', label: 'Segmento', align: 'right' },
];

function sortValue(row: ClientesRow, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return row.name ?? '';
    case 'salesNet':
      return row.salesNet;
    case 'returnsNet':
      return row.returnsNet;
    case 'returnRate':
      return row.returnRate ?? -Infinity;
    case 'pareto':
      return row.pareto;
  }
}

const SEGMENT_FILTER_OPTIONS: { value: SegmentFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
];

export default function TabClientes({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [data, setData] = useState<ClientesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('salesNet');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const trend = useClientesTrend(dateRange, clienteDimension);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, clienteDimension });
        const res = await fetch(`/api/dwh/clientes?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ClientesResponse = await res.json();
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
  }, [dateRange, currency, clienteDimension]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (segmentFilter === 'all') return data.rows;
    return data.rows.filter(r => r.pareto === segmentFilter);
  }, [data, segmentFilter]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp: number;
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av).localeCompare(String(bv));
      } else {
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredRows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'pareto' ? 'asc' : 'desc');
    }
  }

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
  const segmentCounts = data.rows.reduce<Record<Segment, number>>(
    (acc, r) => {
      acc[r.pareto] += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0 }
  );

  const trendData = (trend.data?.rows ?? []).map(r => ({
    label: r.yearMonth,
    'Clientes activos': r.activeCustomers,
    'Tasa de abandono': r.churnRate === null ? null : r.churnRate * 100,
  }));

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-gray-200 rounded-lg p-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Nivel de análisis</h2>
          <p className="text-xs text-gray-500">
            Aplica a todo lo de abajo — Entidad agrupa por cadena/razón social, Tienda por punto de venta individual.
          </p>
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

      <ChartCard
        title="Clientes activos y tasa de abandono"
        subtitle={`Por mes — grano: ${clienteDimension === 'cliente_entidad' ? 'Entidad (cadena)' : 'Tienda'}`}
      >
        {trend.loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : trend.error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{trend.error}</p>
        ) : trendData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                formatter={(val: unknown, name: unknown) =>
                  val === null ? '—' : name === 'Tasa de abandono' ? `${Number(val).toFixed(1)}%` : String(val)
                }
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Clientes activos" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="Tasa de abandono" stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Segmentación de clientes (Pareto)</h2>
            <p className="text-xs text-gray-500">
              Clientes ordenados por ventas netas, segmentados por participación acumulada — A: top{' '}
              {(data.paretoThresholds.a * 100).toFixed(0)}%, B: hasta {(data.paretoThresholds.b * 100).toFixed(0)}%,
              C: resto
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
              {SEGMENT_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSegmentFilter(opt.value)}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    segmentFilter === opt.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                  {opt.value !== 'all' && (
                    <span className="ml-1 text-xs opacity-75">({segmentCounts[opt.value]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        {sortedRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase cursor-pointer select-none hover:text-gray-900 ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((r, i) => (
                  <tr key={r.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(r.salesNet, currency, rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {moneyLabel(r.returnsNet, currency, rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(r.returnRate)}</td>
                    <td className="px-3 py-2 text-right">
                      <SegmentBadge segment={r.pareto} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
