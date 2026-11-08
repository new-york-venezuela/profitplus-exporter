import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';

let authResult: { ok: true; session: unknown } | { ok: false; response: NextResponse };
let base: { customers: unknown[]; products: unknown[] };
let erp: unknown[];
let flagged: string[];

mock.module('@/lib/dwh/access', () => ({ requireDwhAccess: async () => authResult }));
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({}) }));
mock.module('@/lib/db/mssql', () => ({ getPool: async () => ({}) }));
mock.module('@/lib/prospect/queries', () => ({ fetchProspectBase: async () => base }));
mock.module('@/lib/geo/map-data', () => ({ fetchErpCustomers: async () => erp }));
mock.module('@/app/api/dwh/lib/consignment', () => ({
  getFlaggedRootCodes: async () => flagged,
  DEFAULT_ROOT_SHARE_THRESHOLD: 0.15,
}));

const { GET } = await import('../route');
const call = (qs = '') => GET(new NextRequest(`http://localhost/api/dwh/prospecto${qs}`));

const END = 20261101;
const cust = (code: string, over: Record<string, unknown> = {}) => ({
  code, name: `Cliente ${code}`, typeCode: 'SUP', typeName: 'Supermercado',
  routeNumber: 7, routeName: 'Ruta 7', firstKey: 20260810, units: 120, ...over,
});
const prod = (customerCode: string, over: Record<string, unknown> = {}) => ({
  customerCode, productCode: 'P1', productName: 'Pan', units: 120, usdNet: 360, usdUnits: 120, ...over,
});
const loc = (code: string, lat: number, lng: number) => ({ coCli: code, campo1: `Coordenadas: (${lat}, ${lng})` });

beforeEach(() => {
  authResult = { ok: true, session: { sub: '1', role: 'admin', name: 'T' } };
  const codes = ['A', 'B', 'C', 'D', 'E', 'F'];
  base = {
    customers: [
      ...codes.map((c) => cust(c)),
      cust('CONS', { units: 9999 }),
      cust('NOROUTE', { routeNumber: null, routeName: null }),
      cust('OTHER', { typeCode: 'REST', typeName: 'Restaurante', routeNumber: 8, routeName: 'Ruta 8' }),
    ],
    products: [...codes, 'CONS', 'NOROUTE', 'OTHER'].map((c) => prod(c)),
  };
  erp = [loc('A', 10.5, -66.9), loc(' B ', 10.51, -66.91), { coCli: 'C', campo1: 'basura' }];
  flagged = ['CONS'];
});

describe('GET /api/dwh/prospecto', () => {
  test('401 when unauthenticated', async () => {
    authResult = { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    expect((await call('?tipo=SUP&ruta=7&margen=30')).status).toBe(401);
  });

  test('403 without the module grant', async () => {
    authResult = { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
    expect((await call('?tipo=SUP&ruta=7&margen=30')).status).toBe(403);
  });

  test('400 for margin of 100, bad tipo, bad ruta and missing margin', async () => {
    for (const qs of ['?tipo=SUP&ruta=7&margen=100', '?tipo=!!&ruta=7&margen=30', '?tipo=SUP&ruta=x&margen=30', '?tipo=SUP&ruta=7']) {
      const res = await call(qs);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
  });

  test('400 for coordinates outside Venezuela or swapped, and for a half pin', async () => {
    expect((await call('?tipo=SUP&ruta=7&margen=30&lat=999&lng=0')).status).toBe(400);
    expect((await call('?tipo=SUP&ruta=7&margen=30&lat=-66.9&lng=10.5')).status).toBe(400);
    expect((await call('?tipo=SUP&ruta=7&margen=30&lat=10.5')).status).toBe(400);
    expect((await call('?section=suggest&lat=999&lng=0')).status).toBe(400);
  });

  test('happy path: peers exclude consignment, no-route and other types; benefit follows the maths', async () => {
    const res = await call('?tipo=SUP&ruta=7&margen=30');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe('type_route');
    expect(body.peerCount).toBe(6);
    expect(body.peers.map((p: { code: string }) => p.code).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(body.peers[0].typeName).toBe('Supermercado');
    // 120 units over ceil(83 days / 7)... weekly = 120 / weeksActive(20260810, END)
    expect(body.units.median).toBeGreaterThan(0);
    // cost 3.00, shelf 4.2857, benefit/unit 1.2857
    expect(body.benefit.medianUsd).toBeCloseTo(body.units.median * (3 / 0.7 - 3), 6);
    expect(body.benefit.incomplete).toBe(false);
    expect(body.excludedNoRoute).toBe(1);
    expect(body.suggestedRoute).toBeNull();
  });

  test('mix is pooled over the selected peers only', async () => {
    base.customers.push(cust('G', { typeCode: 'REST', routeNumber: 7 }));
    (base.products as unknown[]).push(prod('G', { productCode: 'ZZ', productName: 'Solo otro tipo' }));
    const body = await (await call('?tipo=SUP&ruta=7&margen=30')).json();
    expect(body.mix.map((m: { productCode: string }) => m.productCode)).toEqual(['P1']);
  });

  test('a product without USD cost gives null benefit, never zero', async () => {
    base.products = (base.products as { customerCode: string }[]).map((p) => ({ ...p, usdNet: null, usdUnits: 0 }));
    const body = await (await call('?tipo=SUP&ruta=7&margen=30')).json();
    expect(body.benefit).toBeNull();
    expect(body.mix[0].costUsd).toBeNull();
  });

  test('zero peers: headline null and peers empty', async () => {
    const body = await (await call('?tipo=NADA&ruta=7&margen=30')).json();
    expect(body.peerCount).toBe(0);
    expect(body.units).toBeNull();
    expect(body.benefit).toBeNull();
    expect(body.peers).toEqual([]);
  });

  test('suggestedRoute comes from the pin and nearby located routed customers', async () => {
    const body = await (await call('?tipo=SUP&ruta=7&margen=30&lat=10.5&lng=-66.9')).json();
    expect(body.suggestedRoute).toBe(7);
  });

  test('section=suggest returns only the route; null when nothing is located', async () => {
    expect(await (await call('?section=suggest&lat=10.5&lng=-66.9')).json()).toEqual({ route: 7 });
    erp = [];
    expect(await (await call('?section=suggest&lat=10.5&lng=-66.9')).json()).toEqual({ route: null });
  });

  test('section=options lists eligible types and routes with counts', async () => {
    const body = await (await call('?section=options')).json();
    expect(body.types).toEqual([
      { code: 'REST', name: 'Restaurante', count: 1 },
      { code: 'SUP', name: 'Supermercado', count: 6 },
    ]);
    expect(body.routes).toEqual([
      { number: 7, name: 'Ruta 7', customers: 6 },
      { number: 8, name: 'Ruta 8', customers: 1 },
    ]);
  });
});
