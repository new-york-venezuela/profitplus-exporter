import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientesFiltersResponse } from '../../types';

const { default: CarteraFilterBar } = await import('../cartera-filter-bar');

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

describe('CarteraFilterBar', () => {
  test('loads options once from the filters section and reports the chosen group', async () => {
    const onGrupo = mock<(v: string | null) => void>(() => {});
    render(<CarteraFilterBar grupo={null} ruta={null} onGrupo={onGrupo} onRuta={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain('/api/dwh/clientes?section=filters');
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Abasto' }));
    expect(onGrupo).toHaveBeenCalledWith('S1');
  });

  test('picking a route reports its number as text; "Todas las rutas" clears it', async () => {
    const onRuta = mock<(v: string | null) => void>(() => {});
    render(<CarteraFilterBar grupo={null} ruta="3" onGrupo={() => {}} onRuta={onRuta} />);
    const user = userEvent.setup();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por ruta' }));
    await user.click(await screen.findByRole('button', { name: 'Ruta 4' }));
    expect(onRuta).toHaveBeenCalledWith('4');
    await user.click(screen.getByRole('textbox', { name: 'Filtrar por ruta' }));
    await user.click(await screen.findByRole('button', { name: 'Todas las rutas' }));
    expect(onRuta).toHaveBeenCalledWith(null);
  });

  test('a failed options request leaves empty selects instead of crashing', async () => {
    fetchMock.mockImplementation(async () => { throw new Error('offline'); });
    render(<CarteraFilterBar grupo={null} ruta={null} onGrupo={() => {}} onRuta={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: 'Filtrar por grupo' })).toBeTruthy();
  });
});
