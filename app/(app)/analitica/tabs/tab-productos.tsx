'use client';

import { useEffect, useState } from 'react';
import type { Currency, DateRange, ProductosResponse, ProductosRow } from '../types';

type ProductosGroupBy = 'linea' | 'sublinea' | 'sku';

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

function qty(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n);
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

const COLUMN_LABEL: Record<ProductosGroupBy, string> = {
  linea: 'Línea',
  sublinea: 'Sublínea',
  sku: 'SKU',
};

function rowLabel(row: ProductosRow, groupBy: ProductosGroupBy): string {
  if (groupBy === 'sku') return row.sku;
  if (groupBy === 'sublinea') return row.sublinea;
  return row.linea;
}

function rowKey(row: ProductosRow, i: number): string {
  return `${row.linea}-${row.sublinea}-${row.sku}-${i}`;
}

export default function TabProductos({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [groupBy, setGroupBy] = useState<ProductosGroupBy>('linea');
  const [linea, setLinea] = useState<string | null>(null);
  const [sublinea, setSublinea] = useState<string | null>(null);
  const [data, setData] = useState<ProductosResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy !== 'linea' && linea) params.set('linea', linea);
        if (groupBy === 'sku' && sublinea) params.set('sublinea', sublinea);
        const res = await fetch(`/api/dwh/productos?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ProductosResponse = await res.json();
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
  }, [dateRange, currency, groupBy, linea, sublinea]);

  function handleRowClick(row: ProductosRow) {
    if (groupBy === 'linea') {
      setLinea(row.linea);
      setSublinea(null);
      setGroupBy('sublinea');
    } else if (groupBy === 'sublinea') {
      setSublinea(row.sublinea);
      setGroupBy('sku');
    }
  }

  function handleBreadcrumbClick(crumbGroupBy: ProductosGroupBy) {
    if (crumbGroupBy === 'linea') {
      setLinea(null);
      setSublinea(null);
      setGroupBy('linea');
    } else if (crumbGroupBy === 'sublinea') {
      setSublinea(null);
      setGroupBy('sublinea');
    }
  }

  const rate = data?.usdRate ?? undefined;
  const drillable = groupBy !== 'sku';

  return (
    <div className="p-6 max-w-7xl space-y-6">
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
                  onClick={() => handleBreadcrumbClick(crumb.groupBy as ProductosGroupBy)}
                  className="hover:text-blue-600 hover:underline"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900">Rotación y margen por producto</h2>
        <p className="text-xs text-gray-500 mb-3">
          {groupBy === 'linea' && 'Ventas netas, rotación y margen por línea de producto — clic en una fila para ver sus sublíneas'}
          {groupBy === 'sublinea' && 'Sublíneas de la línea seleccionada — clic en una fila para ver sus productos'}
          {groupBy === 'sku' && 'Productos individuales de la sublínea seleccionada'}
        </p>

        {loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                    {COLUMN_LABEL[groupBy]}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row, i) => (
                  <tr
                    key={rowKey(row, i)}
                    onClick={drillable ? () => handleRowClick(row) : undefined}
                    className={`${i % 2 === 1 ? 'bg-gray-50' : ''} ${drillable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-gray-800">{rowLabel(row, groupBy)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(row.salesNet, currency, rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{qty(row.rotacion)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.margin)}</td>
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
