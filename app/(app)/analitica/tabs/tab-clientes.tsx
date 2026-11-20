'use client';

import { useMemo, useState } from 'react';
import CoberturaClientes from '../components/cobertura-clientes';
import { ActivityTrendChart } from '../components/clientes/activity-trend-chart';
import { QuestionSection } from '../components/clientes/question-section';
import { ScopeBar } from '../components/clientes/scope-bar';
import { dimToApi, referenceYearOf, useClientesParams } from '../lib/clientes-params';
import { useDwhSection } from '../lib/use-dwh-section';
import type { Granularity } from '../lib/granularity';
import { moneyLabel } from '../lib/format';
import type { ClientesChurnedResponse, ClientesResponse, ClientesRow, ClientesTrendResponse, Currency, DateRange } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

// DateKey is YYYYMMDD (see dwh-migrations' Dim_Date) — formatted locally
// here rather than in lib/format.ts since this is the only tab that renders
// a raw DateKey rather than a pre-aggregated monthly/period figure.
function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-600 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
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

type SortKey = 'name' | 'salesGross' | 'returnsNet' | 'salesNet' | 'returnRate' | 'pareto';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortKey;
  label: string;
  align: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Cliente', align: 'left' },
  { key: 'salesGross', label: 'Ventas brutas', align: 'right' },
  { key: 'returnsNet', label: 'Devoluciones', align: 'right' },
  { key: 'salesNet', label: 'Ventas netas', align: 'right' },
  { key: 'returnRate', label: 'Tasa dev.', align: 'right' },
  { key: 'pareto', label: 'Segmento', align: 'right' },
];

