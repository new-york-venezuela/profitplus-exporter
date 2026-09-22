'use client';

import { useEffect, useMemo, useState } from 'react';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { moneyLabel } from '../lib/format';
import type { BreakdownRow, Currency, DateRange, PivotDimension, VendedoresResponse, VendedoresRow, VendedoresExcludedResponse } from '../types';

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
  const [excludedExpandedFor, setExcludedExpandedFor] = useState<string | null>(null);
  const [excludedData, setExcludedData] = useState<VendedoresExcludedResponse | null>(null);
  const [excludedLoading, setExcludedLoading] = useState(false);

  async function handleToggleExcluded(salesRepValue: string) {
    if (excludedExpandedFor === salesRepValue) {
      setExcludedExpandedFor(null);
      return;
    }
    setExcludedExpandedFor(salesRepValue);
    setExcludedData(null);
    setExcludedLoading(true);
    try {
      const params = new URLSearchParams({ dateRange, currency, section: 'excluded', parentValue: salesRepValue });
      const res = await fetch(`/api/dwh/vendedores?${params.toString()}`);
      if (res.ok) setExcludedData(await res.json());
    } finally {
      setExcludedLoading(false);
    }
  }

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

  const rowsWithExclusions = rows.filter(r => r.excludedSalesNet > 0);

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
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
          />
        )}
      </div>

      {rowsWithExclusions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Facturas excluidas — patrón de consignación</h2>
          <p className="text-xs text-gray-500 mb-3">
            Estas facturas se facturaron de forma agregada a nivel de cadena (no por tienda individual),
            por lo que no es posible atribuir de forma confiable qué vendedor generó la venta. Se
            excluyen de las ventas/cobranza del vendedor arriba en vez de estimarse.
          </p>
          <ul className="space-y-2">
            {rowsWithExclusions.map(row => (
              <li key={row.value} className="text-sm">
                <button
                  onClick={() => handleToggleExcluded(row.value)}
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  {row.name}: {moneyLabel(row.excludedSalesNet, currency, rate)} excluidos ({row.excludedInvoiceCount} facturas)
                </button>
                {excludedExpandedFor === row.value && (
                  <div className="mt-2 ml-4 text-xs">
                    {excludedLoading ? (
                      <div className="text-gray-400 py-1">Cargando…</div>
                    ) : !excludedData || excludedData.invoices.length === 0 ? (
                      <div className="text-gray-400 py-1">Sin facturas.</div>
                    ) : (
                      <table className="min-w-full">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left pr-4 py-1">Entidad</th>
                            <th className="text-left pr-4 py-1">Factura</th>
                            <th className="text-left pr-4 py-1">Fecha</th>
                            <th className="text-right py-1">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excludedData.invoices.map((inv, i) => (
                            <tr key={`${inv.invoiceNumber}-${i}`} className="text-gray-700">
                              <td className="pr-4 py-1">{inv.legalEntityName}</td>
                              <td className="pr-4 py-1">{inv.invoiceNumber}</td>
                              <td className="pr-4 py-1">{inv.invoiceDate}</td>
                              <td className="text-right py-1">{moneyLabel(inv.amountNet, currency, rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
