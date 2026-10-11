import { describe, test, expect } from 'bun:test';
import {
  applyRouteOwners, checkCoherence, deriveRouteOwners, type OwnerInput,
} from '../../../lib/customer-mapping/route-owners';

const r = (coCli: string, coVen: string, ruta: number | null): OwnerInput => ({ coCli, coVen, ruta });

describe('deriveRouteOwners', () => {
  test('owner is the seller with most customers; zone and counts are reported', () => {
    const [o] = deriveRouteOwners([r('A', '7', 4), r('B', '7', 4), r('C', '9', 4), r('D', '', 4)]);
    expect(o).toEqual({
      route: 4, zone: 'CCS004', owner: '7', tie: false, customers: 4,
      bySeller: [{ coVen: '7', n: 2 }, { coVen: '9', n: 1 }],
    });
  });
  test('a tie has no owner', () => {
    const [o] = deriveRouteOwners([r('A', '7', 4), r('B', '9', 4)]);
    expect(o.owner).toBeNull();
    expect(o.tie).toBe(true);
  });
  test('a route where nobody has a seller has no owner and is not a tie', () => {
    const [o] = deriveRouteOwners([r('A', '', 4), r('B', '  ', 4)]);
    expect(o).toMatchObject({ owner: null, tie: false, customers: 2, bySeller: [] });
  });
  test('leading zeros do not split a seller; first spelling wins', () => {
    const [o] = deriveRouteOwners([r('A', '7', 4), r('B', '007', 4), r('C', '000007', 4), r('D', '9', 4), r('E', '9', 4)]);
    expect(o.owner).toBe('7');
    expect(o.bySeller[0]).toEqual({ coVen: '7', n: 3 });
  });
  test('customers without route are ignored and routes come out ascending', () => {
    const out = deriveRouteOwners([r('A', '7', 10), r('B', '7', null), r('C', '9', 3)]);
    expect(out.map(o => o.route)).toEqual([3, 10]);
    expect(out.reduce((s, o) => s + o.customers, 0)).toBe(2);
  });
});

describe('checkCoherence', () => {
  test('a coherent set has no issues', () => {
    expect(checkCoherence([r('A', '7', 4), r('B', '007', 4), r('C', '9', 5)])).toEqual([]);
  });
  test('missing route and missing seller are reported per customer', () => {
    const issues = checkCoherence([r('A', '7', null), r('B', '', 4), r('C', '7', 4)]);
    expect(issues.map(i => [i.kind, i.coCli])).toEqual([['missing_route', 'A'], ['missing_seller', 'B']]);
  });
  test('a seller who is not the route owner is reported with the owner', () => {
    const issues = checkCoherence([r('A', '7', 4), r('B', '7', 4), r('C', '9', 4)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'seller_not_route_owner', coCli: 'C', ruta: 4, coVen: '9', owner: '7' });
    expect(issues[0].detail).toContain('ruta 4');
  });
  test('a tied route reports every seller-bearing customer as route_without_owner', () => {
    const issues = checkCoherence([r('A', '7', 4), r('B', '9', 4)]);
    expect(issues.map(i => i.kind)).toEqual(['route_without_owner', 'route_without_owner']);
  });
});

describe('applyRouteOwners', () => {
  test('assigns the owner to stragglers and blanks, records overrides, leaves others untouched', () => {
    const input = [r('A', '7', 4), r('B', '7', 4), r('C', '9', 4), r('D', '', 4), r('E', '5', 8)];
    const res = applyRouteOwners(input);
    expect(res.rows.map(x => x.coVen)).toEqual(['7', '7', '7', '7', '5']);
    expect(res.overrides).toEqual([
      { coCli: 'C', ruta: 4, from: '9', to: '7' },
      { coCli: 'D', ruta: 4, from: '', to: '7' },
    ]);
    expect(input[2].coVen).toBe('9'); // input not mutated
    expect(checkCoherence(res.rows)).toEqual([]);
  });
  test('tied and seller-less routes are left alone', () => {
    const input = [r('A', '7', 4), r('B', '9', 4), r('C', '', 6)];
    const res = applyRouteOwners(input);
    expect(res.rows).toEqual(input);
    expect(res.overrides).toEqual([]);
  });
  test('is idempotent', () => {
    const once = applyRouteOwners([r('A', '7', 4), r('B', '7', 4), r('C', '9', 4)]);
    const twice = applyRouteOwners(once.rows);
    expect(twice.overrides).toEqual([]);
    expect(twice.rows).toEqual(once.rows);
  });
});
