import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';

mock.module('posthog-js', () => ({ default: { capture: () => {} } }));
const { default: TabDevoluciones } = await import('../tab-devoluciones');

let urls: string[] = [];
beforeEach(() => {
  urls = [];
  globalThis.fetch = mock(async (u: unknown) => {
    urls.push(String(u));
    return { ok: false, status: 500, json: async () => ({ error: 'x' }) } as unknown as Response;
  }) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('TabDevoluciones returns basis', () => {
  test('sends the basis in every request, refetches on change and labels it', async () => {
    const { rerender } = render(<TabDevoluciones dateRange="30d" currency="usd" returnsBasis="devolucion" />);
    await waitFor(() => expect(urls.length).toBeGreaterThanOrEqual(4));
    expect(urls.every(u => u.includes('returnsBasis=devolucion'))).toBe(true);
    expect(screen.getAllByText(/por fecha de devolución/).length).toBeGreaterThan(0);
    urls = [];
    rerender(<TabDevoluciones dateRange="30d" currency="usd" returnsBasis="factura" />);
    await waitFor(() => expect(urls.length).toBeGreaterThanOrEqual(4));
    expect(urls.every(u => u.includes('returnsBasis=factura'))).toBe(true);
    expect(screen.getAllByText(/por fecha de factura/).length).toBeGreaterThan(0);
  });
});
