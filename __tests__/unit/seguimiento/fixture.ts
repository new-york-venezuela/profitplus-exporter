import { buildSeguimiento, type CustomerFact, type CustomerLineSales, type CustomerWeekActivity, type SeguimientoInput } from '../../../lib/seguimiento/aggregate';
import { monthBounds } from '../../../lib/seguimiento/month-pace';
import type { RootKind, SeguimientoInvoiceLine, SeguimientoResponse } from '../../../lib/seguimiento/types';
import type { SellerTargets } from '../../../lib/seguimiento/quotas';

export const FIXTURE_MONTH = '2026-10';
export const FIXTURE_AS_OF = '2026-10-14'; // Wednesday: 10 of 22 working days elapsed

const cust = (o: Partial<CustomerFact> & Pick<CustomerFact, 'customerCode' | 'customerName'>): CustomerFact => ({
  isInactive: false, salesRepKey: null, salesRepName: null, zoneCode: null, routeNumber: null,
  segmentCode: null, segmentName: null, registeredDate: '2020-05-10', isMigrationBatch: false,
  visitIntervalDays: null, lastInvoiceDate: null, ...o,
});

export const FIXTURE_CUSTOMERS: CustomerFact[] = [
  cust({ customerCode: 'C1', customerName: 'Cliente Uno', salesRepKey: '1', salesRepName: 'Ana', zoneCode: 'CCS003', routeNumber: 3,
    segmentCode: 'S1', segmentName: 'Abasto', registeredDate: '2026-10-02', visitIntervalDays: 7, lastInvoiceDate: '2026-10-12' }),
  cust({ customerCode: 'C2', customerName: 'Cliente Dos', salesRepKey: '1', salesRepName: 'Ana', zoneCode: 'CCS003', routeNumber: 3,
    segmentCode: 'S1', segmentName: 'Abasto', registeredDate: '2026-03-28', isMigrationBatch: true, visitIntervalDays: 7, lastInvoiceDate: '2026-09-20' }),
  cust({ customerCode: 'C3', customerName: 'Cliente Tres', salesRepKey: '2', salesRepName: 'Beto', zoneCode: 'CCS004', routeNumber: 4,
    segmentCode: 'S2', segmentName: 'Restaurante' }),
  cust({ customerCode: 'C4', customerName: 'Cadena Raiz', salesRepKey: '2', salesRepName: 'Beto', zoneCode: 'CCS004', routeNumber: 4,
    segmentCode: 'S2', segmentName: 'Restaurante' }),                                  // consignment root code
  cust({ customerCode: 'C5', customerName: 'Cliente Inactivo', isInactive: true, salesRepKey: '2', salesRepName: 'Beto',
    zoneCode: 'CCS004', routeNumber: 4, segmentCode: 'S2', segmentName: 'Restaurante' }),
];

const sale = (customerCode: string, line: string | null, units: number, bs: number, usd: number | null): CustomerLineSales =>
  ({ customerCode, line, units, sales: { bs, usd } });

export const FIXTURE_LINE_SALES: CustomerLineSales[] = [
  sale('C1', 'Panaderia', 10, 1000, 20), sale('C1', 'Pizza', 5, 500, 10),
  sale('C2', 'Panaderia', 20, 2000, 40),
  sale('C3', 'Pasteleria', 4, 400, 8),
  sale('C4', 'Panaderia', 100, 9000, 180),
];

export const FIXTURE_WEEK_ACTIVITY: CustomerWeekActivity[] = [
  { customerCode: 'C1', yearWeek: '2026-W41' }, { customerCode: 'C1', yearWeek: '2026-W42' },
  { customerCode: 'C2', yearWeek: '2026-W41' }, { customerCode: 'C4', yearWeek: '2026-W41' },
];

export const FIXTURE_TARGETS = new Map<string, SellerTargets>([
  ['1', { salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1 }],
  ['2', { salesQuotaUsd: 50, weeklyVisitQuota: null, newCustomerQuota: null }],
]);

export const FIXTURE_CONSIGNMENT_ROOTS = ['C4'];

export function fixtureInput(kind: RootKind): SeguimientoInput {
  return {
    kind, month: FIXTURE_MONTH, asOf: FIXTURE_AS_OF,
    customers: FIXTURE_CUSTOMERS, lineSales: FIXTURE_LINE_SALES, weekActivity: FIXTURE_WEEK_ACTIVITY,
    consignmentRootCodes: FIXTURE_CONSIGNMENT_ROOTS, targets: FIXTURE_TARGETS,
  };
}

export function fixtureResponse(kind: RootKind): SeguimientoResponse {
  const { start, end } = monthBounds(FIXTURE_MONTH);
  return { kind, month: FIXTURE_MONTH, monthStart: start, monthEnd: end, asOf: FIXTURE_AS_OF, ...buildSeguimiento(fixtureInput(kind)) };
}

export const FIXTURE_INVOICE_LINES: SeguimientoInvoiceLine[] = [
  { invoiceNumber: 'F000101', invoiceDate: '2026-10-13', lineNumber: 1, productCode: 'P-PIZ', productName: 'Pizza Familiar', lineName: 'Pizza',
    quantity: 5, amount: { bs: 500, usd: 10 }, unitPrice: { bs: 100, usd: 2 } },
  { invoiceNumber: 'F000100', invoiceDate: '2026-10-05', lineNumber: 1, productCode: 'P-PAN', productName: 'Pan Baguette', lineName: 'Panaderia',
    quantity: 10, amount: { bs: 1000, usd: 20 }, unitPrice: { bs: 100, usd: 2 } },
];
