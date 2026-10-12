import { screen } from '../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: SearchableSelect } = await import('../searchable-select');

const options = [{ value: 'A', label: 'Alfa' }, { value: 'B', label: 'Beta' }];

afterEach(cleanup);

function setup(value: string | null = null) {
  const onChange = mock<(v: string | null) => void>(() => {});
  render(
    <div>
      <SearchableSelect value={value} onChange={onChange} options={options} allLabel="Todos" ariaLabel="Elegir" />
      <button type="button">Afuera</button>
    </div>,
  );
  return { onChange, user: userEvent.setup(), input: screen.getByRole('textbox', { name: 'Elegir' }) };
}

describe('SearchableSelect', () => {
  test('focus opens the list; picking an option calls onChange and closes it', async () => {
    const { onChange, user, input } = setup();
    expect(screen.queryByRole('button', { name: 'Alfa' })).toBeNull();
    await user.click(input);
    await user.click(await screen.findByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('B');
    expect(screen.queryByRole('button', { name: 'Alfa' })).toBeNull();
  });

  test('clicking the still-focused input reopens the list', async () => {
    const { user, input } = setup();
    await user.click(input);
    await user.click(await screen.findByRole('button', { name: 'Alfa' }));
    expect(document.activeElement).toBe(input);           // the pick does not blur the input
    expect(screen.queryByRole('button', { name: 'Beta' })).toBeNull();
    await user.click(input);
    expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();
  });

  test('blurring to an outside element closes the list', async () => {
    const { user, input } = setup();
    await user.click(input);
    expect(screen.getByRole('button', { name: 'Alfa' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Afuera' }));
    expect(screen.queryByRole('button', { name: 'Alfa' })).toBeNull();
  });

  test('the allLabel option clears the value with onChange(null)', async () => {
    const { onChange, user, input } = setup('A');
    expect((input as HTMLInputElement).value).toBe('Alfa');
    await user.click(input);
    await user.click(await screen.findByRole('button', { name: 'Todos' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
