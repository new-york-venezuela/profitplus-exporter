'use client';

import { useMemo, useState } from 'react';
import CoberturaClientes from '../components/cobertura-clientes';
import { ActivityTrendChart } from '../components/clientes/activity-trend-chart';
import { DataTable, type Column } from '../components/clientes/data-table';
import { KpiStrip } from '../components/clientes/kpi-strip';
import { ProductBreakdown } from '../components/clientes/product-breakdown';
import { RetentionSection } from '../components/clientes/retention-section';
import { TrajectoryTable } from '../components/clientes/trajectory-table';
import { QuestionSection } from '../components/clientes/question-section';
import { SegmentedControl } from '../components/clientes/segmented-control';
import { ScopeBar } from '../components/clientes/scope-bar';
import { dimToApi, referenceYearOf, useClientesParams } from '../lib/clientes-params';
import { filterCobertura } from '../lib/cobertura';
import { useDwhSection } from '../lib/use-dwh-section';
import type { Granularity } from '../lib/granularity';
import { moneyLabel } from '../lib/format';
import { buildEstados } from '@/lib/clientes/estados';
import { buildKpis } from '@/lib/clientes/kpis';
import type { ClientesTrayectoriaResponse } from '@/lib/clientes/trayectoria';
import type { ClientesResponse, ClientesRow, ClientesTrendResponse, CoberturaResponse, Currency, DateRange } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
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

type ParetoRow = ClientesRow & { id: string };

const SEGMENT_FILTER_OPTIONS: { value: SegmentFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
];

function amountOf(a: { bs: number; usd: number | null }, currency: Currency): number | null {
  return currency === 'usd' ? a.usd : a.bs;
}

