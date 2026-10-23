import type { CreditGateway, InvoiceChange, RestoreResult } from './erp';
import type { CreditPlan, PlannedCustomer } from './plan';

export interface DryRunReport {
  customers: PlannedCustomer[];
  invoiceChanges: InvoiceChange[];
}

export interface ApplyDeps {
  gateway: CreditGateway;
  log: (message: string) => void;
  newRunId: () => string;
}

export interface ApplyResult {
  runId: string;
  customersWritten: number;
  invoicesFixed: number;
  failures: string[];
}

/** Read-only: what applyPlan would change. */
export async function previewPlan(gateway: CreditGateway, plan: CreditPlan): Promise<DryRunReport> {
  const invoiceChanges: InvoiceChange[] = [];
  for (const c of plan.customers) {
    invoiceChanges.push(...await gateway.previewInvoiceChanges(c.coCli, c.diasCred));
  }
  return { customers: plan.customers, invoiceChanges };
}

/**
 * Customers are independent: a failure is recorded and the loop continues. Everything is idempotent,
 * so re-running after a failure resumes safely. Throws before any write when the plan has problems.
 */
export async function applyPlan(deps: ApplyDeps, plan: CreditPlan): Promise<ApplyResult> {
  if (plan.problems.length > 0) {
    throw new Error(`El plan tiene problemas:\n${plan.problems.join('\n')}`);
  }
  const { gateway, log } = deps;
  const result: ApplyResult = { runId: deps.newRunId(), customersWritten: 0, invoicesFixed: 0, failures: [] };
  for (const c of plan.customers) {
    try {
      if (c.needsCustomerWrite) {
        await gateway.setCustomerTerm(result.runId, c.coCli, c.coCond, c.diasCred);
        result.customersWritten++;
      }
      const fixed = await gateway.fixInvoices(result.runId, c.coCli);
      result.invoicesFixed += fixed.length;
      log(`${c.coCli} → ${c.diasCred} días: ${fixed.length} factura(s)`);
    } catch (err) {
      result.failures.push(`${c.coCli}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

/** Invoices first, then customers (the inverse of apply order). */
export async function rollbackRun(
  gateway: CreditGateway,
  runId: string,
): Promise<{ invoices: RestoreResult; customers: RestoreResult }> {
  const invoices = await gateway.restoreInvoices(runId);
  const customers = await gateway.restoreCustomers(runId);
  return { invoices, customers };
}
