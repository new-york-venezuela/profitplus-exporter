import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { KpiCardData } from '../../../../../lib/clientes/kpis';

const { KpiStrip } = await import('../clientes/kpi-strip');
afterEach(cleanup);

const cards: KpiCardData[] = [
  { id: 'ventas', label: 'Ventas', value: '$10', current: 10, previous: 8, windowTag: 'período', basis: 'incluye consignación' },
  { id: 'activos', label: 'Clientes activos', value: '2', current: 2, previous: null, windowTag: 'período', basis: 'códigos con compras' },
  { id: 'patrimonio', label: 'Patrimonio retenido', value: '33.3%', current: 0.33, previous: null, windowTag: 'período', basis: 'vs período anterior', onClickFilter: { origen: 'patrimonio' } },
];

describe('KpiStrip', () => {
  test('renders label, value, window tag and basis for every card', () => {
    render(<KpiStrip cards={cards} onFilter={() => {}} />);
    expect(screen.getByText('Ventas')).toBeTruthy();
    expect(screen.getByText('$10')).toBeTruthy();
    expect(screen.getAllByText('período').length).toBe(3);
    expect(screen.getByText('incluye consignación')).toBeTruthy();
  });
  test('shows the delta when there is a previous value and sin base when there is none', () => {
    render(<KpiStrip cards={cards} onFilter={() => {}} />);
    expect(screen.getByText('▲ +25.0%')).toBeTruthy();
    expect(screen.getAllByText('sin base')).toHaveLength(1);
  });
  test('a card with onClickFilter is a button that applies its filter', async () => {
    const onFilter = mock<(p: unknown) => void>(() => {});
    render(<KpiStrip cards={cards} onFilter={onFilter} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Patrimonio retenido/ }));
    expect(onFilter).toHaveBeenCalledWith({ origen: 'patrimonio' });
  });
});
