'use client';

import { Fragment, type ReactNode } from 'react';
import type {
  RootMetrics, SeguimientoCustomer, SeguimientoInvoiceLine, SeguimientoRoot, WeekHeader,
} from '@/lib/seguimiento/types';
import { moneyLabel, priceLabel, usdLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { num, pct, units } from './fmt';
import { MixBar, NewCustomersChip, QuotaBar, UnitsBar, VisitBadge, WeekDots, WeekStrip } from './visuals';

export function overdueLabel(m: RootMetrics): string {
  const c = m.compliance;
  if (c.ok + c.overdue === 0) return c.noInterval > 0 ? 'Sin frecuencia' : '—';
  return `${c.overdue} vencida${c.overdue === 1 ? '' : 's'} de ${c.ok + c.overdue}`;
}

export function RootCard({
  title, subtitle, metrics, headers, visibleLines, currency, expanded, onToggle, actions, footer, children,
}: {
  title: string;
  subtitle?: string;
  metrics: RootMetrics;
  headers: WeekHeader[];
  visibleLines: readonly string[];
  currency: Currency;
  expanded: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  footer?: ReactNode;      // always rendered (e.g. the inline quota editors); `children` only when expanded
  children?: ReactNode;
}) {
  return (
    <article aria-label={title} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{metrics.customerCount} clientes{subtitle ? ` · ${subtitle}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <NewCustomersChip info={metrics.newCustomers} />
          {actions}
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? 'Ocultar clientes' : 'Ver clientes'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Activación semanal</div>
          <WeekStrip weeks={metrics.weeks} headers={headers} />
        </div>
        <div className="md:col-span-2">
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Ventas vs meta del mes</div>
          <QuotaBar
            actual={metrics.sales} quotaUsd={metrics.salesQuotaUsd} projected={metrics.projected}
            currency={currency} shared={metrics.quotaShared} partial={metrics.quotaPartial}
          />
          <div className="text-[11px] font-semibold uppercase text-gray-500 mt-3 mb-1">Unidades vs meta del mes</div>
          <UnitsBar
            actual={metrics.units} quota={metrics.unitsQuota ?? null} projected={metrics.projectedUnits ?? null}
            shared={metrics.quotaShared} partial={metrics.unitsQuotaPartial ?? false}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-600">
            Precio prom.: <span className="font-medium text-gray-900">{metrics.avgPrice ? priceLabel(metrics.avgPrice, currency) : '—'}</span>
          </div>
          <div className="text-xs text-gray-600">Visitas: <span className="font-medium text-gray-900">{overdueLabel(metrics)}</span></div>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Mezcla por línea</div>
        <MixBar segments={metrics.mix} visibleLines={visibleLines} />
      </div>
      {footer}
      {expanded && children}
    </article>
  );
}

export function InvoiceLines({ lines, currency }: { lines: SeguimientoInvoiceLine[]; currency: Currency }) {
  if (lines.length === 0) return <div className="text-xs text-gray-400 py-1">Sin facturas en el mes.</div>;
  const byInvoice = new Map<string, SeguimientoInvoiceLine[]>();
  for (const l of lines) byInvoice.set(l.invoiceNumber, [...(byInvoice.get(l.invoiceNumber) ?? []), l]);
  return (
    <table className="min-w-full text-xs">
      <thead>
        <tr className="text-left text-gray-500">
          <th className="pr-3 py-1">Factura</th><th className="pr-3 py-1">Fecha</th><th className="pr-3 py-1">Producto</th>
          <th className="pr-3 py-1">Línea</th><th className="text-right pr-3 py-1">Cant.</th>
          <th className="text-right pr-3 py-1">Precio</th><th className="text-right py-1">Monto</th>
        </tr>
      </thead>
      <tbody>
        {[...byInvoice].map(([invoice, rows]) => (
          <Fragment key={invoice}>
            {rows.map((l, i) => (
              <tr key={`${invoice}-${l.lineNumber}`} className="text-gray-700">
                <td className="pr-3 py-0.5">{i === 0 ? invoice : ''}</td>
                <td className="pr-3 py-0.5">{i === 0 ? l.invoiceDate : ''}</td>
                <td className="pr-3 py-0.5">{l.productName}</td>
                <td className="pr-3 py-0.5">{l.lineName ?? '—'}</td>
                <td className="text-right pr-3 py-0.5">{num(l.quantity)}</td>
                <td className="text-right pr-3 py-0.5">{l.unitPrice ? priceLabel(l.unitPrice, currency) : '—'}</td>
                <td className="text-right py-0.5">{moneyLabel(l.amount, currency)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function CustomerList({
  customers, headers, visibleLines, currency, openCustomer, onOpenCustomer, linesFor,
}: {
  customers: SeguimientoCustomer[];
  headers: WeekHeader[];
  visibleLines: readonly string[];
  currency: Currency;
  openCustomer: string | null;
  onOpenCustomer: (code: string) => void;
  linesFor: (code: string) => { loading: boolean; error: string | null; lines: SeguimientoInvoiceLine[] };
}) {
  if (customers.length === 0) return <div className="text-xs text-gray-400 py-2">Sin clientes.</div>;
  return (
    <ul className="divide-y divide-gray-100 border-t border-gray-100">
      {customers.map(c => {
        const open = openCustomer === c.customerCode;
        const state = open ? linesFor(c.customerCode) : null;
        return (
          <li key={c.customerCode} className="py-2">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-xs">
              <button
                onClick={() => onOpenCustomer(c.customerCode)}
                aria-expanded={open}
                className="text-left text-blue-700 hover:underline md:col-span-2"
              >
                {c.customerName}
              </button>
              <WeekDots headers={headers} activeWeeks={c.activeWeeks} />
              <div className="text-gray-900 font-medium">{moneyLabel(c.sales, currency)}</div>
              <MixBar segments={c.mix} visibleLines={visibleLines} />
              <div className="flex items-center gap-1 flex-wrap">
                {c.isNew && <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-medium">Nuevo</span>}
                <VisitBadge visit={c.visit} />
              </div>
            </div>
            {open && (
              <section aria-label="Líneas de factura" className="mt-2 ml-2 overflow-x-auto">
                {state?.loading ? <div className="text-xs text-gray-400">Cargando…</div>
                  : state?.error ? <div className="text-xs text-red-600">{state.error}</div>
                  : <InvoiceLines lines={state?.lines ?? []} currency={currency} />}
              </section>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RootTable({
  roots, total, headers, currency, renderExpanded, expandedValue, onToggle,
}: {
  roots: SeguimientoRoot[];
  total: RootMetrics;
  headers: WeekHeader[];
  currency: Currency;
  renderExpanded: (root: SeguimientoRoot) => ReactNode;
  expandedValue: string | null;
  onToggle: (value: string) => void;
}) {
  const metricsRow = (label: ReactNode, m: RootMetrics, key: string) => (
    <tr key={key} className="border-t border-gray-100 text-gray-700">
      <td className="px-3 py-2 font-medium text-gray-900">{label}</td>
      <td className="px-3 py-2 text-right">{m.customerCount}</td>
      <td className="px-3 py-2 text-right">{moneyLabel(m.sales, currency)}</td>
      <td className="px-3 py-2 text-right">{m.salesQuotaUsd === null ? '—' : usdLabel(m.salesQuotaUsd)}</td>
      <td className="px-3 py-2 text-right">{pct(m.attainment)}</td>
      <td className="px-3 py-2 text-right">{m.projected ? moneyLabel(m.projected, currency) : '—'}</td>
      <td className="px-3 py-2 text-right">{units(m.units)}</td>
      <td className="px-3 py-2 text-right">{m.unitsQuota ? units(m.unitsQuota) : '—'}</td>
      <td className="px-3 py-2 text-right">{m.unitsQuota ? pct(m.unitsAttainment ?? null) : '—'}</td>
      <td className="px-3 py-2 text-right">{m.projectedUnits == null ? '—' : units(m.projectedUnits)}</td>
      <td className="px-3 py-2 text-right">{m.avgPrice ? priceLabel(m.avgPrice, currency) : '—'}</td>
      {m.weeks.map(w => <td key={w.yearWeek} className="px-3 py-2 text-right">{pct(w.pct)}</td>)}
      <td className="px-3 py-2 text-right">{m.newCustomers.count}{m.newCustomers.quota === null ? '' : ` / ${m.newCustomers.quota}`}</td>
      <td className="px-3 py-2 text-right">{overdueLabel(m)}</td>
    </tr>
  );
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-left">
            <th className="px-3 py-2">Raíz</th>
            <th className="px-3 py-2 text-right">Clientes</th>
            <th className="px-3 py-2 text-right">Ventas</th>
            <th className="px-3 py-2 text-right">Meta (USD)</th>
            <th className="px-3 py-2 text-right">Avance</th>
            <th className="px-3 py-2 text-right">Proyección</th>
            <th className="px-3 py-2 text-right">Unidades</th>
            <th className="px-3 py-2 text-right">Meta uds.</th>
            <th className="px-3 py-2 text-right">Avance uds.</th>
            <th className="px-3 py-2 text-right">Proy. uds.</th>
            <th className="px-3 py-2 text-right">Precio prom.</th>
            {headers.map(h => <th key={h.yearWeek} className="px-3 py-2 text-right">{h.label}</th>)}
            <th className="px-3 py-2 text-right">Nuevos</th>
            <th className="px-3 py-2 text-right">Visitas</th>
          </tr>
        </thead>
        <tbody>
          {metricsRow('Total', total, 'total')}
          {roots.map(r => (
            <Fragment key={r.value}>
              {metricsRow(
                <button onClick={() => onToggle(r.value)} aria-expanded={expandedValue === r.value} className="text-blue-700 hover:underline text-left">
                  {r.label}
                </button>,
                r, r.value,
              )}
              {expandedValue === r.value && (
                <tr><td colSpan={13 + headers.length} className="px-3 py-2 bg-gray-50">{renderExpanded(r)}</td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
