'use client';

import { useEffect, useMemo, useState } from 'react';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import type { BreakdownRow, Currency, DateRange, PivotDimension, VendedoresResponse, VendedoresRow } from '../types';

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

// This tab has no top-level groupBy toggle — rows are always one-per-sales-rep.
// GroupedDrilldownTable requires a groupBy/groupByOptions pair, so we fix it to
// a single no-op option and never let it change.
const GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
];

const BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
  { value: 'cliente_tienda', label: 'Tienda' },
];

interface VendedoresTableRow extends VendedoresRow {
  label: string;
}

export default function TabVendedores({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [data, setData] = useState<VendedoresResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/dwh/vendedores?dateRange=${dateRange}&currency=${currency}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: VendedoresResponse = await res.json();
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

  const rate = data?.usdRate ?? undefined;

  const rows: VendedoresTableRow[] = useMemo(() => {
    if (!data) return [];
    return [...data.rows]
      .sort((a, b) => b.salesNet - a.salesNet)
      .map(r => ({ ...r, label: r.name }));
  }, [data]);

  async function handleFetchBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ dateRange, currency, breakdownBy: dimension, parentValue });
    const res = await fetch(`/api/dwh/vendedores?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const columns: DrilldownColumn<VendedoresTableRow>[] = [
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      format: row => moneyLabel(row.salesNet, currency, rate),
    },
    {
      key: 'returnsNet',
      label: 'Devoluciones',
      align: 'right',
      format: row => moneyLabel(row.returnsNet, currency, rate),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      format: row => pct(row.returnRate),
    },
    {
      key: 'collectionRate',
      label: 'Tasa cobr.',
      align: 'right',
      title: 'Cobrado ÷ ventas netas del período. Puede superar 100% si se cobran facturas de períodos anteriores.',
      format: row => pct(row.collectionRate),
    },
    {
      key: 'avgDiscount',
      label: 'Descto prom.',
      align: 'right',
      format: row => pct(row.avgDiscount),
    },
  ];

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

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900">Desempeño por vendedor</h2>
        <p className="text-xs text-gray-500 mb-3">
          Ventas netas, devoluciones y cobranza por representante de ventas
        </p>
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <GroupedDrilldownTable<VendedoresTableRow>
            rows={rows}
            columns={columns}
            groupByOptions={GROUP_BY_OPTIONS}
            groupBy="vendedor"
            onGroupByChange={() => {}}
            breakdownByOptions={BREAKDOWN_BY_OPTIONS}
            breakdownBy={breakdownBy}
            onBreakdownByChange={setBreakdownBy}
            onFetchBreakdown={handleFetchBreakdown}
          />
        )}
      </div>
    </div>
  );
}
