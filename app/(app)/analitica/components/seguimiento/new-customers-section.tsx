import { frequencyLabel } from '@/lib/seguimiento/unbilled';
import type { SeguimientoCustomer } from '@/lib/seguimiento/types';
import type { Currency } from '../../types';
import { moneyLabel } from '../../lib/format';
import { units } from './fmt';

// New = registered inside the month and not part of the migration batch (same rule as the "Nuevos clientes" card,
// carried by SeguimientoCustomer.isNew), so this list always adds up to the card's count.
export function NewCustomersTable({ customers, currency, monthLabel }: {
  customers: SeguimientoCustomer[]; currency: Currency; monthLabel: string;
}) {
  const rows = customers.filter(c => c.isNew).sort((a, b) => (a.registeredDate ?? '').localeCompare(b.registeredDate ?? ''));
  if (rows.length === 0) return <div className="text-sm text-gray-400 py-2">Sin clientes nuevos en {monthLabel}.</div>;
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-gray-500 text-left">
          <th className="pr-4 py-1">Cliente</th>
          <th className="pr-4 py-1">Registro</th>
          <th className="pr-4 py-1">Ruta</th>
          <th className="pr-4 py-1">Frecuencia</th>
          <th className="text-right pr-4 py-1">Ventas</th>
          <th className="text-right pr-4 py-1">Unidades</th>
          <th className="py-1">Última factura</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(c => (
          <tr key={c.customerCode} className="break-inside-avoid">
            <td className="pr-4 py-1">{c.customerName}</td>
            <td className="pr-4 py-1">{c.registeredDate ?? '—'}</td>
            <td className="pr-4 py-1">{c.routeLabel ?? '—'}</td>
            <td className="pr-4 py-1">{frequencyLabel(c.visit.intervalDays)}</td>
            <td className="text-right pr-4 py-1">{moneyLabel(c.sales, currency)}</td>
            <td className="text-right pr-4 py-1">{units(c.units)}</td>
            <td className="py-1">{c.lastInvoiceDate ?? 'Sin compras'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
