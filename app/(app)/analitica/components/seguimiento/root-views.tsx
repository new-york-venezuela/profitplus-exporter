'use client';

import { Fragment } from 'react';
import type { RootMetrics, SeguimientoCustomer, SeguimientoInvoiceLine, WeekHeader } from '@/lib/seguimiento/types';
import { moneyLabel, priceLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { num } from './fmt';
import { MixBar, VisitBadge, WeekDots } from './visuals';

export function overdueLabel(m: RootMetrics): string {
  const c = m.compliance;
  if (c.ok + c.overdue === 0) return c.noInterval > 0 ? 'Sin frecuencia' : '—';
  return `${c.overdue} vencida${c.overdue === 1 ? '' : 's'} de ${c.ok + c.overdue}`;
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
