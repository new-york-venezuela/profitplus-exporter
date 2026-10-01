import { describe, test, expect } from 'bun:test';
import { assignPareto } from '@/lib/geo/pareto';

describe('assignPareto (same buckets as the analytics Clientes tab)', () => {
  test('ranks by revenue and buckets by cumulative share: A ≤ 20%, B ≤ 50%, C rest', () => {
    // total 100, ranked descending: c6=30 (cum .30 → B), c5=20 (.50 → B), c3=15 (.65 → C), c4=15 (.80 → C), c1/c2=10 (.90, 1.0 → C)
    const rows = [
      { coCli: 'c1', revenueBs: 10 }, { coCli: 'c2', revenueBs: 10 },
      { coCli: 'c3', revenueBs: 15 }, { coCli: 'c4', revenueBs: 15 },
      { coCli: 'c5', revenueBs: 20 }, { coCli: 'c6', revenueBs: 30 },
    ];
    const m = assignPareto(rows);
    // descending: c6(30) → cum .30 → B ; c5(20) → .50 → B ; c3(15) → .65 → C ...
    expect(m.get('c6')).toBe('B');
    expect(m.get('c5')).toBe('B');
    expect(m.get('c3')).toBe('C');
    expect(m.get('c1')).toBe('C');
  });
  test('documented quirk: a customer holding >20% on their own cannot be A', () => {
    const m = assignPareto([{ coCli: 'big', revenueBs: 90 }, { coCli: 'small', revenueBs: 10 }]);
    expect(m.get('big')).toBe('C'); // cum share 0.9, matches app/api/dwh/clientes/route.ts
    expect(m.get('small')).toBe('C');
  });
  test('many small customers produce A at the top', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ coCli: `c${i}`, revenueBs: 5 })); // each 5%
    const m = assignPareto(rows);
    const letters = rows.map(r => m.get(r.coCli));
    expect(letters.filter(l => l === 'A').length).toBe(4);   // cum .05 .10 .15 .20
    expect(letters.filter(l => l === 'B').length).toBe(6);   // .25 … .50
    expect(letters.filter(l => l === 'C').length).toBe(10);
  });
  test('zero, negative and missing revenue get no entry', () => {
    const m = assignPareto([{ coCli: 'a', revenueBs: 0 }, { coCli: 'b', revenueBs: -5 }, { coCli: 'c', revenueBs: 10 }]);
    expect(m.has('a')).toBe(false);
    expect(m.has('b')).toBe(false);
    expect(m.get('c')).toBe('C');
  });
  test('empty input → empty map, no division by zero', () => {
    expect(assignPareto([]).size).toBe(0);
  });
  test('does not mutate its input order', () => {
    const rows = [{ coCli: 'a', revenueBs: 1 }, { coCli: 'b', revenueBs: 9 }];
    assignPareto(rows);
    expect(rows[0].coCli).toBe('a');
  });
});
