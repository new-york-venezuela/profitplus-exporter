import { screen } from '../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const capture = mock(() => {});
mock.module('posthog-js', () => ({ default: { capture } }));
const { EstadosDeCuentaClient } = await import('../estados-de-cuenta-client');

afterEach(cleanup);

function stubFetch() {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ customers: [{ co_cli: 'C 1', cli_des: 'Alfa' }, { co_cli: 'C2', cli_des: 'Beta' }] }))) as never;
}

describe('EstadosDeCuentaClient', () => {
  test('download disabled until a customer is chosen, then links to the API', async () => {
    stubFetch();
    render(<EstadosDeCuentaClient />);
    const input = await screen.findByLabelText('Cliente');
    expect((screen.getByText('Descargar PDF') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.focus(input);
    fireEvent.click(await screen.findByText('C 1 - Alfa'));
    const link = screen.getByText('Descargar PDF') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/api/statements/C%201');
    link.addEventListener('click', e => e.preventDefault());
    fireEvent.click(link);
    expect(capture).toHaveBeenCalledWith('statement_download_clicked', { co_cli: 'C 1' });
  });
  test('shows a loading state until customers arrive', async () => {
    let release: (r: Response) => void = () => {};
    globalThis.fetch = mock(() => new Promise<Response>(r => { release = r; })) as never;
    render(<EstadosDeCuentaClient />);
    expect(screen.getByText('Cargando clientes...')).toBeTruthy();
    release(new Response(JSON.stringify({ customers: [] })));
    await waitFor(() => expect(screen.queryByText('Cargando clientes...')).toBeNull());
  });
  test('shows an error in Spanish when loading fails', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ error: 'Prohibido' }), { status: 403 })) as never;
    render(<EstadosDeCuentaClient />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Prohibido'));
  });
});
