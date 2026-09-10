'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Currency, DateRange, VendedoresResponse, VendedoresRow } from '../types';

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

type SortKey = 'name' | 'salesNet' | 'returnsNet' | 'returnRate' | 'collectionRate' | 'avgDiscount';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortKey;
  label: string;
  align: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Nombre', align: 'left' },
  { key: 'salesNet', label: 'Ventas netas', align: 'right' },
  { key: 'returnsNet', label: 'Devoluciones', align: 'right' },
  { key: 'returnRate', label: 'Tasa dev.', align: 'right' },
  { key: 'collectionRate', label: 'Tasa cobr.', align: 'right' },
  { key: 'avgDiscount', label: 'Descto prom.', align: 'right' },
];

function sortValue(row: VendedoresRow, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return row.name ?? '';
    case 'salesNet':
      return row.salesNet;
    case 'returnsNet':
      return row.returnsNet;
    case 'returnRate':
      return row.returnRate ?? -Infinity;
    case 'collectionRate':
      return row.collectionRate ?? -Infinity;
    case 'avgDiscount':
      return row.avgDiscount ?? -Infinity;
  }
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
  const [sortKey, setSortKey] = useState<SortKey>('salesNet');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.rows];
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
  }, [data, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
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

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900">Desempeño por vendedor</h2>
        <p className="text-xs text-gray-500 mb-3">
          Ventas netas, devoluciones y cobranza por representante de ventas
        </p>
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
                    <td className="px-3 py-2 text-right text-gray-600">{pct(r.collectionRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(r.avgDiscount)}</td>
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
