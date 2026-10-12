import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

mock.module('posthog-js', () => ({ default: { capture: () => {} } }));
const { default: SellerProfile } = await import('../seller-profile');

// The error branch renders the back button, so no profile fixture is needed.
beforeEach(() => {
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({ error: 'Fallo de prueba' }) })) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('SellerProfile back link', () => {
  test('defaults to "← Volver a Seguimiento" (the Vendedores tab no longer exists) and calls onBack', async () => {
    const onBack = mock(() => {});
    render(<SellerProfile salesRepKey="1" dateRange="month:2026-10" currency="usd" onBack={onBack} />);
    const back = await screen.findByText('← Volver a Seguimiento');
    await userEvent.setup().click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Vendedores/)).toBeNull();
  });
  test('an explicit backLabel still wins (rendered verbatim after the arrow)', async () => {
    render(<SellerProfile salesRepKey="1" dateRange="month:2026-10" currency="usd" onBack={() => {}} backLabel="Volver a Otra pestaña" />);
    expect(await screen.findByText('← Volver a Otra pestaña')).toBeTruthy();
  });
});
