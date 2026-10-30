import { screen } from '../../../../../../test/dom-setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { makeKpis } from './fixtures';

const { VentasStrip } = await import('../ventas-strip');
afterEach(cleanup);

describe('VentasStrip', () => {
  test('shows the three cards with average price and rate', () => {
    render(<VentasStrip kpis={makeKpis()} currency="usd" />);
    expect(screen.getByText('Ventas brutas')).toBeTruthy();
    expect(screen.getByText('Devoluciones')).toBeTruthy();
    expect(screen.getByText('Neto')).toBeTruthy();
    expect(screen.getByText(/\$8\.06/)).toBeTruthy();
    expect(screen.getAllByText('Precio promedio').length).toBe(3);
    expect(screen.getByText(/4\.0%/)).toBeTruthy();
    expect(screen.getByText('$100,000')).toBeTruthy();
  });

  test('each card: units, clientes and price on the same basis as its amount, labelled', () => {
    // Legal-entity activeCustomers deliberately differs: the Brutas row counts customer codes.
    const kpis = makeKpis({
      salesGross: { bs: 1000, usd: 1000 }, returns: { bs: 100, usd: 100 }, salesNet: { bs: 900, usd: 900 },
      unitsSold: 500, unitsReturned: 50, activeCustomers: 7, customersWithSales: 40, customersWithReturns: 6, customersNet: 38,
    });
    render(<VentasStrip kpis={kpis} currency="usd" />);
    const card = (label: string) => screen.getByText(label, { selector: 'p' }).parentElement!;
    const row = (c: HTMLElement, label: string) =>
      Array.from(c.querySelectorAll('p')).find(p => p.firstChild?.textContent === label)?.lastChild?.textContent;
    const brutas = card('Ventas brutas');
    const dev = card('Devoluciones');
    const neto = card('Neto');
    expect(row(brutas, 'Unidades')).toBe('500');
    expect(row(brutas, 'Clientes / tiendas')).toBe('40');
    expect(row(brutas, 'Precio promedio')).toBe('$2.00');
    expect(row(dev, 'Unidades')).toBe('50');
    expect(row(dev, 'Clientes / tiendas')).toBe('6');
    expect(row(dev, 'Precio promedio')).toBe('$2.00');
    // neto units = brutas units - devoluciones units; avg = neto USD / neto units
    expect(row(neto, 'Unidades')).toBe('450');
    expect(row(neto, 'Clientes / tiendas')).toBe('38');
    expect(row(neto, 'Precio promedio')).toBe('$2.00');
    for (const c of [brutas, dev, neto]) expect(c.textContent).toContain('Incluye consignación');
  });

  test('null return rate renders a dash, not NaN', () => {
    render(<VentasStrip kpis={makeKpis({ returnRate: null })} currency="usd" />);
    expect(document.body.textContent).not.toContain('NaN');
  });
});
