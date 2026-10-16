'use client';

import { useEffect, useMemo, useState } from 'react';
import posthog from 'posthog-js';
import SearchableSelect from '@/lib/components/searchable-select';
import { KpiCard } from './kpi-card';
import { KpiGroup } from './kpi-group';
import { KindBadge, KindComparisonPanel, KindSwitch, NewFunnelPanel, PatrimonioHoldingPanel, StickinessBadge } from './kind-panels';
import { VisitBadge } from './seguimiento/visuals';
import type { CoberturaResponse, CoberturaRowView, CoberturaStatus, Currency, DateRange } from '../types';
import { summarizeCartera } from '../lib/cartera';
import { STICKINESS_LABEL, STICKINESS_ORDER, type KindFilter, type Stickiness } from '../lib/kind-kpis';
import { moneyLabel } from '../lib/format';
import {
  NO_SELLER, compareDaysSince, coberturaExportQuery, filterCobertura, groupBySeller, summarizeCobertura,
} from '../lib/cobertura';

type SortKey = 'days' | 'customer' | 'seller' | 'usd' | 'units' | 'visit' | 'sales' | 'registered';
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

const isoToDisplay = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : NO_DATA);

export default function CoberturaClientes({
  dateRange = '12m', grupo = null, ruta = null, currency = 'usd',
}: { dateRange?: DateRange; grupo?: string | null; ruta?: number | null; currency?: Currency } = {}) {
  const [data, setData] = useState<CoberturaResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [sellerFilter, setSellerFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CoberturaStatus | null>(null);
  const [visitFilter, setVisitFilter] = useState<'overdue' | 'no_interval' | null>(null);
  const [inactiveOnly, setInactiveOnly] = useState<boolean>(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>('todos');
  const [cooledOnly, setCooledOnly] = useState<boolean>(false);
  const [stickinessFilter, setStickinessFilter] = useState<Stickiness | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/dwh/clientes/cobertura?includeInactive=${includeInactive ? 1 : 0}&dateRange=${encodeURIComponent(dateRange)}`);
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
  }, [includeInactive, dateRange]);

  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(() => filterCobertura(allRows, { grupo, ruta }), [allRows, grupo, ruta]);

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

  // The switch scopes the portfolio KPIs and the table; the comparison panel keeps looking at both kinds.
  const scoped = useMemo(() => (kindFilter === 'todos' ? rows : rows.filter(r => r.kind === kindFilter)), [rows, kindFilter]);
  const summary = useMemo(() => summarizeCobertura(scoped), [scoped]);
  const cartera = useMemo(() => summarizeCartera(scoped), [scoped]);

  const sorted = useMemo(() => {
    const filtered = filterCobertura(scoped, { sellerCode: sellerFilter, status: statusFilter, visit: visitFilter, inactiveInPeriod: inactiveOnly, cooled: cooledOnly, stickiness: stickinessFilter });
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
        case 'sales':
          return compareNullLast(currency === 'usd' ? a.salesPeriod.usd : a.salesPeriod.bs, currency === 'usd' ? b.salesPeriod.usd : b.salesPeriod.bs, sortDir);
        case 'registered':
          return (sortDir === 'asc' ? 1 : -1) * (a.registeredDate ?? '9999').localeCompare(b.registeredDate ?? '9999');
        case 'visit':
          // Customers without days overdue (no frequency / no invoice) all tie: order them by name.
          return compareNullLast(a.visit.daysOverdue, b.visit.daysOverdue, sortDir)
            || a.customerName.localeCompare(b.customerName);
      }
    });
    return out;
  }, [scoped, sellerFilter, statusFilter, visitFilter, inactiveOnly, cooledOnly, stickinessFilter, currency, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'customer' || key === 'seller' || key === 'days' || key === 'registered' ? 'asc' : 'desc');
    }
  }

  function handleExport() {
    posthog.capture('cobertura_export', { seller: sellerFilter, status: statusFilter, rows: sorted.length });
    window.location.href = `/api/dwh/clientes/cobertura?${coberturaExportQuery({ includeInactive, sellerCode: sellerFilter, status: statusFilter, dateRange, grupo, ruta, visit: visitFilter, inactiveInPeriod: inactiveOnly, kind: kindFilter === 'todos' ? null : kindFilter, cooled: cooledOnly, stickiness: stickinessFilter })}`;
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
              La última venta mira todo el histórico; los promedios son de los últimos 12 meses, sobre los meses en
              que el cliente tuvo facturas. Solo &quot;Sin compras en el período&quot; y &quot;Clientes nuevos&quot; usan el
              rango de fechas. &quot;{NO_DATA}&quot; = no hay facturas.
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

        <div className="flex items-center gap-3 flex-wrap">
          <KindSwitch value={kindFilter} onChange={k => { setKindFilter(k); setCooledOnly(false); }} rows={rows} />
          <span className="text-xs text-gray-500">
            Patrimonio: registrado antes de {data.kindYear} o en el lote migrado. Nuevo: registrado en {data.kindYear}.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <KindComparisonPanel rows={rows} currency={currency} />
          {kindFilter !== 'nuevo' && (
            <PatrimonioHoldingPanel
              rows={rows}
              prevPeriodAvailable={data.prevPeriodAvailable}
              currency={currency}
              onShowCooled={() => { setKindFilter('patrimonio'); setCooledOnly(true); }}
            />
          )}
          {kindFilter !== 'patrimonio' && <NewFunnelPanel rows={rows} />}
        </div>

        <KpiGroup title="Cobertura" tone="customers" columns={4}>
          <KpiCard label="Nunca vendido" value={String(summary.never)} tone={summary.never > 0 ? 'warn' : 'default'} />
          <KpiCard label="Vende vía matriz" value={String(summary.viaMatriz)} title="Sin facturas propias, pero otra tienda de su misma entidad sí tiene ventas." />
          <KpiCard label="Sin ventas 30+ días" value={String(summary.lapsed)} />
          <KpiCard label="Activos" value={String(summary.active)} subtitle={`de ${summary.total} clientes`} />
        </KpiGroup>

        <KpiGroup title="Visitas y período" tone="customers" columns={4}>
          <KpiCard
            label="Visitas vencidas"
            value={String(cartera.compliance.overdue)}
            tone={cartera.compliance.overdue > 0 ? 'warn' : 'default'}
            subtitle={`${cartera.compliance.noInterval} sin frecuencia`}
            title="Clientes con más días sin comprar que su frecuencia de visita (semanal 7, quincenal 15, mensual 30). Un cliente sin frecuencia asignada nunca figura como vencido."
          />
          <KpiCard
            label="Cumplimiento de visitas"
            value={cartera.compliance.complianceRate === null ? '—' : `${Math.round(cartera.compliance.complianceRate * 100)}%`}
            subtitle={cartera.compliance.complianceRate === null
              ? 'Sin frecuencia asignada'
              : `${cartera.compliance.ok} al día de ${cartera.compliance.ok + cartera.compliance.overdue}`}
          />
          <KpiCard
            label="Sin compras en el período"
            value={String(cartera.inactiveInPeriod)}
            tone={cartera.inactiveInPeriod > 0 ? 'warn' : 'default'}
            subtitle={`de ${cartera.compliance.total} clientes asignados`}
            title="Clientes asignados sin ninguna factura (sin anuladas) en el rango de fechas elegido. No cuenta a los registrados después del fin del rango."
          />
          <KpiCard
            label="Clientes nuevos"
            value={String(cartera.nuevos)}
            subtitle={`${cartera.patrimonio} patrimonio`}
            title="Nuevo: registrado en el año del rango, sin contar el lote migrado en la puesta en marcha. Patrimonio: registrado antes del año o en ese lote."
          />
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
          <select
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            value={visitFilter ?? ''}
            onChange={e => setVisitFilter((e.target.value || null) as 'overdue' | 'no_interval' | null)}
            aria-label="Filtrar por visita"
          >
            <option value="">Todas las visitas</option>
            <option value="overdue">Visita vencida</option>
            <option value="no_interval">Sin frecuencia</option>
          </select>
          <select
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            value={stickinessFilter ?? ''}
            onChange={e => setStickinessFilter((e.target.value || null) as Stickiness | null)}
            aria-label="Filtrar por constancia"
          >
            <option value="">Toda constancia</option>
            {STICKINESS_ORDER.map(k => <option key={k} value={k}>{STICKINESS_LABEL[k]}</option>)}
          </select>
          {cooledOnly && (
            <button type="button" onClick={() => setCooledOnly(false)} className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
              Solo los que se enfriaron ✕
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={inactiveOnly} onChange={e => setInactiveOnly(e.target.checked)} />
            Sin compras en el período
          </label>
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
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Ruta</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Grupo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                  {sortHeader('registered', 'Registro')}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Última venta</th>
                  {sortHeader('days', 'Días sin vender', 'right')}
                  {sortHeader('usd', 'USD/mes', 'right')}
                  {sortHeader('units', 'Unidades/mes', 'right')}
                  {sortHeader('sales', 'Ventas del período', 'right')}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                  {sortHeader('visit', 'Visita')}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase" title="Compras en cada una de las últimas 3 ventanas de su frecuencia de visita">Constancia</th>
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
                    <td className="px-3 py-2 text-gray-600">{r.routeNumber === null ? 'Sin ruta' : `Ruta ${r.routeNumber}`}</td>
                    <td className="px-3 py-2 text-gray-600">{r.groupName ?? 'Sin grupo'}</td>
                    <td className="px-3 py-2"><KindBadge kind={r.kind} /></td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{isoToDisplay(r.registeredDate)}</td>
                    <td className="px-3 py-2 text-gray-600">{lastSaleCell(r)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{r.daysSinceLastSale ?? NO_DATA}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{usd(r.avgMonthlyUsd)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{units(r.avgMonthlyUnits)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{moneyLabel(r.salesPeriod, currency)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2"><VisitBadge visit={r.visit} /></td>
                    <td className="px-3 py-2"><StickinessBadge value={r.stickiness} /></td>
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
