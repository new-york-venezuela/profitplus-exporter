import { customerKindInYear, type CustomerKind } from '@/lib/dwh/cutover';
import {
  summarizeCompliance, visitCompliance, type ComplianceSummary, type VisitCompliance,
} from '@/lib/seguimiento/visit-compliance';

// Pure pieces of the Clientes "cartera" additions (visit compliance, patrimonio/nuevo). No server imports:
// the cobertura route and the client component share this file.
export function dateKeyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function enrichCartera(input: {
  lastSaleDateKey: number | null;
  visitIntervalDays: number | null;
  registeredDate: string | null;
  todayKey: number;
  kindYear: number;
}): { visit: VisitCompliance; kind: CustomerKind | null } {
  const visit = visitCompliance({
    lastInvoiceDate: input.lastSaleDateKey === null ? null : dateKeyToIso(input.lastSaleDateKey),
    intervalDays: input.visitIntervalDays,
    asOf: dateKeyToIso(input.todayKey),
  });
  const kind = input.registeredDate && ISO.test(input.registeredDate)
    ? customerKindInYear(input.registeredDate, input.kindYear)
    : null;
  return { visit, kind };
}

export const KIND_LABEL: Record<CustomerKind, string> = {
  patrimonio: 'Patrimonio',
  nuevo: 'Nuevo',
  posterior: 'Posterior',
};

export function visitLabel(v: VisitCompliance): string {
  switch (v.status) {
    case 'no_interval': return 'Sin frecuencia';
    case 'no_invoice': return 'Sin facturas';
    case 'overdue': return `Vencida +${v.daysOverdue} d`;
    case 'ok': return `Al día (${v.daysSinceLastInvoice} de ${v.intervalDays} d)`;
  }
}

export interface CarteraSummary {
  compliance: ComplianceSummary;
  inactiveInPeriod: number;
  nuevos: number;
  patrimonio: number;
}

export function summarizeCartera(
  rows: readonly { visit: VisitCompliance; kind: CustomerKind | null; activeInPeriod: boolean }[],
): CarteraSummary {
  return {
    compliance: summarizeCompliance(rows.map(r => r.visit)),
    inactiveInPeriod: rows.filter(r => !r.activeInPeriod).length,
    nuevos: rows.filter(r => r.kind === 'nuevo').length,
    patrimonio: rows.filter(r => r.kind === 'patrimonio').length,
  };
}
