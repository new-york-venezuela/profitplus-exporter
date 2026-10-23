import { describe, test, expect } from 'bun:test';
import { applyPlan, previewPlan, rollbackRun } from '../../../lib/credit-terms/apply';
import type { CreditGateway, InvoiceChange } from '../../../lib/credit-terms/erp';
import type { CreditPlan, PlannedCustomer } from '../../../lib/credit-terms/plan';

const planned = (coCli: string, needsCustomerWrite: boolean): PlannedCustomer => ({
  coCli, nombre: coCli, diasCred: 7, coCond: '000002',
  current: { condPag: needsCustomerWrite ? '000001' : '000002', plazPag: 7 }, needsCustomerWrite,
});
const planOf = (customers: PlannedCustomer[], problems: string[] = []): CreditPlan =>
  ({ customers, skipped: [], problems });
const change = (nroDoc: string, coCli: string): InvoiceChange =>
  ({ nroDoc, coCli, fecEmis: '2026-10-01', fecVencOld: '2026-10-01', fecVencNew: '2026-10-08', saldo: 10 });

function fakeGateway(opts: { failFix?: string } = {}) {
  const calls: string[] = [];
  const fixed = new Set<string>();
  const gw: CreditGateway = {
    async listCustomers() { return new Map(); },
    async previewInvoiceChanges(coCli) { return fixed.has(coCli) ? [] : [change(`${coCli}-1`, coCli)]; },
    async setCustomerTerm(_run, coCli) { calls.push(`set:${coCli}`); },
    async fixInvoices(_run, coCli) {
      if (coCli === opts.failFix) throw new Error('boom');
      calls.push(`fix:${coCli}`);
      if (fixed.has(coCli)) return [];
      fixed.add(coCli);
      return [change(`${coCli}-1`, coCli)];
    },
    async restoreInvoices() { calls.push('restoreInvoices'); return { restored: 1, skipped: [] }; },
    async restoreCustomers() { calls.push('restoreCustomers'); return { restored: 1, skipped: [] }; },
  };
  return { gw, calls };
}
const deps = (gw: CreditGateway) => ({ gateway: gw, log: () => {}, newRunId: () => 'run-1' });

describe('applyPlan', () => {
  test('refuses a plan with problems before any write', async () => {
    const { gw, calls } = fakeGateway();
    await expect(applyPlan(deps(gw), planOf([planned('A', true)], ['A: cliente inactivo']))).rejects.toThrow('cliente inactivo');
    expect(calls).toEqual([]);
  });

  test('skips the customer write when the term is already right but still fixes invoices', async () => {
    const { gw, calls } = fakeGateway();
    const r = await applyPlan(deps(gw), planOf([planned('A', false), planned('B', true)]));
    expect(calls).toEqual(['fix:A', 'set:B', 'fix:B']);
    expect(r).toEqual({ runId: 'run-1', customersWritten: 1, invoicesFixed: 2, failures: [] });
  });

  test('one failing customer is reported and the rest are applied', async () => {
    const { gw, calls } = fakeGateway({ failFix: 'A' });
    const r = await applyPlan(deps(gw), planOf([planned('A', true), planned('B', true)]));
    expect(calls).toEqual(['set:A', 'set:B', 'fix:B']);
    expect(r.failures).toEqual(['A: boom']);
    expect(r.customersWritten).toBe(2);
    expect(r.invoicesFixed).toBe(1);
  });

  test('running the same plan again writes nothing new', async () => {
    const { gw } = fakeGateway();
    const plan = planOf([planned('A', false)]);
    await applyPlan(deps(gw), plan);
    const again = await applyPlan(deps(gw), plan);
    expect(again.customersWritten).toBe(0);
    expect(again.invoicesFixed).toBe(0);
  });
});

describe('previewPlan', () => {
  test('collects invoice changes and performs no writes', async () => {
    const { gw, calls } = fakeGateway();
    const report = await previewPlan(gw, planOf([planned('A', true), planned('B', false)]));
    expect(report.invoiceChanges.map(c => c.nroDoc)).toEqual(['A-1', 'B-1']);
    expect(report.customers.length).toBe(2);
    expect(calls).toEqual([]);
  });
});

describe('rollbackRun', () => {
  test('restores invoices before customers', async () => {
    const { gw, calls } = fakeGateway();
    const r = await rollbackRun(gw, 'run-1');
    expect(calls).toEqual(['restoreInvoices', 'restoreCustomers']);
    expect(r.invoices.restored).toBe(1);
    expect(r.customers.restored).toBe(1);
  });
});
