import { screen } from '../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { HistoricoBanner } from '../historico-banner';

afterEach(cleanup);

describe('HistoricoBanner', () => {
  test('states the 2025 window and that Jan-Feb 2026 of the old system are not shown', () => {
    render(<HistoricoBanner />);
    expect(screen.getByText('Datos del sistema anterior (enero – diciembre 2025)')).toBeTruthy();
    expect(screen.getByText(/enero y febrero de 2026 del sistema anterior no se muestran/)).toBeTruthy();
    expect(screen.queryByText(/enero 2025 – febrero 2026/)).toBeNull();
  });
  test('keeps the returns-by-original-invoice explanation', () => {
    render(<HistoricoBanner />);
    expect(screen.getByText(/fecha de la factura/)).toBeTruthy();
  });
});