function sortValue(row: ClientesRow, key: SortKey, currency: Currency): string | number {
  switch (key) {
    case 'name':
      return row.name ?? '';
    case 'salesGross':
      return (currency === 'usd' ? row.salesGross.usd : row.salesGross.bs) ?? -Infinity;
    case 'returnsNet':
      return (currency === 'usd' ? row.returnsNet.usd : row.returnsNet.bs) ?? -Infinity;
    case 'salesNet':
      return (currency === 'usd' ? row.salesNet.usd : row.salesNet.bs) ?? -Infinity;
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
  granularity,
}: {
  dateRange: DateRange;
  currency: Currency;
  granularity: Granularity;
}) {
  const [params, setParams] = useClientesParams();
  const [sortKey, setSortKey] = useState<SortKey>('salesGross');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');

  const dimApi = dimToApi(params.dim);
  const sectionUrl = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ dateRange, clienteDimension: dimApi, ...extra });
    if (params.grupo) q.set('grupo', params.grupo);
    if (params.ruta) q.set('ruta', params.ruta);
    return `/api/dwh/clientes?${q.toString()}`;
  };
  const main = useDwhSection<ClientesResponse>(sectionUrl());
  const trend = useDwhSection<ClientesTrendResponse>(sectionUrl({ section: 'trend', granularity }));
  const churned = useDwhSection<ClientesChurnedResponse>(sectionUrl({ section: 'churned' }));
  const data = main.data;

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (segmentFilter === 'all') return data.rows;
    return data.rows.filter(r => r.pareto === segmentFilter);
  }, [data, segmentFilter]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const av = sortValue(a, sortKey, currency);
      const bv = sortValue(b, sortKey, currency);
      let cmp: number;
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av).localeCompare(String(bv));
      } else {
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredRows, sortKey, sortDir, currency]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'pareto' ? 'asc' : 'desc');
    }
  }

  const segmentCounts = (data?.rows ?? []).reduce<Record<Segment, number>>(
    (acc, r) => {
      acc[r.pareto] += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0 }
  );
  const noun = params.dim === 'entidad' ? 'Clientes' : 'Tiendas';
  const bucketNoun = trend.data?.granularity === 'day' ? 'día' : trend.data?.granularity === 'week' ? 'semana' : 'mes';

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <ScopeBar params={params} onChange={setParams} referenceYear={referenceYearOf(dateRange)} />

      <QuestionSection question="¿Cómo evolucionan las ventas?">
        <ChartCard
          title="Clientes activos y tasa de abandono"
          subtitle={`Por ${bucketNoun} — grano: ${params.dim === 'entidad' ? 'Casa matriz' : 'Tienda'}`}
        >
          <ActivityTrendChart
            rows={trend.data?.rows ?? []}
            granularity={trend.data?.granularity ?? granularity}
            loading={trend.loading}
            error={trend.error}
            onRetry={trend.retry}
          />
        </ChartCard>
      </QuestionSection>

      <details
        open={params.detalle}
        onToggle={e => {
          const open = (e.currentTarget as HTMLDetailsElement).open;
          if (open !== params.detalle) setParams({ detalle: open });
        }}
        className="bg-white border border-gray-300 rounded-lg shadow-sm"
      >
        <summary className="cursor-pointer px-4 py-3 text-lg font-bold text-gray-900">Detalle operativo</summary>
        <div className="p-4 space-y-6">
          <CoberturaClientes
            dateRange={dateRange}
            grupo={params.grupo}
            ruta={params.ruta === null ? null : Number(params.ruta)}
            currency={currency}
            kind={params.origen}
            onKindChange={origen => setParams({ origen })}
          />

          <div className={`space-y-6 print:hidden ${main.loading || churned.loading ? 'opacity-60' : ''}`}>
            <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
              <h2 className="text-sm font-bold text-gray-900">{noun} perdidos</h2>
              <p className="text-xs text-gray-600 mb-3">
                {noun} con compras en el período anterior que no compraron en el período actual — ordenados por ingreso perdido.
              </p>
              {churned.error ? (
                <ErrorBox message={churned.error} onRetry={churned.retry} />
              ) : churned.data && !churned.data.available ? (
                <EmptyState message="No disponible para este rango de fechas." />
              ) : churned.data && churned.data.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{params.dim === 'entidad' ? 'Cliente' : 'Tienda'}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Última compra</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ingreso perdido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {churned.data.rows.map((r, i) => (
                        <tr key={`${r.name}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                          <td className="px-3 py-2 text-gray-800">{r.name}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{formatDateKey(r.lastPurchaseDateKey)}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{moneyLabel(r.lostRevenue, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : churned.loading && !churned.data ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-600">Cargando…</div>
              ) : (
                <EmptyState message="Sin clientes perdidos en este período." />
              )}
            </div>

            <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Segmentación de clientes (Pareto)</h2>
                  <p className="text-xs text-gray-600">
                    Clientes ordenados por ventas brutas (sin IVA, antes de devoluciones), segmentados por participación
                    acumulada; devoluciones y ventas netas por fecha de la factura original
                    {data ? <> — A: top {(data.paretoThresholds.a * 100).toFixed(0)}%, B: hasta {(data.paretoThresholds.b * 100).toFixed(0)}%, C: resto</> : null}
                  </p>
                </div>
                <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
                  {SEGMENT_FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={segmentFilter === opt.value}
                      onClick={() => setSegmentFilter(opt.value)}
                      className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                        segmentFilter === opt.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                      {opt.value !== 'all' && <span className="ml-1 text-xs opacity-75">({segmentCounts[opt.value]})</span>}
                    </button>
                  ))}
                </div>
              </div>
              {main.error ? (
                <ErrorBox message={main.error} onRetry={main.retry} />
              ) : !data && main.loading ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-600">Cargando…</div>
              ) : sortedRows.length === 0 ? (
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
                            {sortKey === col.key && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedRows.map((r, i) => (
                        <tr key={r.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                          <td className="px-3 py-2 text-gray-800">{r.name}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{moneyLabel(r.salesGross, currency)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{moneyLabel(r.returnsNet, currency)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{moneyLabel(r.salesNet, currency)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{pct(r.returnRate)}</td>
                          <td className="px-3 py-2 text-right"><SegmentBadge segment={r.pareto} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-sm bg-red-50 border border-red-200 rounded px-4 py-3 flex items-center gap-3">
      <span className="text-red-700">{message}</span>
      <button type="button" onClick={onRetry} className="px-2 py-1 rounded border border-red-300 bg-white text-red-700">Reintentar</button>
    </div>
  );
}
