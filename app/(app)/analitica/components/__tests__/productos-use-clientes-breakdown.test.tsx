import '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const { useClientesBreakdown, clearClientesBreakdownCache } = await import('../../lib/use-clientes-breakdown');

const payload = { nivel: 'sku', key: 'X', itemNet: { bs: 1, usd: 1 }, itemReturnRate: null, top3SharePct: null, rows: [] };
let calls: { url: string; signal: AbortSignal }[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  clearClientesBreakdownCache();
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, signal: init!.signal! });
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as unknown as typeof fetch;
});
afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

describe('useClientesBreakdown', () => {
  test('null url is idle and does not fetch', () => {
    const { result } = renderHook(() => useClientesBreakdown(null));
    expect(result.current.status).toBe('idle');
    expect(calls).toHaveLength(0);
  });

  test('fetches once per URL and re-uses the cache', async () => {
    const first = renderHook(() => useClientesBreakdown('/a'));
    expect(first.result.current.status).toBe('loading');
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    const second = renderHook(() => useClientesBreakdown('/a'));
    expect(second.result.current.status).toBe('ready');
    expect(calls).toHaveLength(1);
  });

  test('aborts the in-flight request when the URL changes', async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, signal: init!.signal! });
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    const { rerender } = renderHook(({ u }) => useClientesBreakdown(u), { initialProps: { u: '/a' } });
    rerender({ u: '/b' });
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].url).toBe('/b');
  });

  test('errors are reported and not cached', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'Nope' }), { status: 500 })) as unknown as typeof fetch;
    const { result } = renderHook(() => useClientesBreakdown('/e'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toEqual({ status: 'error', error: 'Nope' });
  });
});
