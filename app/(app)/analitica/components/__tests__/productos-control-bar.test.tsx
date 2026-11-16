import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: ControlBar } = await import('../productos/control-bar');

afterEach(cleanup);

const params = {
  nivel: 'linea' as const, metric: 'ventas' as const, tienda: null, categoria: null,
  lineas: [], sublineas: [], grupo: null, q: '',
};

function setup() {
  const onChange = mock<(p: object) => void>(() => {});
  const { container } = render(
    <ControlBar
      params={params} onChange={onChange}
      tiendas={[{ value: 'T1', label: 'Tienda 1' }]} categorias={['Fresco']}
      lineaOptions={[{ value: 'L', label: 'L' }]} sublineaOptions={[{ value: 'S', label: 'S' }]}
      grupoOptions={[{ value: 'G', label: 'Grupo' }]}
    />,
  );
  return { onChange, container };
}

describe('ControlBar', () => {
  test('is sticky', () => {
    const { container } = setup();
    expect((container.firstElementChild as HTMLElement).className).toContain('sticky top-0 z-20');
  });
  test('nivel switch', async () => {
    const { onChange } = setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sublínea' }));
    expect(onChange).toHaveBeenCalledWith({ nivel: 'sublinea' });
  });
  test('metric toggle', async () => {
    const { onChange } = setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Unidades' }));
    expect(onChange).toHaveBeenCalledWith({ metric: 'unidades' });
  });
  test('search debounces to one onChange', async () => {
    const { onChange } = setup();
    const input = screen.getByPlaceholderText('Buscar por código o nombre de SKU...');
    await userEvent.setup().type(input, 'pan');
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ q: 'pan' });
  });
  test('external q change updates the input', () => {
    const onChange = mock<(p: object) => void>(() => {});
    const props = {
      onChange, tiendas: [], categorias: [], lineaOptions: [], sublineaOptions: [], grupoOptions: [],
    };
    const { rerender } = render(<ControlBar params={params} {...props} />);
    const input = screen.getByPlaceholderText('Buscar por código o nombre de SKU...') as HTMLInputElement;
    expect(input.value).toBe('');
    rerender(<ControlBar params={{ ...params, q: 'P123' }} {...props} />);
    expect(input.value).toBe('P123');
    expect(onChange).not.toHaveBeenCalled();
  });
});
