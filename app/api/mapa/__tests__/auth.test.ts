import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET as getClientes } from '../clientes/route';
import { PATCH as patchUbicacion } from '../clientes/[co_cli]/ubicacion/route';
import { POST as postRuta } from '../rutas/route';
import { PATCH as patchRuta, DELETE as deleteRuta } from '../rutas/[id]/route';

const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });

describe('/api/mapa/* reject unauthenticated requests with 401', () => {
  test('GET clientes', async () => {
    expect((await getClientes(new NextRequest('http://localhost/api/mapa/clientes'))).status).toBe(401);
  });
  test('PATCH ubicacion', async () => {
    const res = await patchUbicacion(json('http://localhost/api/mapa/clientes/A/ubicacion', 'PATCH', { lat: 10, lng: -66 }), ctx({ co_cli: 'A' }));
    expect(res.status).toBe(401);
  });
  test('POST rutas', async () => {
    expect((await postRuta(json('http://localhost/api/mapa/rutas', 'POST', { name: 'x', sellerCode: '1' }))).status).toBe(401);
  });
  test('PATCH / DELETE rutas/[id]', async () => {
    expect((await patchRuta(json('http://localhost/api/mapa/rutas/1', 'PATCH', { name: 'x' }), ctx({ id: '1' }))).status).toBe(401);
    expect((await deleteRuta(json('http://localhost/api/mapa/rutas/1', 'DELETE'), ctx({ id: '1' }))).status).toBe(401);
  });
});
