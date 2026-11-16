import { screen } from '../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: MultiSelect } = await import('../multi-select');

const options = [
  { value: 'A', label: 'Alfa' }, { value: 'B', label: 'Beta' }, { value: 'C', label: 'Gamma' },
];
afterEach(cleanup);

function setup(value: string[] = []) {
  const onChange = mock<(v: string[]) => void>(() => {});
  render(
    <div>
      <MultiSelect options={options} value={value} onChange={onChange} placeholder="Líneas" ariaLabel="Líneas" />
      <button type="button">Afuera</button>
    </div>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('MultiSelect', () => {
  test('selects an option', async () => {
    const { onChange, user } = setup(['A']);
    await user.click(screen.getByRole('button', { name: /Líneas/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith(['A', 'B']);
  });
  test('deselects an option', async () => {
    const { onChange, user } = setup(['A', 'B']);
    await user.click(screen.getByRole('button', { name: /Líneas/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Alfa' }));
    expect(onChange).toHaveBeenCalledWith(['B']);
  });
  test('filters by typing', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Líneas/ }));
    await user.type(screen.getByRole('textbox'), 'gam');
    expect(screen.queryByRole('checkbox', { name: 'Alfa' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Gamma' })).toBeTruthy();
  });
  test('shows count and closes on outside click', async () => {
    const { user } = setup(['A', 'B']);
    const trigger = screen.getByRole('button', { name: /Líneas/ });
    expect(trigger.textContent).toContain('2');
    await user.click(trigger);
    expect(screen.getByRole('checkbox', { name: 'Alfa' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Afuera' }));
    expect(screen.queryByRole('checkbox', { name: 'Alfa' })).toBeNull();
  });
});
