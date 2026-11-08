import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RETURNS_BASIS_LABEL } from '../../lib/net-sales';

const { default: ReturnsBasisSelector } = await import('../returns-basis-selector');

afterEach(cleanup);

describe('ReturnsBasisSelector', () => {
  test('marks the active option and reports a click on the other', async () => {
    const onChange = mock<(b: 'factura' | 'devolucion') => void>(() => {});
    render(<ReturnsBasisSelector value="devolucion" onChange={onChange} />);
    const active = screen.getByRole('button', { name: RETURNS_BASIS_LABEL.devolucion });
    const other = screen.getByRole('button', { name: RETURNS_BASIS_LABEL.factura });
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(other.getAttribute('aria-pressed')).toBe('false');
    await userEvent.setup().click(other);
    expect(onChange).toHaveBeenCalledWith('factura');
  });
});
