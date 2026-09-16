'use client';

import { useEffect, useMemo, useState } from 'react';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { moneyLabel } from '../lib/format';
import type { BreakdownRow, Currency, DateRange, DevolucionesMatrixCell, DevolucionesResponse, PivotDimension } from '../types';

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
  const [salesrepData, setSalesrepData] = useState<DevolucionesResponse | null>(null);
  const [salesrepLoading, setSalesrepLoading] = useState<boolean>(true);
  const [salesrepError, setSalesrepError] = useState<string | null>(null);

  const [productoData, setProductoData] = useState<DevolucionesResponse | null>(null);
  const [productoLoading, setProductoLoading] = useState<boolean>(true);
  const [productoError, setProductoError] = useState<string | null>(null);

  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [clienteData, setClienteData] = useState<DevolucionesResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSalesrepError(null);
      setSalesrepLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'salesrep' });
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSalesrepError(body.error ?? 'Error desconocido');
          return;
        }
        setSalesrepData(await res.json());
      } catch {
        if (!cancelled) setSalesrepError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setSalesrepLoading(false);
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
      setProductoError(null);
      setProductoLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'producto' });
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setProductoError(body.error ?? 'Error desconocido');
          return;
        }
        setProductoData(await res.json());
      } catch {
        if (!cancelled) setProductoError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setProductoLoading(false);
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
      setClienteError(null);
      setClienteLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'cliente', clienteDimension });
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
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
  }, [dateRange, currency, clienteDimension]);

  const salesrepRate = salesrepData?.usdRate ?? undefined;
  const productoRate = productoData?.usdRate ?? undefined;
  const clienteRate = clienteData?.usdRate ?? undefined;

  const clienteRows: DevolucionesTableRow[] = useMemo(() => {
    if (!clienteData) return [];
    return clienteData.rows
      .filter(r => r.clienteValue !== null)
      .map(r => ({
        label: r.cliente,
        value: r.clienteValue as string,
        ratioDevolucion: r.ratioDevolucion,
        amountNet: r.amountNet,
      }));
  }, [clienteData]);

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
      format: row => moneyLabel(row.amountNet, currency, clienteRate),
    },
    {
      key: 'ratioDevolucion',
      label: 'Tasa dev.',
      align: 'right',
      format: row => pct(row.ratioDevolucion),
    },
  ];

  function MatrixTable({
    rows,
    rate,
    nameColumnLabel,
    nameOf,
  }: {
    rows: DevolucionesMatrixCell[];
    rate: number | undefined;
    nameColumnLabel: string;
    nameOf: (row: DevolucionesMatrixCell) => string;
  }) {
    if (rows.length === 0) return <EmptyState />;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{nameColumnLabel}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Monto neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={`${nameOf(row)}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                <td className="px-3 py-2 text-gray-800">{nameOf(row)}</td>
                <td
                  className={`px-3 py-2 text-right ${
                    row.ratioDevolucion !== null && row.ratioDevolucion > 0.05 ? 'text-orange-600 font-medium' : 'text-gray-600'
                  }`}
                >
                  {pct(row.ratioDevolucion)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{moneyLabel(row.amountNet, currency, rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Devoluciones</h2>
        <p className="text-sm text-gray-500">Matriz de devoluciones y tasa de devolución (devoluciones / ventas)</p>
      </div>

      {/* Por vendedor */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por vendedor</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {salesrepLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
          ) : salesrepError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{salesrepError}</p>
          ) : (
            <MatrixTable rows={salesrepData?.rows ?? []} rate={salesrepRate} nameColumnLabel="Vendedor" nameOf={row => row.salesRep} />
          )}
        </div>
      </section>

      {/* Por producto */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por producto</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {productoLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
          ) : productoError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{productoError}</p>
          ) : (
            <MatrixTable rows={productoData?.rows ?? []} rate={productoRate} nameColumnLabel="Producto" nameOf={row => row.producto} />
          )}
        </div>
      </section>

      {/* Por cliente */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por cliente</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {clienteLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
          ) : clienteError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{clienteError}</p>
          ) : clienteRows.length === 0 ? (
            <EmptyState />
          ) : (
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
              formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, clienteRate) : String(value ?? '—'))}
            />
          )}
        </div>
      </section>
    </div>
  );
}
