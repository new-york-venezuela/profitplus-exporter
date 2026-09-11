'use client';

import { useEffect, useMemo, useState } from 'react';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import type { BreakdownRow, Currency, DateRange, DevolucionesResponse, GroupBy, PivotDimension } from '../types';

type DevolucionesGroupBy = 'salesrep' | 'producto' | 'cliente';

const GROUP_OPTIONS: { value: DevolucionesGroupBy; label: string }[] = [
  { value: 'salesrep', label: 'Vendedor' },
  { value: 'producto', label: 'Producto' },
  { value: 'cliente', label: 'Cliente' },
];

// Cliente view groups by cliente_entidad/cliente_tienda (existing toggle) and
// breaks down by producto/vendedor — mirrors tab-ventas.tsx's wiring exactly;
// see that file's comment for why this combination never collides aliases.
const CLIENTE_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'cliente_entidad', label: 'Entidad' },
  { value: 'cliente_tienda', label: 'Tienda' },
];

const BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
  { value: 'vendedor', label: 'Vendedor' },
];

interface DevolucionesTableRow {
  label: string;
  value: string;
  ratioDevolucion: number | null;
  amountNet: number;
}

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

export default function TabDevoluciones({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [groupBy, setGroupBy] = useState<DevolucionesGroupBy>('salesrep');
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [data, setData] = useState<DevolucionesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy === 'cliente') {
          params.set('clienteDimension', clienteDimension);
        }
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: DevolucionesResponse = await res.json();
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
  }, [dateRange, currency, groupBy, clienteDimension]);

  const rate = data?.usdRate ?? undefined;

  const groupLabel = (gb: GroupBy): string =>
    GROUP_OPTIONS.find(o => o.value === gb)?.label ?? gb;

  const clienteRows: DevolucionesTableRow[] = useMemo(() => {
    if (!data || groupBy !== 'cliente') return [];
    return data.rows
      .filter(r => r.clienteValue !== null)
      .map(r => ({
        label: r.cliente,
        value: r.clienteValue as string,
        ratioDevolucion: r.ratioDevolucion,
        amountNet: r.amountNet,
      }));
  }, [data, groupBy]);

  async function handleFetchBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      currency,
      groupBy: 'cliente',
      clienteDimension,
      breakdownBy: dimension,
      parentValue,
    });
    const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const clienteColumns: DrilldownColumn<DevolucionesTableRow>[] = [
    {
      key: 'amountNet',
      label: 'Monto neto',
      align: 'right',
      format: row => moneyLabel(row.amountNet, currency, rate),
    },
    {
      key: 'ratioDevolucion',
      label: 'Tasa dev.',
      align: 'right',
      format: row => pct(row.ratioDevolucion),
    },
  ];

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Header + groupBy toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Devoluciones</h2>
          <p className="text-sm text-gray-500">
            Matriz de devoluciones y tasa de devolución (devoluciones / ventas)
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
            {GROUP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  groupBy === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Por {opt.label}
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
        </div>
      </div>

      {/* Breadcrumb */}
      {data && data.breadcrumb.length > 0 && (
        <nav className="text-xs text-gray-500">
          {data.breadcrumb.map((b, i) => (
            <span key={`${b.groupBy}-${i}`}>
              {i > 0 && <span className="mx-1">/</span>}
              {groupLabel(b.groupBy)}
            </span>
          ))}
        </nav>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState />
        ) : groupBy === 'cliente' ? (
          <GroupedDrilldownTable<DevolucionesTableRow>
            rows={clienteRows}
            columns={clienteColumns}
            groupByOptions={CLIENTE_GROUP_BY_OPTIONS}
            groupBy={clienteDimension}
            onGroupByChange={next => setClienteDimension(next as 'cliente_entidad' | 'cliente_tienda')}
            breakdownByOptions={BREAKDOWN_BY_OPTIONS}
            breakdownBy={breakdownBy}
            onBreakdownByChange={setBreakdownBy}
            onFetchBreakdown={handleFetchBreakdown}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Monto neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row, i) => (
                  <tr key={`${row.salesRep}-${row.producto}-${row.cliente}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="px-3 py-2 text-gray-800">{row.salesRep}</td>
                    <td className="px-3 py-2 text-gray-800">{row.producto}</td>
                    <td className="px-3 py-2 text-gray-800">{row.cliente}</td>
                    <td
                      className={`px-3 py-2 text-right ${
                        row.ratioDevolucion !== null && row.ratioDevolucion > 0.05
                          ? 'text-orange-600 font-medium'
                          : 'text-gray-600'
                      }`}
                    >
                      {pct(row.ratioDevolucion)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(row.amountNet, currency, rate)}
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
