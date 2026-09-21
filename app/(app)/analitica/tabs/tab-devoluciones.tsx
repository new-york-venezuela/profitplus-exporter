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

type MatrixSortKey = 'name' | 'ratioDevolucion' | 'amountNet';

function SortableHeader({
  sortKeyValue,
  currentSortKey,
  sortDir,
  label,
  align,
  onSort,
}: {
  sortKeyValue: MatrixSortKey;
  currentSortKey: MatrixSortKey;
  sortDir: 'asc' | 'desc';
  label: string;
  align: 'left' | 'right';
  onSort: (key: MatrixSortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(sortKeyValue)}
      className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase cursor-pointer select-none hover:text-gray-900 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {label}
      {currentSortKey === sortKeyValue && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

// Declared at module scope (not inside TabDevoluciones) so its internal sort
// state isn't reset on every parent re-render — takes `currency` as a prop
// rather than reading it from the parent's closure for the same reason.
function MatrixTable({
  rows,
  rate,
  currency,
  nameColumnLabel,
  nameOf,
  defaultSortKey = 'amountNet',
}: {
  rows: DevolucionesMatrixCell[];
  rate: number | undefined;
  currency: Currency;
  nameColumnLabel: string;
  nameOf: (row: DevolucionesMatrixCell) => string;
  // "Por cliente" defaults to ratioDevolucion so the worst-offender store
  // surfaces first without a click — the other two sections keep sorting
  // by returns volume (amountNet), matching the API's own ORDER BY so
  // their initial render matches what the server already sent.
  defaultSortKey?: MatrixSortKey;
}) {
  const [sortKey, setSortKey] = useState<MatrixSortKey>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedRows = useMemo(() => {
    const withName = rows.map(row => ({ row, name: nameOf(row) }));
    withName.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'ratioDevolucion') {
        cmp = (a.row.ratioDevolucion ?? -Infinity) - (b.row.ratioDevolucion ?? -Infinity);
      } else {
        cmp = a.row.amountNet - b.row.amountNet;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return withName.map(x => x.row);
  }, [rows, sortKey, sortDir, nameOf]);

  function handleSort(key: MatrixSortKey) {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <SortableHeader sortKeyValue="name" currentSortKey={sortKey} sortDir={sortDir} label={nameColumnLabel} align="left" onSort={handleSort} />
            <SortableHeader sortKeyValue="ratioDevolucion" currentSortKey={sortKey} sortDir={sortDir} label="Tasa dev." align="right" onSort={handleSort} />
            <SortableHeader sortKeyValue="amountNet" currentSortKey={sortKey} sortDir={sortDir} label="Monto neto" align="right" onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedRows.map((row, i) => (
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

  // Defaults to Tienda (not Entidad, unlike Clientes/Ventas tabs) — this
  // section exists to answer "where to cut sales", which is a per-store
  // decision: a chain's aggregate Entidad rate can hide one branch driving
  // most of its returns.
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_tienda');
  const [clienteData, setClienteData] = useState<DevolucionesResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);
  // GroupedDrilldownTable (unlike MatrixTable above) has no built-in sort —
  // it's shared with tab-ventas.tsx and changing its sort behavior there is
  // out of scope, so sorting-by-return-rate is done here instead, before
  // rows are handed to it.
  const [clienteSortByRate, setClienteSortByRate] = useState(true);

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
    const rows = clienteData.rows
      .filter(r => r.clienteValue !== null)
      .map(r => ({
        label: r.cliente,
        value: r.clienteValue as string,
        ratioDevolucion: r.ratioDevolucion,
        amountNet: r.amountNet,
      }));
    if (clienteSortByRate) {
      rows.sort((a, b) => (b.ratioDevolucion ?? -Infinity) - (a.ratioDevolucion ?? -Infinity));
    }
    // else: keep the API's own ORDER BY ReturnsNet DESC (returns volume).
    return rows;
  }, [clienteData, clienteSortByRate]);

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
            <MatrixTable rows={salesrepData?.rows ?? []} rate={salesrepRate} currency={currency} nameColumnLabel="Vendedor" nameOf={row => row.salesRep} />
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
            <MatrixTable rows={productoData?.rows ?? []} rate={productoRate} currency={currency} nameColumnLabel="Producto" nameOf={row => row.producto} />
          )}
        </div>
      </section>

      {/* Por cliente */}
      <section>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Por cliente</h3>
          <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setClienteSortByRate(true)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${clienteSortByRate ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Ordenar por tasa dev.
            </button>
            <button
              onClick={() => setClienteSortByRate(false)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${!clienteSortByRate ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Ordenar por monto
            </button>
          </div>
        </div>
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
