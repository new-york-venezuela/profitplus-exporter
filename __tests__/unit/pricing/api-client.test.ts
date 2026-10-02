import { describe, test, expect, afterEach } from 'bun:test';
import { apiGet, apiSend, ApiError } from '@/app/(app)/pricing/api-client';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
};

describe('api-client', () => {
  test('apiGet returns parsed JSON', async () => {
    mockFetch(200, { a: 1 });
    expect(await apiGet<{ a: number }>('/x')).toEqual({ a: 1 });
  });
  test('non-2xx throws ApiError with the server message and status', async () => {
    mockFetch(409, { error: 'conflicto' });
    try { await apiSend('/x', 'PATCH', {}); throw new Error('no'); }
    catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).status).toBe(409); expect((e as ApiError).message).toBe('conflicto'); }
  });
  test('non-JSON error body with a real status reads Error del servidor (status)', async () => {
    globalThis.fetch = (async () => new Response('<html>oops</html>', { status: 502 })) as unknown as typeof fetch;
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 502, message: 'Error del servidor (502)' });
    globalThis.fetch = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    await expect(apiSend('/x', 'POST', {})).rejects.toMatchObject({ status: 500, message: 'Error del servidor (500)' });
  });
  test('network failure becomes ApiError(0)', async () => {
    globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 0, message: 'Error de red' });
  });
});
