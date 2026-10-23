import { describe, test, expect } from 'bun:test';
import { buildCreditPlan } from '../../../lib/credit-terms/plan';
import type { CreditTermRow, ErpCreditCustomer } from '../../../lib/credit-terms/types';

const row = (o: Partial<CreditTermRow> & { coCli: string }): CreditTermRow =>
  ({ nombre: 'X', diasCred: 7, source: 'exact', note: '', ...o });
const erp = (...cs: Partial<ErpCreditCustomer>[]) =>
  new Map(cs.map(c => [c.coCli!, { condPag: '000001', plazPag: 7, inactivo: false, ...c } as ErpCreditCustomer]));

describe('buildCreditPlan', () => {
  test('Contado customer going to 7 days needs a customer write with co_cond 000002', () => {
    const plan = buildCreditPlan([row({ coCli: 'J1' })], erp({ coCli: 'J1' }));
    expect(plan.problems).toEqual([]);
    expect(plan.customers).toEqual([{
      coCli: 'J1', nombre: 'X', diasCred: 7, coCond: '000002',
      current: { condPag: '000001', plazPag: 7 }, needsCustomerWrite: true,
    }]);
  });

  test('customer already on the right term is listed without a customer write', () => {
    const plan = buildCreditPlan([row({ coCli: 'J1' })], erp({ coCli: 'J1', condPag: '000002', plazPag: 7 }));
    expect(plan.customers[0].needsCustomerWrite).toBe(false);
  });

  test('a matching cond_pag with a different plaz_pag still needs a write', () => {
    const plan = buildCreditPlan([row({ coCli: 'J1' })], erp({ coCli: 'J1', condPag: '000002', plazPag: 0 }));
    expect(plan.customers[0].needsCustomerWrite).toBe(true);
  });

  test('21 days maps to 000004', () => {
    const plan = buildCreditPlan([row({ coCli: 'J1', diasCred: 21 })], erp({ coCli: 'J1' }));
    expect(plan.customers[0].coCond).toBe('000004');
  });

  test('skip rows are never planned, even for Contado customers', () => {
    const skip = row({ coCli: 'J1', diasCred: null, source: 'skip' });
    const plan = buildCreditPlan([skip], erp({ coCli: 'J1' }));
    expect(plan.customers).toEqual([]);
    expect(plan.skipped).toEqual([skip]);
    expect(plan.problems).toEqual([]);
  });

  test('review rows are a problem', () => {
    const plan = buildCreditPlan([row({ coCli: 'J1', diasCred: null, source: 'review' })], erp({ coCli: 'J1' }));
    expect(plan.problems).toEqual(['J1: fila en revisión']);
  });

  test('customer missing from the ERP is a problem', () => {
    const plan = buildCreditPlan([row({ coCli: 'J9' })], erp({ coCli: 'J1' }));
    expect(plan.problems).toEqual(['J9: no existe en el ERP']);
  });

  test('inactive customer is a problem', () => {
    const plan = buildCreditPlan([row({ coCli: 'J1' })], erp({ coCli: 'J1', inactivo: true }));
    expect(plan.problems).toEqual(['J1: cliente inactivo']);
  });

  test('stray spaces on CSV codes are trimmed before lookup', () => {
    const plan = buildCreditPlan([row({ coCli: ' J1 ' })], erp({ coCli: 'J1' }));
    expect(plan.problems).toEqual([]);
    expect(plan.customers[0].coCli).toBe('J1');
  });
});
