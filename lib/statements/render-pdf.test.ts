import { describe, expect, test } from 'bun:test';
import { renderStatementPdf, statementFileName } from './render-pdf';
import type { Statement, StatementRow } from './types';

const m = (bsd: number, usd: number) => ({ bsd, usd });
const row = (i: number, over: Partial<StatementRow> = {}): StatementRow => ({
  kind: 'debt',
  coTipoDoc: 'FACT',
  nroDoc: String(i),
  fecEmis: new Date(2026, 9, 1),
  fecVenc: new Date(2026, 9, 20),
  daysOverdue: 6,
  amountBsd: 1234.5,
  rate: 50,
  amountUsd: 24.69,
  unknownType: false,
  ...over,
});
const statement = (rows: StatementRow[], incomplete = false): Statement => ({
  asOf: new Date(2026, 9, 26),
  rows,
  aging: {
    porVencer: m(0, 0),
    d1_30: m(1, 1),
    d31_60: m(0, 0),
    d61_90: m(0, 0),
    d90plus: m(0, 0),
  },
  credits: m(-10, -0.2),
  total: m(1000, 20),
  incomplete,
});
const customer = { coCli: 'C001', name: 'Ñandú, Distribución', rif: 'J-1', address: null };
const pages = (b: Buffer) => (b.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe('renderStatementPdf', () => {
  test('renders a PDF', async () => {
    const b = await renderStatementPdf({
      company: 'Alimentos NY',
      logoPath: null,
      customer,
      statement: statement([row(1), row(2, { kind: 'reducing', amountBsd: -5, amountUsd: -0.1 })]),
    });
    expect(b.subarray(0, 4).toString()).toBe('%PDF');
  });
  test('120 rows paginate', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => row(i));
    const b = await renderStatementPdf({
      company: 'X',
      logoPath: null,
      customer,
      statement: statement(rows),
    });
    expect(pages(b)).toBeGreaterThan(1);
  });
  test('empty, empty company, missing logo, unknown type, no rate', async () => {
    const b1 = await renderStatementPdf({
      company: '',
      logoPath: '/nope/missing.png',
      customer,
      statement: statement([]),
    });
    expect(b1.subarray(0, 4).toString()).toBe('%PDF');
    const b2 = await renderStatementPdf({
      company: '',
      logoPath: null,
      customer,
      statement: statement(
        [row(1, { coTipoDoc: 'ZZZZ', unknownType: true, rate: null, amountUsd: null })],
        true,
      ),
    });
    expect(b2.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('statementFileName', () => {
  test('safe and stable', () => {
    const n = statementFileName('C001', 'Ñandú / Distribuidora: "El Sol"');
    expect(n).toBe(statementFileName('C001', 'Ñandú / Distribuidora: "El Sol"'));
    expect(n).not.toMatch(/[\/\\:*?"<>|\s]/);
    expect(n).toMatch(/^[\x20-\x7e]+$/);
    expect(n.endsWith('.pdf')).toBe(true);
    expect(n.length).toBeLessThanOrEqual(80);
    expect(n.startsWith('C001-')).toBe(true);
  });
  test('truncates long names', () => {
    expect(statementFileName('C001', 'a'.repeat(300)).length).toBeLessThanOrEqual(80);
  });
});
