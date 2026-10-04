'use client';

import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from '@/lib/components/searchable-select';
import { moneyLabel } from '../lib/format';
import type {
  Currency, DateRange, SellerSummaryResponse, SellerMatrixResponse, SellerMatrixProduct,
} from '../types';

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function cellKey(productKey: number, customerKey: number): string {
  return `${productKey}|${customerKey}`;
}

export default function TabMatrizVendedor({ dateRange, currency }: { dateRange: DateRange; currency: Currency }) {
  const [summary, setSummary] = useState<SellerSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [salesRepKey, setSalesRepKey] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<SellerMatrixResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [lineFilter, setLineFilter] = useState<string | null>(null);
  const [subLineFilter, setSubLineFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSummaryError(null);
      setSummaryLoading(true);
      try {
        const params = new URLSearchParams({ section: 'summary', dateRange });
        const res = await fetch(`/api/dwh/matriz-vendedor?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSummaryError(body.error ?? 'Error desconocido');
          return;
        }
        setSummary(await res.json());
      } catch {
        if (!cancelled) setSummaryError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange]);

  // Reset the product/store filters whenever the selected seller changes --
  // otherwise a filter value from the previous seller's product set can
  // silently produce an empty grid for the new seller with no visible
  // explanation (e.g. a Línea that only the old seller carried). This lives
  // in the SearchableSelect's onChange handler (handleSalesRepChange below),
  // not a useEffect keyed on salesRepKey -- react-hooks/set-state-in-effect
  // flags any synchronous setState call in an effect body, even one gated by
  // a dependency array, so the reset has to happen at the point salesRepKey
  // itself is set instead.
  function handleSalesRepChange(nextKey: string | null) {
    setSalesRepKey(nextKey);
    setLineFilter(null);
    setSubLineFilter(null);
    setCategoryFilter(null);
  }

  useEffect(() => {
    if (salesRepKey === null) {
      return;
    }
    let cancelled = false;
    async function load() {
      setMatrixError(null);
      setMatrixLoading(true);
      try {
        const params = new URLSearchParams({ section: 'matrix', salesRepKey: salesRepKey as string, dateRange });
        const res = await fetch(`/api/dwh/matriz-vendedor?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMatrixError(body.error ?? 'Error desconocido');
          return;
        }
        setMatrix(await res.json());
      } catch {
        if (!cancelled) setMatrixError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setMatrixLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [salesRepKey, dateRange]);

  const sellerOptions = useMemo(
    () => (summary?.rows ?? []).map(r => ({ value: r.salesRepKey, label: r.salesRepName })),
    [summary],
  );

  const lineOptions = useMemo(() => {
    if (!matrix) return [];
    const lines = new Set<string>();
    for (const p of matrix.products) if (p.lineName) lines.add(p.lineName);
    return Array.from(lines).sort();
  }, [matrix]);

  const subLineOptions = useMemo(() => {
    if (!matrix) return [];
    const subLines = new Set<string>();
    for (const p of matrix.products) if (p.subLineName) subLines.add(p.subLineName);
    return Array.from(subLines).sort();
  }, [matrix]);

  const categoryOptions = useMemo(() => {
    if (!matrix) return [];
    const categories = new Set<string>();
    for (const p of matrix.products) if (p.categoryName) categories.add(p.categoryName);
    return Array.from(categories).sort();
  }, [matrix]);

  const visibleProducts: SellerMatrixProduct[] = useMemo(() => {
    if (!matrix) return [];
    return matrix.products.filter(p =>
      (!lineFilter || p.lineName === lineFilter) &&
      (!subLineFilter || p.subLineName === subLineFilter) &&
      (!categoryFilter || p.categoryName === categoryFilter));
  }, [matrix, lineFilter, subLineFilter, categoryFilter]);

  const cellsByKey = useMemo(() => {
    const map = new Map<string, SellerMatrixResponse['cells'][number]>();
    if (matrix) for (const c of matrix.cells) map.set(cellKey(c.productKey, c.customerKey), c);
    return map;
  }, [matrix]);

  const exportParams = new URLSearchParams({ format: 'xlsx', dateRange });
  const exportAllParams = new URLSearchParams({ format: 'xlsx', dateRange });
  if (salesRepKey) exportParams.set('salesRepKey', salesRepKey);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Cobertura por vendedor</h2>
            <p className="text-xs text-gray-500">Ventas brutas, devoluciones (por fecha de factura) y ventas netas sin IVA, y entidades atendidas por cada vendedor. Incluye la facturación de consignación (la pestaña Vendedores la excluye)</p>
          </div>
          <a
            href={`/api/dwh/matriz-vendedor?${exportAllParams.toString()}`}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Exportar todos los vendedores
          </a>
        </div>

        {summaryLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : summaryError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{summaryError}</p>
        ) : !summary || summary.rows.length === 0 ? (
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
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Entidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.rows.map(row => (
                  <tr
                    key={row.salesRepKey}
                    className={`cursor-pointer hover:bg-blue-50 ${salesRepKey === row.salesRepKey ? 'bg-blue-50' : ''}`}
                    onClick={() => handleSalesRepChange(row.salesRepKey)}
                  >
                    <td className="px-3 py-2 text-gray-800">{row.salesRepName}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{moneyLabel(row.salesGross, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{moneyLabel(row.returns, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{moneyLabel(row.salesNet, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.entitiesServed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Matriz producto × tienda</h2>
            <p className="text-xs text-gray-500">Selecciona un vendedor para ver su cobertura por producto y tienda</p>
          </div>
          <div className="flex items-center gap-2">
            <SearchableSelect
              value={salesRepKey}
              onChange={handleSalesRepChange}
              options={sellerOptions}
              placeholder="Buscar vendedor..."
              className="max-w-[240px]"
            />
            {matrix && (
              <a
                href={`/api/dwh/matriz-vendedor?${exportParams.toString()}`}
                className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
              >
                Exportar vendedor
              </a>
            )}
          </div>
        </div>

        {salesRepKey === null ? (
          <EmptyState message="Selecciona un vendedor para ver su matriz." />
        ) : matrixLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : matrixError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{matrixError}</p>
        ) : !matrix || matrix.products.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {(lineOptions.length > 0 || subLineOptions.length > 0 || categoryOptions.length > 0) && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-3">
                {lineOptions.length > 0 && (
                  <div className="flex items-center gap-2">
                    Línea:
                    <select
                      value={lineFilter ?? ''}
                      onChange={e => setLineFilter(e.target.value || null)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Todas</option>
                      {lineOptions.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}
                {subLineOptions.length > 0 && (
                  <div className="flex items-center gap-2">
                    Sublínea:
                    <select
                      value={subLineFilter ?? ''}
                      onChange={e => setSubLineFilter(e.target.value || null)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Todas</option>
                      {subLineOptions.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}
                {categoryOptions.length > 0 && (
                  <div className="flex items-center gap-2">
                    Categoría:
                    <select
                      value={categoryFilter ?? ''}
                      onChange={e => setCategoryFilter(e.target.value || null)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Todas</option>
                      {categoryOptions.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-white">Producto</th>
                    {matrix.stores.map(s => (
                      <th key={s.customerKey} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                        {s.customerName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleProducts.map(p => (
                    <tr key={p.productKey}>
                      <td className="px-3 py-2 text-gray-800 sticky left-0 bg-white">{p.productName}</td>
                      {matrix.stores.map(s => {
                        const cell = cellsByKey.get(cellKey(p.productKey, s.customerKey));
                        return (
                          <td key={s.customerKey} className="px-3 py-2 text-right text-gray-600">
                            {cell ? (
                              <span title={`Devolución USD: ${pct(cell.returnRateUsd)} · Devolución unidades: ${pct(cell.returnRateUnits)}`}>
                                {moneyLabel(cell.netSales, currency)}
                              </span>
                            ) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
