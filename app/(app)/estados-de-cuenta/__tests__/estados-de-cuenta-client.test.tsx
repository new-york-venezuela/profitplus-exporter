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
  async function choose(label: string) {
    const input = await screen.findByLabelText('Cliente');
    fireEvent.focus(input);
    fireEvent.click(await screen.findByText(label));
  }

  test('download is disabled until a customer is chosen', async () => {
    stubFetch();
    render(<EstadosDeCuentaClient />);
    await screen.findByLabelText('Cliente');
    expect((screen.getByText('Descargar PDF') as HTMLButtonElement).disabled).toBe(true);
    await choose('C 1 - Alfa');
    expect((screen.getByText('Descargar PDF') as HTMLButtonElement).disabled).toBe(false);
  });
  test('downloads the PDF blob under the server file name and reports the click', async () => {
    const calls: string[] = [];
    globalThis.fetch = mock(async (url: string) => {
      calls.push(String(url));
      if (String(url).endsWith('/customers')) {
        return new Response(JSON.stringify({ customers: [{ co_cli: 'C 1', cli_des: 'Alfa' }] }));
      }
      return new Response('%PDF-1.7', { headers: { 'Content-Disposition': 'attachment; filename="C1-Alfa.pdf"' } });
    }) as never;
    const created = mock(() => 'blob:x');
    const revoked = mock(() => {});
    URL.createObjectURL = created as never;
    URL.revokeObjectURL = revoked as never;
    const names: string[] = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { names.push(this.download); };
    try {
      render(<EstadosDeCuentaClient />);
      await choose('C 1 - Alfa');
      fireEvent.click(screen.getByText('Descargar PDF'));
      await waitFor(() => expect(names).toEqual(['C1-Alfa.pdf']));
      expect(calls).toContain('/api/statements/C%201');
      expect(revoked).toHaveBeenCalledWith('blob:x');
      expect(capture).toHaveBeenCalledWith('statement_download_clicked', { co_cli: 'C 1' });
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
  });
  test('shows the server error instead of saving it when the statement fails', async () => {
    globalThis.fetch = mock(async (url: string) => {
      if (String(url).endsWith('/customers')) {
        return new Response(JSON.stringify({ customers: [{ co_cli: 'C 1', cli_des: 'Alfa' }] }));
      }
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), { status: 404 });
    }) as never;
    const created = mock(() => 'blob:x');
    URL.createObjectURL = created as never;
    render(<EstadosDeCuentaClient />);
    await choose('C 1 - Alfa');
    fireEvent.click(screen.getByText('Descargar PDF'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Cliente no encontrado'));
    expect(created).not.toHaveBeenCalled();
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
