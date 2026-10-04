'use client';

import { useEffect, useMemo, useState } from 'react';
import posthog from 'posthog-js';
import SearchableSelect from '@/lib/components/searchable-select';
import { KpiCard } from './kpi-card';
import { KpiGroup } from './kpi-group';
import type { CoberturaResponse, CoberturaRowView, CoberturaStatus } from '../types';
import {
  NO_SELLER, compareDaysSince, coberturaExportQuery, filterCobertura, groupBySeller, summarizeCobertura,
} from '../lib/cobertura';

type SortKey = 'days' | 'customer' | 'seller' | 'usd' | 'units';
type SortDir = 'asc' | 'desc';

const NO_DATA = 'Sin datos';

const STATUS_LABEL: Record<CoberturaStatus, string> = {
  never: 'Nunca vendido',
  via_matriz: 'Vende vía matriz',
  lapsed: 'Sin ventas 30+ días',
  active: 'Activo',
};

const STATUS_CLASS: Record<CoberturaStatus, string> = {
  never: 'bg-red-100 text-red-800',
  via_matriz: 'bg-blue-100 text-blue-800',
  lapsed: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
};

function formatKey(key: number | null): string {
  if (key === null) return NO_DATA;
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

function usd(n: number | null): string {
  return n === null ? NO_DATA : `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;
}

function units(n: number | null): string {
  return n === null ? NO_DATA : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(n);
}

function lastSaleCell(r: CoberturaRowView) {
  if (r.lastSaleDateKey !== null) return formatKey(r.lastSaleDateKey);
  if (r.status === 'via_matriz') return `${NO_DATA} (matriz: ${formatKey(r.entityLastSaleDateKey)})`;
  return NO_DATA;
}

function compareNullLast(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === 'asc' ? a - b : b - a;
}

const PRINT_CSS = `
@media print {
  aside { display: none !important; }
  body * { visibility: hidden !important; }
  #cobertura-print, #cobertura-print * { visibility: visible !important; }
  #cobertura-print { position: absolute; left: 0; top: 0; width: 100%; }
  .cobertura-seller-block { break-before: page; }
  .cobertura-seller-block:first-child { break-before: auto; }
}
`;

const STATUS_FILTER_OPTIONS: { value: '' | CoberturaStatus; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'never', label: STATUS_LABEL.never },
  { value: 'via_matriz', label: STATUS_LABEL.via_matriz },
  { value: 'lapsed', label: STATUS_LABEL.lapsed },
  { value: 'active', label: STATUS_LABEL.active },
];

export default function CoberturaClientes() {
  const [data, setData] = useState<CoberturaResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [sellerFilter, setSellerFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CoberturaStatus | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/dwh/clientes/cobertura?includeInactive=${includeInactive ? 1 : 0}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: CoberturaResponse = await res.json();
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
  }, [includeInactive]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const sellerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    let hasNone = false;
    for (const r of rows) {
      if (r.sellerCode === null) hasNone = true;
      else if (!seen.has(r.sellerCode)) seen.set(r.sellerCode, r.sellerName ?? r.sellerCode);
    }
    const opts = [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (hasNone) opts.push({ value: NO_SELLER, label: 'Sin vendedor' });
    return opts;
  }, [rows]);

  const summary = useMemo(() => summarizeCobertura(rows), [rows]);

  const sorted = useMemo(() => {
    const filtered = filterCobertura(rows, { sellerCode: sellerFilter, status: statusFilter });
    const out = [...filtered];
    out.sort((a, b) => {
      switch (sortKey) {
        case 'days':
          return compareDaysSince(a, b, sortDir);
        case 'customer':
          return (sortDir === 'asc' ? 1 : -1) * a.customerName.localeCompare(b.customerName);
        case 'seller':
          return (sortDir === 'asc' ? 1 : -1) * (a.sellerName ?? '~').localeCompare(b.sellerName ?? '~');
        case 'usd':
          return compareNullLast(a.avgMonthlyUsd, b.avgMonthlyUsd, sortDir);
        case 'units':
          return compareNullLast(a.avgMonthlyUnits, b.avgMonthlyUnits, sortDir);
      }
    });
    return out;
  }, [rows, sellerFilter, statusFilter, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'customer' || key === 'seller' || key === 'days' ? 'asc' : 'desc');
    }
  }

  function handleExport() {
    posthog.capture('cobertura_export', { seller: sellerFilter, status: statusFilter, rows: sorted.length });
    window.location.href = `/api/dwh/clientes/cobertura?${coberturaExportQuery({ includeInactive, sellerCode: sellerFilter, status: statusFilter })}`;
  }

  function handlePrint() {
    posthog.capture('cobertura_print', { seller: sellerFilter, status: statusFilter, rows: sorted.length });
    window.print();
  }

  const sortHeader = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th
      className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase ${align === 'right' ? 'text-right' : 'text-left'}`}
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => handleSort(key)} className="uppercase hover:text-gray-900">
        {label}
        {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  if (loading && !data) return <div className="p-4 text-sm text-gray-500">Cargando cobertura de clientes…</div>;
  if (error) {
    return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>;
  }
  if (!data) return null;

  const groups = groupBySeller(sorted);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <section className="print:hidden space-y-4" aria-label="Cobertura de clientes">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cobertura de clientes</h2>
            <p className="text-xs text-gray-500 max-w-2xl">
              No depende del período seleccionado: la última venta mira todo el histórico; los promedios son de los
              últimos 12 meses, sobre los meses en que el cliente tuvo facturas. &quot;{NO_DATA}&quot; = no hay facturas.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handlePrint} className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50">
              Imprimir
            </button>
            <button type="button" onClick={handleExport} className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700">
              Exportar Excel
            </button>
          </div>
        </div>

        <KpiGroup title="Cobertura" tone="customers" columns={4}>
          <KpiCard label="Nunca vendido" value={String(summary.never)} tone={summary.never > 0 ? 'warn' : 'default'} />
          <KpiCard label="Vende vía matriz" value={String(summary.viaMatriz)} title="Sin facturas propias, pero otra tienda de su misma entidad sí tiene ventas." />
          <KpiCard label="Sin ventas 30+ días" value={String(summary.lapsed)} />
          <KpiCard label="Activos" value={String(summary.active)} subtitle={`de ${summary.total} clientes`} />
        </KpiGroup>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-64">
            <SearchableSelect
              value={sellerFilter}
              onChange={setSellerFilter}
              options={sellerOptions}
              allLabel="Todos los vendedores"
              placeholder="Buscar vendedor…"
              ariaLabel="Filtrar por vendedor"
            />
          </div>
          <select
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            value={statusFilter ?? ''}
            onChange={e => setStatusFilter((e.target.value || null) as CoberturaStatus | null)}
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
            Incluir inactivos
          </label>
          <span className="text-xs text-gray-500">{sorted.length} clientes</span>
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
            Ningún cliente coincide con los filtros.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {sortHeader('customer', 'Cliente')}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Entidad</th>
                  {sortHeader('seller', 'Vendedor')}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Última venta</th>
                  {sortHeader('days', 'Días sin vender', 'right')}
                  {sortHeader('usd', 'USD/mes', 'right')}
                  {sortHeader('units', 'Unidades/mes', 'right')}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(r => (
                  <tr key={r.customerCode}>
                    <td className="px-3 py-2 text-gray-900">
                      {r.customerName}
                      <span className="block text-xs text-gray-400">{r.customerCode}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.entityName ?? NO_DATA}</td>
                    <td className="px-3 py-2 text-gray-600">{r.sellerName ?? 'Sin vendedor'}</td>
                    <td className="px-3 py-2 text-gray-600">{lastSaleCell(r)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{r.daysSinceLastSale ?? NO_DATA}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{usd(r.avgMonthlyUsd)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{units(r.avgMonthlyUnits)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Print-only layout: one block (page) per seller. */}
      <div id="cobertura-print" className="hidden print:block">
        {groups.map(g => {
          const s = summarizeCobertura(g.rows);
          return (
            <section key={g.sellerCode ?? NO_SELLER} className="cobertura-seller-block">
              <h2 className="text-base font-bold">Cobertura de clientes — Vendedor: {g.sellerName}</h2>
              <p className="text-xs mb-2">
                Al {formatKey(data.asOfDateKey)} · {s.total} clientes · {s.never} nunca vendidos · {s.viaMatriz} vía matriz · {s.lapsed} sin ventas {data.lapsedAfterDays}+ días · {s.active} activos
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-400 text-left">
                    <th className="py-1 pr-2">Cliente</th>
                    <th className="py-1 pr-2">Entidad</th>
                    <th className="py-1 pr-2">Última venta</th>
                    <th className="py-1 pr-2 text-right">Días</th>
                    <th className="py-1 pr-2 text-right">USD/mes</th>
                    <th className="py-1 pr-2 text-right">Unid./mes</th>
                    <th className="py-1">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(r => (
                    <tr key={r.customerCode} className="border-b border-gray-200">
                      <td className="py-1 pr-2">{r.customerName}</td>
                      <td className="py-1 pr-2">{r.entityName ?? NO_DATA}</td>
                      <td className="py-1 pr-2">{lastSaleCell(r)}</td>
                      <td className="py-1 pr-2 text-right">{r.daysSinceLastSale ?? NO_DATA}</td>
                      <td className="py-1 pr-2 text-right">{usd(r.avgMonthlyUsd)}</td>
                      <td className="py-1 pr-2 text-right">{units(r.avgMonthlyUnits)}</td>
                      <td className="py-1">{STATUS_LABEL[r.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </>
  );
}
