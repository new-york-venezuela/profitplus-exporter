import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];

function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const DAY = 86_400_000;
const keyOf = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
const daysAgoKey = (n: number) => keyOf(new Date(Date.now() - n * DAY));

const customerRow = (over: Record<string, unknown>) => ({
  CustomerCode: 'C', CustomerName: 'Cliente', LegalEntityName: null, SellerCode: 'V1', SellerName: 'Ana',
  LastDateKey: null, EntityLastDateKey: null, GroupCode: 'S1', GroupName: 'Abasto', RouteNumber: 3,
  RegisteredDate: new Date('2026-03-28T00:00:00Z'), VisitIntervalDays: 7, InPeriod: 1, ...over,
});

beforeEach(() => {
  queries.length = 0;
  respond = text => (text.includes('PeriodSales') ? [
    customerRow({ CustomerCode: 'C1', CustomerName: 'Uno', LastDateKey: daysAgoKey(20), InPeriod: 0 }),
    customerRow({ CustomerCode: 'C2', CustomerName: 'Dos', LastDateKey: daysAgoKey(3), VisitIntervalDays: null, RegisteredDate: new Date('2026-05-10T00:00:00Z'), GroupCode: 'S2', GroupName: 'Restaurante', RouteNumber: 4 }),
    customerRow({ CustomerCode: 'C3', CustomerName: 'Tres', VisitIntervalDays: 30, RegisteredDate: null, GroupCode: null, GroupName: null, RouteNumber: null }),
  ] : []);
});

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes/cobertura?${qs}`));

describe('GET /api/dwh/clientes/cobertura', () => {
  test('maps route, group, kind, visit compliance and period activity per current customer', async () => {
    const res = await get('includeInactive=0&dateRange=month:2026-10');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kindYear).toBe(2026);
    const by = Object.fromEntries(body.rows.map((r: { customerCode: string }) => [r.customerCode, r]));
    expect(by.C1).toMatchObject({ routeNumber: 3, groupCode: 'S1', groupName: 'Abasto', kind: 'patrimonio', activeInPeriod: false });
    expect(by.C1.visit).toMatchObject({ status: 'overdue', intervalDays: 7, daysSinceLastInvoice: 20, daysOverdue: 13 });
    expect(by.C2).toMatchObject({ routeNumber: 4, groupCode: 'S2', kind: 'nuevo', activeInPeriod: true });
    expect(by.C2.visit).toMatchObject({ status: 'no_interval', daysOverdue: null });   // no frequency: never overdue
    expect(by.C3).toMatchObject({ routeNumber: null, groupCode: null, groupName: null, kind: null });
    expect(by.C3.visit.status).toBe('no_invoice');
  });

  test('a customer registered after the range end is not "sin compras en el período" (activeInPeriod null)', async () => {
    respond = text => (text.includes('PeriodSales') ? [
      customerRow({ CustomerCode: 'OLD', InPeriod: 0, RegisteredDate: new Date('2026-10-31T00:00:00Z') }),
      customerRow({ CustomerCode: 'LATE', InPeriod: 0, RegisteredDate: new Date('2026-11-02T00:00:00Z') }),
      customerRow({ CustomerCode: 'NOREG', InPeriod: 0, RegisteredDate: null }),
    ] : []);
    const body = await (await get('dateRange=month:2026-10')).json();
    const by = Object.fromEntries(body.rows.map((r: { customerCode: string }) => [r.customerCode, r]));
    expect(by.OLD.activeInPeriod).toBe(false);
    expect(by.LATE.activeInPeriod).toBeNull();
    expect(by.NOREG.activeInPeriod).toBe(false);
  });

  test('the period window is built from the validated range and the invalid range cannot inject SQL', async () => {
    await get('dateRange=month:2026-10');
    const customers = queries.find(q => q.sql.includes('PeriodSales'))!;
    expect(customers.sql).toContain('fs.DateKey >= 20261001');
    expect(customers.sql).toContain('fs.DateKey <= 20261031');
    queries.length = 0;
    await get("dateRange=month:2026-10'; DROP TABLE x; --");
    expect(queries.every(q => !q.sql.includes('DROP'))).toBe(true);
  });

  test('includeInactive controls the IsInactive predicate', async () => {
    await get('includeInactive=0');
    expect(queries.find(q => q.sql.includes('PeriodSales'))!.sql).toContain('c.IsInactive = 0');
    queries.length = 0;
    await get('includeInactive=1');
    expect(queries.find(q => q.sql.includes('PeriodSales'))!.sql).not.toContain('c.IsInactive = 0');
  });

  test('xlsx export honors the new filters and returns a spreadsheet', async () => {
    const res = await get('format=xlsx&dateRange=month:2026-10&grupo=S2&visit=no_interval');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml');
    expect(res.headers.get('Content-Disposition')).toContain('cobertura-clientes-');
  });

  test('xlsx grupo uses the shared parser: trimmed, and an invalid code means no group filter', async () => {
    const codes = async (qs: string) => {
      const res = await get(`format=xlsx&dateRange=month:2026-10&${qs}`);
      const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      return rows.map(r => r['Código']).sort();
    };
    expect(await codes('grupo=%20S2%20')).toEqual(['C2']);
    expect(await codes("grupo=S2'%20OR%20'1'='1")).toEqual(['C1', 'C2', 'C3']);
    expect(await codes('grupo=TOOLONGCODE')).toEqual(['C1', 'C2', 'C3']);
    expect(await codes('ruta=%204%20')).toEqual(['C2']);
  });

  test('a database error is a 500 with the standard error shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2026-10');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});

describe('GET /api/dwh/clientes/cobertura: nuevos vs patrimonio fields', () => {
  test('maps sales, previous period, first purchase and constancia per customer', async () => {
    respond = text => {
      if (text.includes('PeriodSales')) {
        return [
          customerRow({ CustomerCode: 'A', RegisteredDate: new Date('2026-05-01T00:00:00Z'), FirstDateKey: 20260510, PeriodBs: 700, PeriodUsd: 14, PrevBs: 350, PrevUsd: 7, InPrev: 1 }),
          customerRow({ CustomerCode: 'B', InPeriod: 0, PeriodBs: null, PeriodUsd: null, PrevBs: null, PrevUsd: null, InPrev: 0 }),
        ];
      }
      if (text.includes('@recentStartKey')) return [3, 10, 17].map(n => ({ Code: 'A', DateKey: daysAgoKey(n) }));
      return [];
    };
    const body = await (await get('dateRange=month:2026-10')).json();
    const by = Object.fromEntries(body.rows.map((r: { customerCode: string }) => [r.customerCode, r]));
    expect(body.prevPeriodAvailable).toBe(true);
    expect(by.A).toMatchObject({
      registeredDate: '2026-05-01', firstSaleDateKey: 20260510, daysToFirstSale: 9,
      salesPeriod: { bs: 700, usd: 14 }, salesPrev: { bs: 350, usd: 7 }, boughtPrev: true, stickiness: 'constante',   // weekly: sales 3, 10 and 17 days ago
    });
    expect(by.B).toMatchObject({ salesPeriod: { bs: 0, usd: 0 }, boughtPrev: false, daysToFirstSale: null, stickiness: 'perdido' });
    const customers = queries.find(q => q.sql.includes('PeriodSales'))!;
    expect(customers.sql).toContain('PrevSales');
    expect(customers.sql).toContain('fs.DateKey >= 20260901');                          // previous month window
  });

  test('a closed past YTD year has no previous window: comparisons are null and the query stays empty', async () => {
    respond = text => (text.includes('PeriodSales') ? [customerRow({ CustomerCode: 'A', PeriodBs: 10, PeriodUsd: 1 })] : []);
    const body = await (await get('dateRange=ytd:2024')).json();
    expect(body.prevPeriodAvailable).toBe(false);
    expect(body.rows[0]).toMatchObject({ salesPrev: null, boughtPrev: null });
    expect(queries.find(q => q.sql.includes('PeriodSales'))!.sql).toContain('AND 1 = 0');
  });

  test('the export honours kind, cooled and constancia and adds the new columns', async () => {
    respond = text => (text.includes('PeriodSales') ? [
      customerRow({ CustomerCode: 'P', RegisteredDate: new Date('2024-01-01T00:00:00Z'), InPeriod: 0, InPrev: 1, PrevBs: 5, PrevUsd: 1 }),
      customerRow({ CustomerCode: 'N', RegisteredDate: new Date('2026-05-01T00:00:00Z') }),
    ] : []);
    const res = await get('format=xlsx&dateRange=month:2026-10&kind=patrimonio&cooled=1');
    const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    expect(rows.map(r => r['Código'])).toEqual(['P']);
    expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['Registro', 'Ventas del período (USD)', 'Constancia (últimas 3 visitas)']));
  });
});
