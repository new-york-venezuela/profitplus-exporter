import { describe, test, expect } from 'bun:test';
import { computeFifoCost, type CostLayer } from '@/lib/costing/fifo';

describe('computeFifoCost', () => {
  test('a single layer fully covers the needed quantity', () => {
    const layers: CostLayer[] = [{ remaining: 100, costBsd: 10 }];
    const result = computeFifoCost(layers, 40);
    expect(result).toEqual({ costBsd: 400, estimated: false, hasData: true });
  });

  test('needed quantity spans two layers, oldest first', () => {
    const layers: CostLayer[] = [
      { remaining: 10, costBsd: 100 },  // oldest
      { remaining: 50, costBsd: 200 },  // newer
    ];
    // 10 units @ 100 + 5 units @ 200 = 1000 + 1000 = 2000
    const result = computeFifoCost(layers, 15);
    expect(result).toEqual({ costBsd: 2000, estimated: false, hasData: true });
  });

  test('needed quantity exceeds all remaining layers: shortfall priced at the most recent layer, flagged estimated', () => {
    const layers: CostLayer[] = [
      { remaining: 10, costBsd: 100 },
      { remaining: 5, costBsd: 200 },
    ];
    // covers 15 fully (10*100 + 5*200 = 2000), shortfall of 5 priced at the most recent layer's cost (200) = 1000
    const result = computeFifoCost(layers, 20);
    expect(result).toEqual({ costBsd: 3000, estimated: true, hasData: true });
  });

  test('zero layers: no cost data at all', () => {
    const result = computeFifoCost([], 10);
    expect(result).toEqual({ costBsd: 0, estimated: false, hasData: false });
  });

  test('quantity of zero costs nothing even with layers present', () => {
    const layers: CostLayer[] = [{ remaining: 10, costBsd: 100 }];
    const result = computeFifoCost(layers, 0);
    expect(result).toEqual({ costBsd: 0, estimated: false, hasData: true });
  });
});
