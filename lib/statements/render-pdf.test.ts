import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const hasPdftotext = spawnSync('pdftotext', ['-v']).error === undefined;
const text = (b: Buffer): string => {
  const dir = mkdtempSync(join(tmpdir(), 'stmt-'));
  const f = join(dir, 'a.pdf');
  writeFileSync(f, b);
  return spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).stdout;
};
const render = (rows: StatementRow[], incomplete = false) =>
  renderStatementPdf({ company: 'Co', logoPath: null, customer, statement: statement(rows, incomplete) });

describe.skipIf(!hasPdftotext)('rendered content (needs pdftotext; skipped if absent)', () => {
  test('aging summary precedes the table; total and note at the end', async () => {
    const t = text(await render([row(777)], true));
    const sum = t.indexOf('Resumen de antigüedad');
    expect(sum).toBeGreaterThan(-1);
    expect(sum).toBeLessThan(t.indexOf('Nro. documento'));
    expect(sum).toBeLessThan(t.indexOf('777'));
    expect(t.indexOf('Créditos y anticipos')).toBeLessThan(t.indexOf('777'));
    expect(t.lastIndexOf('Total')).toBeGreaterThan(t.indexOf('777'));
    expect(t.indexOf('Estado de cuenta incompleto: faltan tasas de cambio')).toBeGreaterThan(
      t.indexOf('777'),
    );
  });
  test('Sin tasa and incomplete note only when applicable', async () => {
    const t1 = text(await render([row(1, { rate: null, amountUsd: null })], true));
    expect(t1).toContain('Sin tasa');
    expect(t1).toContain('Estado de cuenta incompleto');
    const t2 = text(await render([row(1)]));
    expect(t2).not.toContain('Sin tasa');
    expect(t2).not.toContain('Estado de cuenta incompleto');
  });
  test('footer shows last page number and page count grows with rows', async () => {
    const counts: number[] = [];
    for (const n of [10, 60, 120, 240]) {
      const b = await render(Array.from({ length: n }, (_, i) => row(i)));
      const p = pages(b);
      counts.push(p);
      expect(text(b)).toContain(`Página ${p} de ${p}`);
    }
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
  });
  test('no empty trailing page: last page has content beyond footer', async () => {
    const b = await render(Array.from({ length: 120 }, (_, i) => row(i)));
    const pgs = text(b).split('\f').filter((x) => x.trim());
    expect(pgs[pgs.length - 1]).toContain('Total');
  });
});

describe('renderStatementPdf cwd independence', () => {
  test('imports and renders in a fresh process whose cwd is not the project root', () => {
    const fixture = join(import.meta.dir, '__fixtures__', 'render-cwd.ts');
    const r = spawnSync(process.execPath, ['--no-install', 'run', fixture], { cwd: tmpdir(), encoding: 'utf8' });
    expect(r.stderr).not.toMatch(/Cannot find module/);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('%PDF-');
  });
});

describe('statementFileName', () => {
  test('never emits quotes, CR or LF', () => {
    const n = statementFileName('C"1\r\n', 'a"b\r\nX: y');
    expect(n).not.toMatch(/["\r\n]/);
  });
  test('safe and stable', () => {
    const n = statementFileName('C001', 'Ñandú / Distribuidora: "El Sol"');
    expect(n).toBe(statementFileName('C001', 'Ñandú / Distribuidora: "El Sol"'));
    expect(n).not.toMatch(/[\/\\:*?"<>|\s]/);
    expect(n).toMatch(/^[\x20-\x7e]+$/);
    expect(n.endsWith('.pdf')).toBe(true);
    expect(n.length).toBeLessThanOrEqual(80);
    expect(n.startsWith('C001-')).toBe(true);
  });
  test('no dots/dashes at edges, empty fallback', () => {
    expect(statementFileName('C001', 'Foo..')).toBe('C001-Foo.pdf');
    expect(statementFileName('C001', '..-')).toBe('C001.pdf');
    expect(statementFileName('', '')).toBe('estado-de-cuenta.pdf');
    expect(statementFileName('', 'Ñ')).toBe('N.pdf');
  });
  test('truncates long names', () => {
    expect(statementFileName('C001', 'a'.repeat(300)).length).toBeLessThanOrEqual(80);
  });
});
