import { daysBetween } from './iso-date';

// Overdue visits (spec, section A): a customer is overdue when days since its last invoice exceed
// Dim_Customer.VisitIntervalDays. Computed in code/queries, never stored. A NULL interval (no
// frequency assigned yet) must NEVER be read as 0 days, so it can never be overdue.
export type VisitStatus = 'ok' | 'overdue' | 'no_interval' | 'no_invoice';

export interface VisitCompliance {
  status: VisitStatus;
  daysSinceLastInvoice: number | null;
  intervalDays: number | null;
  daysOverdue: number | null;
}

export function visitCompliance(input: {
  lastInvoiceDate: string | null;
  intervalDays: number | null | undefined;
  asOf: string;
}): VisitCompliance {
  const interval = typeof input.intervalDays === 'number' && input.intervalDays > 0 ? input.intervalDays : null;
  const days = input.lastInvoiceDate ? Math.max(0, daysBetween(input.lastInvoiceDate, input.asOf)) : null;
  if (interval === null) {
    return { status: 'no_interval', daysSinceLastInvoice: days, intervalDays: null, daysOverdue: null };
  }
  if (days === null) {
    return { status: 'no_invoice', daysSinceLastInvoice: null, intervalDays: interval, daysOverdue: null };
  }
  return days > interval
    ? { status: 'overdue', daysSinceLastInvoice: days, intervalDays: interval, daysOverdue: days - interval }
    : { status: 'ok', daysSinceLastInvoice: days, intervalDays: interval, daysOverdue: 0 };
}

export interface ComplianceSummary {
  total: number;
  ok: number;
  overdue: number;
  noInterval: number;
  noInvoice: number;
  complianceRate: number | null;
}

export function summarizeCompliance(items: readonly VisitCompliance[]): ComplianceSummary {
  const count = (s: VisitStatus) => items.filter(i => i.status === s).length;
  const ok = count('ok');
  const overdue = count('overdue');
  return {
    total: items.length, ok, overdue,
    noInterval: count('no_interval'), noInvoice: count('no_invoice'),
    complianceRate: ok + overdue > 0 ? ok / (ok + overdue) : null,
  };
}
