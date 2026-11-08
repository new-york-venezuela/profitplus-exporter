import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';

mock.module('posthog-js', () => ({ default: { capture: () => {} } }));
const { default: TabVentas } = await import('../tab-ventas');

let urls: string[] = [];
beforeEach(() => {
  urls = [];
  globalThis.fetch = mock(async (u: unknown) => {
    urls.push(String(u));
    return { ok: false, status: 500, json: async () => ({ error: 'x' }) } as unknown as Response;
  }) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('TabVentas returns basis', () => {
  test('uses the prop in every request and has no local toggle', async () => {
    const { rerender } = render(<TabVentas dateRange="30d" currency="usd" granularity="month" returnsBasis="devolucion" />);
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls.filter(u => !u.includes('section=comparison')).every(u => u.includes('returnsBasis=devolucion'))).toBe(true);
    expect(screen.queryByLabelText('Fecha de atribución de devoluciones')).toBeNull();
    urls = [];
    rerender(<TabVentas dateRange="30d" currency="usd" granularity="month" returnsBasis="factura" />);
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls.filter(u => !u.includes('section=comparison')).every(u => u.includes('returnsBasis=factura'))).toBe(true);
  });
});
