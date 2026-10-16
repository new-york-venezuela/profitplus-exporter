import { frequencyLabel } from '@/lib/seguimiento/unbilled';
import type { SeguimientoCustomer, WeekHeader } from '@/lib/seguimiento/types';
import type { VisitCompliance } from '@/lib/seguimiento/visit-compliance';
import { moneyLabel } from '../../lib/format';
import { units } from './fmt';
import type { Currency } from '../../types';

function visitText(v: VisitCompliance): string {
  switch (v.status) {
    case 'overdue': return `Vencida +${v.daysOverdue} d`;
    case 'ok': return 'Al día';
    case 'no_invoice': return 'Sin compras';
    default: return 'Sin frecuencia';
  }
}

// Print-only twin of CustomerList: the card list wastes paper, a table fits ~40 customers per page.
export function CustomersPrintTable({ customers, headers, currency }: {
  customers: SeguimientoCustomer[]; headers: WeekHeader[]; currency: Currency;
}) {
  if (customers.length === 0) return null;
  const pastWeeks = headers.filter(h => !h.isFuture);
  const pastKeys = new Set(pastWeeks.map(h => h.yearWeek));
  return (
    <table aria-label="Clientes (impresión)" className="hidden print:table w-full text-[10pt] border-collapse">
      <thead>
        <tr className="text-left border-b border-gray-800">
          <th className="py-1 pr-2 w-8">#</th>
          <th className="py-1 pr-2">Cliente</th>
          <th className="py-1 pr-2">Ruta</th>
          <th className="py-1 pr-2">Frecuencia</th>
          <th className="py-1 pr-2 text-right">Ventas</th>
          <th className="py-1 pr-2 text-right">Unid.</th>
          <th className="py-1 pr-2 text-right">Sem. activas</th>
          <th className="py-1 pr-2">Última factura</th>
          <th className="py-1">Visita</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c, i) => (
          <tr key={c.customerCode} className="border-b border-gray-300 break-inside-avoid">
            <td className="py-1 pr-2">{i + 1}</td>
            <td className="py-1 pr-2">{c.customerName}{c.isNew ? ' (nuevo)' : ''}</td>
            <td className="py-1 pr-2">{c.routeLabel ?? '—'}</td>
            <td className="py-1 pr-2">{frequencyLabel(c.visit.intervalDays)}</td>
            <td className="py-1 pr-2 text-right">{moneyLabel(c.sales, currency)}</td>
            <td className="py-1 pr-2 text-right">{units(c.units)}</td>
            <td className="py-1 pr-2 text-right">{c.activeWeeks.filter(w => pastKeys.has(w)).length}/{pastWeeks.length}</td>
            <td className="py-1 pr-2">{c.lastInvoiceDate ?? 'Nunca'}</td>
            <td className={`py-1 ${c.visit.status === 'overdue' ? 'font-semibold' : ''}`}>{visitText(c.visit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
