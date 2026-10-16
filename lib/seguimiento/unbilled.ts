import type { SeguimientoCustomer } from './types';

// "Clientes sin facturar": customers whose latest visit period (VisitIntervalDays, counted back from asOf)
// has no invoice. Same rule as the Visitas vencidas KPI (visitCompliance), so counts always match.
// A customer with a frequency that never bought ('no_invoice') is listed last; one with no frequency
// ('no_interval') can never be overdue and is only counted.
export interface UnbilledSummary {
  rows: SeguimientoCustomer[];
  withFrequency: number;
  skippedNoFrequency: number;
}

export function selectUnbilled(customers: readonly SeguimientoCustomer[]): UnbilledSummary {
  const rows = customers
    .filter(c => c.visit.status === 'overdue' || c.visit.status === 'no_invoice')
    .sort((a, b) => {
      const ao = a.visit.status === 'overdue' ? a.visit.daysOverdue ?? 0 : -1;
      const bo = b.visit.status === 'overdue' ? b.visit.daysOverdue ?? 0 : -1;
      return bo - ao || a.customerName.localeCompare(b.customerName, 'es');
    });
  const skippedNoFrequency = customers.filter(c => c.visit.status === 'no_interval').length;
  return { rows, withFrequency: customers.length - skippedNoFrequency, skippedNoFrequency };
}

export function frequencyLabel(intervalDays: number | null): string {
  if (intervalDays === 7) return 'Semanal';
  if (intervalDays === 15) return 'Quincenal';
  if (intervalDays === 30) return 'Mensual';
  return intervalDays === null ? 'Sin frecuencia' : `Cada ${intervalDays} d`;
}
