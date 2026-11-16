import { describe, expect, test } from 'bun:test';
import { classifyPareto, PARETO_A, PARETO_B } from '../pareto';

const items = (vals: [string, number | null][]) => vals.map(([key, value]) => ({ key, value }));
const obj = (m: Map<string, unknown>) => Object.fromEntries(m);

describe('classifyPareto', () => {
  test('thresholds', () => {
    expect(PARETO_A).toBe(0.8);
    expect(PARETO_B).toBe(0.95);
  });

  test('60/25/10/5 -> A, A, B, C', () => {
    const r = classifyPareto(items([['a', 60], ['b', 25], ['c', 10], ['d', 5]]));
    expect(obj(r)).toEqual({ a: 'A', b: 'A', c: 'B', d: 'C' });
  });

  test('input order does not matter, sorted by value descending', () => {
    const r = classifyPareto(items([['d', 5], ['b', 25], ['a', 60], ['c', 10]]));
    expect(obj(r)).toEqual({ a: 'A', b: 'A', c: 'B', d: 'C' });
  });

  test('ties keep stable order by key', () => {
    // 50/50: before = 0 and .5 -> both A; use 3 ties of 40/40/20 style to see order
    const r = classifyPareto(items([['z', 30], ['y', 30], ['x', 30], ['w', 10]]));
    // sorted: x, y, z (tie by key), w. before: 0, .3, .6, .9 -> A, A, A, B
    expect(obj(r)).toEqual({ x: 'A', y: 'A', z: 'A', w: 'B' });
    const r2 = classifyPareto(items([['b', 45], ['a', 45], ['c', 10]]));
    // a first (0), b (.45), c (.9) -> A, A, B
    expect(obj(r2)).toEqual({ a: 'A', b: 'A', c: 'B' });
  });

  test('single item -> A', () => {
    expect(obj(classifyPareto(items([['a', 7]])))).toEqual({ a: 'A' });
  });

  test('four equal items -> all A (before: 0, .25, .5, .75)', () => {
    const r = classifyPareto(items([['a', 25], ['b', 25], ['c', 25], ['d', 25]]));
    expect(obj(r)).toEqual({ a: 'A', b: 'A', c: 'A', d: 'A' });
  });

  test('value <= 0 -> C and excluded from the total', () => {
    const r = classifyPareto(items([['a', 100], ['neg', -50], ['zero', 0]]));
    expect(obj(r)).toEqual({ a: 'A', neg: 'C', zero: 'C' });
  });

  test('null value -> null class and excluded', () => {
    const r = classifyPareto(items([['a', 100], ['n', null]]));
    expect(r.get('n')).toBeNull();
    expect(r.has('n')).toBe(true);
    expect(r.get('a')).toBe('A');
  });

  test('empty -> empty map', () => {
    expect(classifyPareto([]).size).toBe(0);
  });

  test('total 0 -> every non-null item is C', () => {
    const r = classifyPareto(items([['a', 0], ['b', -3], ['n', null]]));
    expect(obj(r)).toEqual({ a: 'C', b: 'C', n: null });
  });

  test('non-finite values are null class and excluded from the total', () => {
    const r = classifyPareto(items([['a', 60], ['b', 40], ['n', NaN], ['i', Infinity], ['m', -Infinity]]));
    expect(obj(r)).toEqual({ a: 'A', b: 'A', n: null, i: null, m: null });
  });
});
