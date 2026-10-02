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
  test('network failure becomes ApiError(0)', async () => {
    globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 0, message: 'Error de red' });
  });
});
