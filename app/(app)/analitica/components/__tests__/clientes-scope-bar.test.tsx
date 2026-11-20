import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesFiltersResponse } from '../../types';
import { parseClientesParams, type ClientesParams } from '../../lib/clientes-params';

const { ScopeBar } = await import('../clientes/scope-bar');

const payload: ClientesFiltersResponse = {
  groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }],
  routes: [{ value: '3', label: 'Ruta 3' }, { value: '4', label: 'Ruta 4' }],
};
const fetchMock = mock<(url: string) => Promise<Response>>(async () => ({ ok: true, json: async () => payload }) as unknown as Response);

beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => payload }) as unknown as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const params = (qs = ''): ClientesParams => parseClientesParams(new URLSearchParams(qs));
const noop = () => {};

describe('ScopeBar', () => {
  test('shows the reference year next to Origen', () => {
    render(<ScopeBar params={params()} onChange={noop} referenceYear={2026} />);
    expect(screen.getByText(/Año de referencia: 2026/)).toBeTruthy();
  });

  test('loads options once and reports the chosen grupo', async () => {
    const onChange = mock<(p: Partial<ClientesParams>) => void>(() => {});
    render(<ScopeBar params={params()} onChange={onChange} referenceYear={2026} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain('/api/dwh/clientes?section=filters');
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Abasto' }));
    expect(onChange).toHaveBeenCalledWith({ grupo: 'S1' });
  });

  test('picking a route reports its number as text and Todas las rutas clears it', async () => {
    const onChange = mock<(p: Partial<ClientesParams>) => void>(() => {});
    render(<ScopeBar params={params('ruta=3')} onChange={onChange} referenceYear={2026} />);
    const user = userEvent.setup();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por ruta' }));
    await user.click(await screen.findByRole('button', { name: 'Ruta 4' }));
    expect(onChange).toHaveBeenCalledWith({ ruta: '4' });
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por ruta' }));
    await user.click(await screen.findByRole('button', { name: 'Todas las rutas' }));
    expect(onChange).toHaveBeenCalledWith({ ruta: null });
  });

  test('a failed options request leaves empty selects instead of crashing', async () => {
    fetchMock.mockImplementation(async () => { throw new Error('offline'); });
    render(<ScopeBar params={params()} onChange={noop} referenceYear={2026} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: 'Filtrar por grupo' })).toBeTruthy();
  });

  test('Limpiar filtros resets grupo, ruta, tienda, origen and is hidden at zero filters', async () => {
    const onChange = mock<(p: Partial<ClientesParams>) => void>(() => {});
    const { rerender } = render(<ScopeBar params={params()} onChange={onChange} referenceYear={2026} />);
    expect(screen.queryByRole('button', { name: /Limpiar filtros/ })).toBeNull();
    rerender(<ScopeBar params={params('grupo=S1&ruta=3&origen=nuevo&tienda=e:1')} onChange={onChange} referenceYear={2026} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Limpiar filtros \(4\)/ }));
    expect(onChange).toHaveBeenCalledWith({ grupo: null, ruta: null, tienda: null, origen: 'todos' });
  });

  test('dim and origen switches are aria-pressed and report changes', async () => {
    const onChange = mock<(p: Partial<ClientesParams>) => void>(() => {});
    render(<ScopeBar params={params()} onChange={onChange} referenceYear={2026} />);
    expect(screen.getByRole('button', { name: 'Casa matriz' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tienda' }));
    expect(onChange).toHaveBeenCalledWith({ dim: 'tienda' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Nuevos' }));
    expect(onChange).toHaveBeenCalledWith({ origen: 'nuevo' });
  });
});
