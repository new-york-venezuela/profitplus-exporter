import { describe, test, expect } from 'bun:test';
import { getPool } from '@/lib/db/mssql';
import {
  fetchOpenDocs, fetchUsdRates, fetchCompanyName, fetchCustomerHeader, listCustomersWithOpenDocs,
} from '@/lib/statements/repo';

describe('Statements repo (read-only ERP)', () => {
  test('rates, company, and open docs for a customer', async () => {
    const pool = await getPool();
    const rates = await fetchUsdRates(pool);
    expect(rates.length).toBeGreaterThan(0);
    expect(rates.every(r => r.tasaV > 0)).toBe(true);

    // emp_nom is NULL in the local ERP copy, so only assert the type
    expect(typeof (await fetchCompanyName(pool))).toBe('string');

    const candidates = await listCustomersWithOpenDocs(pool);
    expect(candidates.length).toBeGreaterThan(0);
    const docs = await fetchOpenDocs(pool, candidates[0]);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every(d => d.saldoBsd !== 0 && d.coTipoDoc === d.coTipoDoc.trim())).toBe(true);
    expect(await fetchCustomerHeader(pool, candidates[0])).not.toBeNull();
  });
});
