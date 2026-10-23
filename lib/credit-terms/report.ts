import { buildCsv } from '@/lib/csv';
import type { DryRunReport } from './apply';
import type { InvoiceChange } from './erp';

export interface ReportSummary {
  customersByDays: Record<number, number>;
  customerWrites: number;
  invoices: number;
  saldo: number;
}

export function summarizeReport(report: DryRunReport): ReportSummary {
  const customersByDays: Record<number, number> = {};
  for (const c of report.customers) customersByDays[c.diasCred] = (customersByDays[c.diasCred] ?? 0) + 1;
  return {
    customersByDays,
    customerWrites: report.customers.filter(c => c.needsCustomerWrite).length,
    invoices: report.invoiceChanges.length,
    saldo: Math.round(report.invoiceChanges.reduce((s, i) => s + i.saldo, 0) * 100) / 100,
  };
}

const col = (key: string, i: number) => ({ key, label: key, defaultVisible: true, defaultOrder: i });
const DIFF_COLUMNS = ['co_cli', 'nro_doc', 'fec_emis', 'fec_venc_old', 'fec_venc_new', 'saldo'].map(col);

export function invoiceDiffCsv(changes: InvoiceChange[]): string {
  return buildCsv(DIFF_COLUMNS, changes.map(c => ({
    co_cli: c.coCli, nro_doc: c.nroDoc, fec_emis: c.fecEmis,
    fec_venc_old: c.fecVencOld, fec_venc_new: c.fecVencNew, saldo: c.saldo,
  })));
}
