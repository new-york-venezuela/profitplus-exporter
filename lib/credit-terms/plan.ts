import { CO_COND_BY_DAYS, type CreditDays, type CreditTermRow, type ErpCreditCustomer } from './types';

export interface PlannedCustomer {
  coCli: string;
  nombre: string;
  diasCred: CreditDays;
  coCond: string;
  current: { condPag: string; plazPag: number };
  needsCustomerWrite: boolean;
}

export interface CreditPlan {
  customers: PlannedCustomer[];
  skipped: CreditTermRow[];
  problems: string[];
}

/** Pure: decides what to write for each CSV row. Problems are collected, never thrown. */
export function buildCreditPlan(rows: CreditTermRow[], erp: Map<string, ErpCreditCustomer>): CreditPlan {
  const plan: CreditPlan = { customers: [], skipped: [], problems: [] };
  for (const row of rows) {
    const coCli = row.coCli.trim();
    if (row.source === 'skip') { plan.skipped.push(row); continue; }
    if (row.source === 'review' || row.diasCred === null) {
      plan.problems.push(`${coCli}: fila en revisión`); continue;
    }
    const customer = erp.get(coCli);
    if (!customer) { plan.problems.push(`${coCli}: no existe en el ERP`); continue; }
    if (customer.inactivo) { plan.problems.push(`${coCli}: cliente inactivo`); continue; }
    const coCond = CO_COND_BY_DAYS[row.diasCred];
    plan.customers.push({
      coCli, nombre: row.nombre, diasCred: row.diasCred, coCond,
      current: { condPag: customer.condPag, plazPag: customer.plazPag },
      needsCustomerWrite: customer.condPag !== coCond || customer.plazPag !== row.diasCred,
    });
  }
  return plan;
}
