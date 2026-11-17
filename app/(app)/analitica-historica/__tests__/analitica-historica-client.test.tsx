import { screen } from '../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

const pushed: string[] = [];
let search = '';
mock.module('next/navigation', () => ({
  useRouter: () => ({ push: (u: string) => { pushed.push(u); }, replace: (u: string) => { pushed.push(u); } }),
  useSearchParams: () => new URLSearchParams(search),
}));
mock.module('posthog-js', () => ({ default: { capture: () => {} } }));

const { AnaliticaHistoricaClient } = await import('../analitica-historica-client');
const { histPresetRange, HIST_START_KEY, keyToIso } = await import('@/lib/analitica-historica/window');

const lastUrl = () => decodeURIComponent(pushed[pushed.length - 1] ?? '');

beforeEach(() => {
  pushed.length = 0;
  search = '';
  // The mounted tab fetches on render; keep it pending so no real request is made.
  globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('AnaliticaHistoricaClient', () => {
  test('renders the six tabs and the legacy banner', () => {
    render(<AnaliticaHistoricaClient />);
    for (const label of ['Resumen', 'Ventas', 'Devoluciones', 'Clientes', 'Productos', 'Vendedores']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/sistema anterior/i).length).toBeGreaterThan(0);
  });

  test('a preset writes the concrete range anchored to the legacy window end', () => {
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByText('Último mes'));
    expect(lastUrl()).toContain(`dateRange=${histPresetRange('month')}`);
  });

  test('has the Bs / USD toggle', () => {
    render(<AnaliticaHistoricaClient />);
    expect(screen.getByText('USD')).toBeTruthy();
    fireEvent.click(screen.getByText('USD'));
    expect(lastUrl()).toContain('currency=usd');
  });

  test('custom date inputs are bounded to the legacy window', () => {
    search = `dateRange=${histPresetRange('all')}`;
    render(<AnaliticaHistoricaClient />);
    const start = screen.getByLabelText('Fecha inicial') as HTMLInputElement;
    expect(start.min).toBe(keyToIso(HIST_START_KEY));
  });

  test('the casa matriz / tienda switch shows on Clientes and writes clienteDimension', () => {
    search = 'tab=clientes';
    render(<AnaliticaHistoricaClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Tienda' }));
    expect(lastUrl()).toContain('clienteDimension=tienda');
  });

  test('the casa matriz / tienda switch is hidden where clients are not listed', () => {
    search = 'tab=resumen';
    render(<AnaliticaHistoricaClient />);
    expect(screen.queryByRole('button', { name: 'Tienda' })).toBeNull();
  });

  test('the returns-basis selector shows on Ventas but not on Productos', () => {
    search = 'tab=ventas';
    const { unmount } = render(<AnaliticaHistoricaClient />);
    expect(screen.getByText('Devoluciones', { selector: 'span' })).toBeTruthy();
    unmount();
    search = 'tab=productos';
    render(<AnaliticaHistoricaClient />);
    expect(screen.queryByText('Devoluciones', { selector: 'span' })).toBeNull();
  });
});
