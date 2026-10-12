import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

const { default: TabResumen } = await import('../tab-resumen');

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;
const PACE = /Día laborable \d+ de \d+/;

beforeEach(() => {
  globalThis.fetch = mock(async () => json(null)) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('TabResumen month-pace strip', () => {
  test('renders while the summary is still loading', async () => {
    globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<TabResumen dateRange="month:2026-09" currency="usd" granularity="month" />);
    expect(screen.getByText('Cargando…')).toBeTruthy();
    expect(screen.getByText(PACE)).toBeTruthy();
  });

  test('renders next to the error when the summary fails', async () => {
    globalThis.fetch = mock(async () => json({ error: 'Error al consultar el Data Warehouse' }, false, 500)) as unknown as typeof fetch;
    render(<TabResumen dateRange="30d" currency="usd" granularity="month" />);
    expect(await screen.findByText('Error al consultar el Data Warehouse')).toBeTruthy();
    expect(screen.getByText(PACE)).toBeTruthy();
  });

  test('renders with the empty state when the summary has no body', async () => {
    render(<TabResumen dateRange="30d" currency="bs" granularity="month" />);
    expect(await screen.findByText('Sin datos disponibles todavía.')).toBeTruthy();
    expect(screen.getByText(PACE)).toBeTruthy();
  });
});
