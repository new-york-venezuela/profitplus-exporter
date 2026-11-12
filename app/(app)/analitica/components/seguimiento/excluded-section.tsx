'use client';

import type { SeguimientoExcludedInvoice, SeguimientoRoot } from '@/lib/seguimiento/types';
import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';

export interface ExcludedState { loading: boolean; error: string | null; invoices: SeguimientoExcludedInvoice[] }

// Consignment-pattern invoices (chain-level, several sellers): listed apart, never added to a seller's figures.
export function ExcludedSection({ roots, currency, openFor, state, onToggle }: {
  roots: SeguimientoRoot[];
  currency: Currency;
  openFor: string | null;
  state: ExcludedState;
  onToggle: (root: SeguimientoRoot) => void;
}) {
  if (roots.length === 0) return null;
  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-1">Facturas excluidas — patrón de consignación</h3>
      <p className="text-xs text-gray-500 mb-3">
        Facturas emitidas de forma agregada a nivel de cadena (no por tienda): no es posible atribuir de forma confiable qué
        vendedor generó la venta. No se suman a las ventas por vendedor, la meta ni la activación de arriba en vez de estimarse.
      </p>
      <ul className="space-y-2">
        {roots.map(root => (
          <li key={root.value} className="text-sm">
            <button onClick={() => onToggle(root)} aria-expanded={openFor === root.value} className="text-amber-700 hover:text-amber-900 underline">
              {root.label}: {moneyLabel(root.excludedSales, currency)} excluidos
            </button>
            {openFor === root.value && (
              <div className="mt-2 ml-4 text-xs">
                {state.loading ? <div className="text-gray-400 py-1">Cargando…</div>
                  : state.error ? <div className="text-red-600 py-1">{state.error}</div>
                  : state.invoices.length === 0 ? <div className="text-gray-400 py-1">Sin facturas.</div>
                  : (
                    <table className="min-w-full">
                      <thead><tr className="text-gray-500"><th className="text-left pr-4 py-1">Cliente</th><th className="text-left pr-4 py-1">Factura</th><th className="text-left pr-4 py-1">Fecha</th><th className="text-right py-1">Monto</th></tr></thead>
                      <tbody>
                        {state.invoices.map(inv => (
                          <tr key={inv.invoiceNumber} className="text-gray-700">
                            <td className="pr-4 py-1">{inv.customerName}</td><td className="pr-4 py-1">{inv.invoiceNumber}</td>
                            <td className="pr-4 py-1">{inv.invoiceDate}</td><td className="text-right py-1">{moneyLabel(inv.amountNet, currency)}</td>
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
  );
}
