import { describe, expect, test } from 'bun:test';
import { rollUpTrayectoria, type StoreAggregate } from '../trayectoria';

const P = { periodStartKey: 20261001, periodEndKey: 20261031 };
const store = (over: Partial<StoreAggregate>): StoreAggregate => ({
  code: 'S1', name: 'Tienda 1', entityKey: 1, entityName: 'Gama',
  sales: { bs: 100, usd: 10 }, salesPrev: { bs: 80, usd: 8 }, units: 10, unitsPrev: 8, orders: 2,
  lastOrderKey: 20261020, firstInvoiceKey: 20250101, ...over,
});

describe('rollUpTrayectoria', () => {
  const rows = rollUpTrayectoria([
    store({ code: 'G1', name: 'Gama Centro' }),
    store({ code: 'G2', name: 'Gama Este', sales: { bs: 50, usd: 5 }, salesPrev: { bs: 0, usd: 0 }, units: 5, unitsPrev: 0, orders: 1, lastOrderKey: 20261030, firstInvoiceKey: 20261012 }),
    store({ code: 'U1', name: 'Unica', entityKey: 2, entityName: 'Unica', sales: { bs: 30, usd: 3 } }),
  ], P);
  const byKey = (k: string) => rows.find(r => r.key === k)!;

  test('groups stores under their entity and sums sales, units and orders', () => {
    const gama = byKey('e:1');
    expect(gama).toMatchObject({ kind: 'entidad', parentKey: null, name: 'Gama', storeCount: 2, units: 15, unitsPrev: 8, orders: 3, lastOrderKey: 20261030, filterKey: 'e:1' });
    expect(gama.sales).toEqual({ bs: 150, usd: 15 });
    expect(gama.salesPrev).toEqual({ bs: 80, usd: 8 });
    expect(byKey('t:G1')).toMatchObject({ kind: 'tienda', parentKey: 'e:1', filterKey: 't:G1', code: 'G1' });
  });

  test('a one-store chain has storeCount 1 (the table does not expand it)', () => {
    expect(byKey('e:2').storeCount).toBe(1);
  });

  test('newStoresCount counts stores first invoiced inside the period', () => {
    expect(byKey('e:1').newStoresCount).toBe(1);
    expect(byKey('e:2').newStoresCount).toBe(0);
    expect(byKey('t:G2').newStoresCount).toBe(1);
  });

  test('a store with no entity is its own root and selects by its code', () => {
    const out = rollUpTrayectoria([store({ code: 'O1', name: 'Huérfana', entityKey: null, entityName: null })], P);
    const root = out.find(r => r.kind === 'entidad')!;
    expect(root).toMatchObject({ name: 'Huérfana', storeCount: 1, filterKey: 't:O1', parentKey: null });
    expect(out.find(r => r.kind === 'tienda')?.parentKey).toBe(root.key);
  });

  test('null USD on any store makes the chain USD null (never a partial sum)', () => {
    const out = rollUpTrayectoria([store({ code: 'A' }), store({ code: 'B', sales: { bs: 10, usd: null } })], P);
    expect(out.find(r => r.key === 'e:1')!.sales).toEqual({ bs: 110, usd: null });
  });

  test('entities are ordered by Bs sales descending', () => {
    expect(rows.filter(r => r.kind === 'entidad').map(r => r.key)).toEqual(['e:1', 'e:2']);
  });
});
