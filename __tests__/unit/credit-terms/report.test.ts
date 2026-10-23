import { describe, test, expect } from 'bun:test';
import { invoiceDiffCsv, summarizeReport } from '../../../lib/credit-terms/report';
import type { DryRunReport } from '../../../lib/credit-terms/apply';

const report: DryRunReport = {
  customers: [
    { coCli: 'A', nombre: 'A', diasCred: 7, coCond: '000002', current: { condPag: '000001', plazPag: 7 }, needsCustomerWrite: true },
    { coCli: 'B', nombre: 'B', diasCred: 21, coCond: '000004', current: { condPag: '000004', plazPag: 21 }, needsCustomerWrite: false },
    { coCli: 'C', nombre: 'C', diasCred: 7, coCond: '000002', current: { condPag: '000001', plazPag: 0 }, needsCustomerWrite: true },
  ],
  invoiceChanges: [
    { nroDoc: 'F1', coCli: 'A', fecEmis: '2026-10-01', fecVencOld: '2026-10-01', fecVencNew: '2026-10-08', saldo: 100.5 },
    { nroDoc: 'F2', coCli: 'B', fecEmis: '2026-10-02', fecVencOld: '2026-10-02', fecVencNew: '2026-10-23', saldo: 50 },
  ],
};

describe('credit-terms report', () => {
  test('summary counts customers per term, writes, invoices and saldo', () => {
    expect(summarizeReport(report)).toEqual({
      customersByDays: { 7: 2, 21: 1 },
      customerWrites: 2,
      invoices: 2,
      saldo: 150.5,
    });
  });

  test('diff csv has BOM, header and one line per invoice', () => {
    const csv = invoiceDiffCsv(report.invoiceChanges);
    const lines = csv.slice(1).split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe('co_cli,nro_doc,fec_emis,fec_venc_old,fec_venc_new,saldo');
    expect(lines[1]).toBe('A,F1,2026-10-01,2026-10-01,2026-10-08,100.5');
    expect(lines.length).toBe(3);
  });
});