function paretoColumns(currency: Currency): Column<ParetoRow>[] {
  return [
    { key: 'name', label: 'Cliente', sortValue: r => r.name, render: r => r.name },
    { key: 'salesGross', label: 'Ventas brutas', align: 'right', sortValue: r => amountOf(r.salesGross, currency), render: r => <span className="font-medium text-gray-900">{moneyLabel(r.salesGross, currency)}</span> },
    { key: 'returnsNet', label: 'Devoluciones', align: 'right', sortValue: r => amountOf(r.returnsNet, currency), render: r => moneyLabel(r.returnsNet, currency) },
    { key: 'salesNet', label: 'Ventas netas', align: 'right', sortValue: r => amountOf(r.salesNet, currency), render: r => moneyLabel(r.salesNet, currency) },
    { key: 'returnRate', label: 'Tasa dev.', align: 'right', sortValue: r => r.returnRate, render: r => pct(r.returnRate) },
    { key: 'pareto', label: 'Segmento', align: 'right', sortValue: r => r.pareto, render: r => <SegmentBadge segment={r.pareto} /> },
  ];
}

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
  const trayectoria = useDwhSection<ClientesTrayectoriaResponse>(sectionUrl({ section: 'trayectoria' }));
  const cobertura = useDwhSection<CoberturaResponse>(`/api/dwh/clientes/cobertura?includeInactive=0&dateRange=${encodeURIComponent(dateRange)}`);
  const scopedCobertura = useMemo<CoberturaResponse | null>(() => {
    if (!cobertura.data) return null;
    // Origen is not applied here: the Patrimonio and Nuevos cards need both origins; Origen scopes Cobertura and Q4.
    return { ...cobertura.data, rows: filterCobertura(cobertura.data.rows, { grupo: params.grupo, ruta: params.ruta === null ? null : Number(params.ruta) }) };
  }, [cobertura.data, params.grupo, params.ruta]);
  const estados = useMemo(() => (scopedCobertura ? buildEstados(scopedCobertura) : null), [scopedCobertura]);
  const estadoByCode = useMemo(() => new Map((estados?.rows ?? []).map(r => [r.customerCode, r.estado] as const)), [estados]);
  const kpis = useMemo(
    () => buildKpis({ cobertura: scopedCobertura, estados, trayectoria: trayectoria.data?.rows ?? null, currency }),
    [scopedCobertura, estados, trayectoria.data, currency],
  );
  const data = main.data;

  const paretoRows: ParetoRow[] = (data?.rows ?? []).map((r, i) => ({ ...r, id: String(i) }));
  const visibleParetoRows = segmentFilter === 'all' ? paretoRows : paretoRows.filter(r => r.pareto === segmentFilter);

  const segmentCounts = (data?.rows ?? []).reduce<Record<Segment, number>>(
    (acc, r) => {
      acc[r.pareto] += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0 }
  );
  const bucketNoun = trend.data?.granularity === 'day' ? 'día' : trend.data?.granularity === 'week' ? 'semana' : 'mes';

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <ScopeBar params={params} onChange={setParams} referenceYear={referenceYearOf(dateRange)} />

      <QuestionSection question="¿Cómo evolucionan las ventas?">
        <KpiStrip cards={kpis} onFilter={setParams} />
        <SegmentedControl
          ariaLabel="Ver por"
          value={params.ver === 'producto' ? 'producto' : 'total'}
          options={[{ value: 'total', label: 'Total' }, { value: 'producto', label: 'Producto' }]}
          onChange={ver => setParams({ ver })}
        />
        {params.ver === 'producto' ? (
          <ProductBreakdown params={params} dateRange={dateRange} granularity={granularity} currency={currency} onParams={setParams} />
        ) : (
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
        )}
      </QuestionSection>

      <QuestionSection question="¿Cómo evolucionan clientes y tiendas?">
        {trayectoria.error ? (
          <ErrorBox message={trayectoria.error} onRetry={trayectoria.retry} />
        ) : !trayectoria.data ? (
          <div className="h-24 flex items-center justify-center text-sm text-gray-600">Cargando…</div>
        ) : (
          <div className={`bg-white border border-gray-300 rounded-lg shadow-sm p-4 ${trayectoria.loading ? 'opacity-60' : ''}`}>
            <TrajectoryTable
              rows={trayectoria.data.rows}
              currency={currency}
              dim={params.dim}
              selectedKey={params.tienda}
              onSelect={tienda => setParams({ tienda })}
              estadoByCode={estadoByCode}
            />
          </div>
        )}
      </QuestionSection>

      <QuestionSection question="¿Se mantiene la base de clientes?">
        {cobertura.error ? (
          <ErrorBox message={cobertura.error} onRetry={cobertura.retry} />
        ) : !estados ? (
          <div className="h-24 flex items-center justify-center text-sm text-gray-600">Cargando…</div>
        ) : (
          <div className={cobertura.loading ? 'opacity-60' : ''}>
            <RetentionSection data={estados} currency={currency} origen={params.origen} onOrigen={origen => setParams({ origen })} />
          </div>
        )}
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
            shared={cobertura}
          />

          <div className={`space-y-6 print:hidden ${main.loading ? 'opacity-60' : ''}`}>
            <section aria-label="Pareto de clientes" className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Segmentación de clientes (Pareto)</h2>
                  <p className="text-xs text-gray-600">
                    Clientes ordenados por ventas brutas (sin IVA, antes de devoluciones), segmentados por participación
                    acumulada; devoluciones y ventas netas por fecha de la factura original
                    {data ? <> — A: top {(data.paretoThresholds.a * 100).toFixed(0)}%, B: hasta {(data.paretoThresholds.b * 100).toFixed(0)}%, C: resto</> : null}
                  </p>
                </div>
                <SegmentedControl
                  ariaLabel="Segmento Pareto"
                  value={segmentFilter}
                  options={SEGMENT_FILTER_OPTIONS.map(o => ({ ...o, count: o.value === 'all' ? undefined : segmentCounts[o.value] }))}
                  onChange={setSegmentFilter}
                />
              </div>
              {main.error ? (
                <ErrorBox message={main.error} onRetry={main.retry} />
              ) : !data && main.loading ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-600">Cargando…</div>
              ) : (
                <DataTable<ParetoRow>
                  columns={paretoColumns(currency)}
                  rows={visibleParetoRows}
                  rowKey={r => r.id}
                  defaultSort={{ key: 'salesGross', dir: 'desc' }}
                  searchText={r => r.name}
                  exportFile={{ name: 'pareto-clientes.csv', toRecord: r => ({ Cliente: r.name, 'Ventas brutas': amountOf(r.salesGross, currency), Devoluciones: amountOf(r.returnsNet, currency), 'Ventas netas': amountOf(r.salesNet, currency), 'Tasa dev.': r.returnRate, Segmento: r.pareto }) }}
                  emptyMessage="Sin datos disponibles todavía."
                  pageSize={100}
                />
              )}
            </section>
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
