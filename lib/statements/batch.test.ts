import { describe, expect, test } from 'bun:test';
import { exportStatements } from './batch';
import type { Statement } from './types';

function stmt(bsd: number, incomplete = false): Statement {
  const z = { bsd: 0, usd: 0 };
  return {
    asOf: new Date(), rows: [],
    aging: { porVencer: z, d1_30: z, d31_60: z, d61_90: z, d90plus: z },
    credits: z, total: { bsd, usd: 0 }, incomplete,
  };
}

function harness(map: Record<string, { fileName: string; statement: Statement } | null | Error>) {
  const logs: string[] = [];
  const writes: string[] = [];
  const deps = {
    listCandidates: async () => Object.keys(map),
    generate: async (c: string) => {
      const v = map[c];
      if (v instanceof Error) throw v;
      return v ? { pdf: Buffer.from('x'), fileName: v.fileName, statement: v.statement } : null;
    },
    write: async (f: string) => { writes.push(f); },
    log: (m: string) => { logs.push(m); },
  };
  return { deps, logs, writes };
}

describe('exportStatements', () => {
  test('writes net > 0, skips net <= 0 and null', async () => {
    const h = harness({
      A: { fileName: 'A.pdf', statement: stmt(10) },
      B: { fileName: 'B.pdf', statement: stmt(0) },
      C: { fileName: 'C.pdf', statement: stmt(-5) },
      D: null,
    });
    expect(await exportStatements(h.deps)).toEqual({ written: 1, skipped: 3, failed: 0 });
    expect(h.writes).toEqual(['A.pdf']);
  });

  test('float residue and sub-cent balances are skipped, one cent is written', async () => {
    const h = harness({
      R: { fileName: 'R.pdf', statement: stmt(5.684341886080802e-14) },
      S: { fileName: 'S.pdf', statement: stmt(0.004) },
      T: { fileName: 'T.pdf', statement: stmt(0.01) },
    });
    expect(await exportStatements(h.deps)).toEqual({ written: 1, skipped: 2, failed: 0 });
    expect(h.writes).toEqual(['T.pdf']);
  });

  test('null generate (open docs, no customer row) logs a warning with the code', async () => {
    const h = harness({ ORPHAN: null });
    expect(await exportStatements(h.deps)).toEqual({ written: 0, skipped: 1, failed: 0 });
    expect(h.logs.some(l => l.includes('ORPHAN'))).toBe(true);
  });

  test('a throwing customer is failed and logged, next still written', async () => {
    const h = harness({
      A: new Error('boom'),
      B: { fileName: 'B.pdf', statement: stmt(10) },
    });
    expect(await exportStatements(h.deps)).toEqual({ written: 1, skipped: 0, failed: 1 });
    expect(h.logs.some(l => l.includes('A') && l.includes('boom'))).toBe(true);
  });

  test('incomplete statements are logged with the customer code', async () => {
    const h = harness({ A1: { fileName: 'A1.pdf', statement: stmt(10, true) } });
    await exportStatements(h.deps);
    expect(h.logs.some(l => l.includes('A1') && /incomplete|incompleto/i.test(l))).toBe(true);
  });

  test('duplicate fileName from a different customer is failed, not overwritten', async () => {
    const h = harness({
      A: { fileName: 'same.pdf', statement: stmt(10) },
      B: { fileName: 'same.pdf', statement: stmt(10) },
    });
    expect(await exportStatements(h.deps)).toEqual({ written: 1, skipped: 0, failed: 1 });
    expect(h.writes).toEqual(['same.pdf']);
    expect(h.logs.some(l => l.includes('B') && l.includes('same.pdf'))).toBe(true);
  });

  test('write failure counts as failed', async () => {
    const h = harness({ A: { fileName: 'A.pdf', statement: stmt(10) } });
    h.deps.write = async () => { throw new Error('disk'); };
    expect(await exportStatements(h.deps)).toEqual({ written: 0, skipped: 0, failed: 1 });
  });
});
