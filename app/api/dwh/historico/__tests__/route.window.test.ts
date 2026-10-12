import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

const queries: string[] = [];
let respond: (text: string) => unknown[] = () => [];
function makeRequest() {
  const req = {
    input() { return req; },
    async query(text: string) { queries.push(text); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

beforeEach(() => {
  queries.length = 0;
  // Only the two ungrouped KPI queries need a row; every grouped query (monthly, cliente, linea, breakdown) may be empty.
  respond = text => (text.includes('ActiveClients')
    ? [{ SalesGrossBs: 0, SalesGrossUsd: 0, UnitsSold: 0, ActiveClients: 0, InvoiceCount: 0 }]
    : text.includes('AS ReturnsBs') && !text.includes('GROUP BY') ? [{ ReturnsBs: 0, ReturnsUsd: 0 }] : []);
});

async function everyLegacyQueryIsWindowed(qs: string) {
  const res = await GET(new NextRequest(`http://localhost/api/dwh/historico?${qs}`));
  expect(res.status).toBe(200);
  const legacy = queries.filter(q => q.includes('_Legacy'));
  expect(legacy.length).toBeGreaterThan(0);
  for (const q of legacy) {
    expect(q).toContain('20250101 AND 20251231');
    expect(q).not.toContain('20260228');
  }
  return legacy;
}

describe('GET /api/dwh/historico window', () => {
  test('monthly view windows sales and the correlated returns subqueries to 2025', async () => {
    const legacy = await everyLegacyQueryIsWindowed('groupBy=mes');
    expect(legacy[0]).toContain('fsl.DateKey BETWEEN 20250101 AND 20251231');
    expect(legacy[0]).toContain('frl.OriginalInvoiceDateKey BETWEEN 20250101 AND 20251231');
  });
  test('kpis window sales and returns to 2025', async () => {
    const legacy = await everyLegacyQueryIsWindowed('section=kpis');
    expect(legacy).toHaveLength(2);
  });
  test('linea, cliente (with month) and the producto breakdown stay inside 2025', async () => {
    await everyLegacyQueryIsWindowed('groupBy=linea');
    queries.length = 0;
    await everyLegacyQueryIsWindowed('groupBy=cliente&month=2025-06');
    queries.length = 0;
    await everyLegacyQueryIsWindowed('groupBy=linea&breakdownBy=producto&parentValue=L1');
  });
});
