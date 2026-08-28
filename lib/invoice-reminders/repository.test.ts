import { describe, test, expect } from 'bun:test';
import { groupInvoiceRows } from './repository';
import type { RawInvoiceRow } from './types';

function makeRow(overrides: Partial<RawInvoiceRow> = {}): RawInvoiceRow {
  return {
    co_cli: 'C001', cli_des: 'Cliente Uno', email: 'uno@x.com',
    nro_doc: 'B0001', n_control: '00-001', fec_venc: new Date(), saldo: 100, tasa: 50,
    ...overrides,
  };
}

describe('groupInvoiceRows', () => {
  test('groups a not-yet-due row into dueSoon', () => {
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const groups = groupInvoiceRows([makeRow({ fec_venc: inTwoDays })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.dueSoon).toHaveLength(1);
    expect(groups[0]!.dueToday).toHaveLength(0);
    expect(groups[0]!.overdue).toHaveLength(0);
    expect(groups[0]!.dueSoon[0]!.diasVencido).toBeLessThan(0);
  });

  test('groups a today-due row into dueToday', () => {
    const groups = groupInvoiceRows([makeRow({ fec_venc: new Date() })]);
    expect(groups[0]!.dueToday).toHaveLength(1);
    expect(groups[0]!.dueToday[0]!.diasVencido).toBe(0);
  });

  test('groups a past-due row into overdue', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const groups = groupInvoiceRows([makeRow({ fec_venc: fiveDaysAgo })]);
    expect(groups[0]!.overdue).toHaveLength(1);
    expect(groups[0]!.overdue[0]!.diasVencido).toBe(5);
  });

  test('computes saldoUsd as saldo / tasa', () => {
    const groups = groupInvoiceRows([makeRow({ saldo: 500, tasa: 50 })]);
    const invoice = groups[0]!.dueToday[0] ?? groups[0]!.dueSoon[0] ?? groups[0]!.overdue[0];
    expect(invoice!.saldoUsd).toBeCloseTo(10, 5);
  });

  test('groups multiple rows for the same customer under one entry', () => {
    const groups = groupInvoiceRows([
      makeRow({ nro_doc: 'B0001' }),
      makeRow({ nro_doc: 'B0002' }),
    ]);
    expect(groups).toHaveLength(1);
    const total = groups[0]!.dueSoon.length + groups[0]!.dueToday.length + groups[0]!.overdue.length;
    expect(total).toBe(2);
  });

  test('keeps separate customers as separate entries', () => {
    const groups = groupInvoiceRows([
      makeRow({ co_cli: 'C001' }),
      makeRow({ co_cli: 'C002', cli_des: 'Cliente Dos', email: 'dos@x.com' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.coCli).sort()).toEqual(['C001', 'C002']);
  });

  test('empty input returns empty array', () => {
    expect(groupInvoiceRows([])).toEqual([]);
  });
});
