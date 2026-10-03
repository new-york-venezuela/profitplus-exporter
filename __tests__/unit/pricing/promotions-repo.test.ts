import { describe, test, expect } from 'bun:test';
import { eq } from 'drizzle-orm';
import { makeMemoryDb } from '../../helpers/memory-db';
import * as schema from '@/lib/db/schema';
import {
  insertPromotion, getPromotion, listPromotions, insertItems, listItems, updateItem,
  insertCustomers, listCustomers, markCustomerMoved, setPromotionEnd, cancelPromotion,
  setPromotionTipCli, findPromotionCustomerPrevious,
} from '@/lib/pricing/promotions-repo';

const promo = (extra = {}) => ({
  name: 'Octubre', reason: null, kind: 'overlay' as const, coPrecio: '01', baseCoPrecio: null, tipCli: null,
  startsOn: '2026-10-10', endsOn: '2026-10-20', cancelledAt: null, createdBy: '1', createdAt: 1, ...extra,
});

describe('promotions repo', () => {
  test('insert/get/list round trip', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo());
    const id2 = insertPromotion(db, promo({ name: 'B', kind: 'segment', baseCoPrecio: '02', tipCli: '000010', createdAt: 2 }));
    expect(getPromotion(db, id)).toEqual({ id, ...promo() });
    expect(getPromotion(db, 999)).toBeUndefined();
    expect(listPromotions(db).map(p => p.id)).toEqual([id, id2]);
  });
  test('items are unique per promotion and article', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo());
    insertItems(db, id, [{ coArt: 'A1', promoMonto: 5 }, { coArt: 'A2', promoMonto: 6 }]);
    expect(() => insertItems(db, id, [{ coArt: 'A1', promoMonto: 7 }])).toThrow();
    const items = listItems(db, id);
    expect(items.map(i => i.coArt)).toEqual(['A1', 'A2']);
    expect(items[0]).toMatchObject({ coArt: 'A1', promoMonto: 5, applied: 0, coAlma: null, regularMonto: null, message: null });
  });
  test('updateItem merges and nulls explicitly', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo());
    insertItems(db, id, [{ coArt: 'A1', promoMonto: 5 }]);
    updateItem(db, id, 'A1', { coAlma: 'W1', regularMonto: 9, applied: true });
    let it = listItems(db, id)[0];
    expect(it).toMatchObject({ coAlma: 'W1', regularMonto: 9, applied: 1, message: null });
    updateItem(db, id, 'A1', { message: 'x' });
    updateItem(db, id, 'A1', { regularMonto: null, message: null });
    it = listItems(db, id)[0];
    expect(it).toMatchObject({ coAlma: 'W1', regularMonto: null, applied: 1, message: null });
    updateItem(db, id, 'A1', { applied: false });
    expect(listItems(db, id)[0].applied).toBe(0);
  });
  test('customers and markCustomerMoved', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo({ kind: 'segment', tipCli: '000010' }));
    insertCustomers(db, id, [{ coCli: 'C1', previousTipCli: '000001' }, { coCli: 'C2', previousTipCli: '000002' }]);
    expect(() => insertCustomers(db, id, [{ coCli: 'C1', previousTipCli: 'x' }])).toThrow();
    markCustomerMoved(db, id, 'C1', true);
    const rows = listCustomers(db, id);
    expect(rows.map(r => r.coCli)).toEqual(['C1', 'C2']);
    expect(rows.find(r => r.coCli === 'C1')?.moved).toBe(1);
    expect(rows.find(r => r.coCli === 'C2')?.moved).toBe(0);
    markCustomerMoved(db, id, 'C1', false);
    expect(listCustomers(db, id).find(r => r.coCli === 'C1')?.moved).toBe(0);
  });
  test('setPromotionEnd, cancelPromotion, setPromotionTipCli', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo({ kind: 'segment' }));
    setPromotionEnd(db, id, '2026-10-25');
    cancelPromotion(db, id, 123);
    setPromotionTipCli(db, id, '000011');
    expect(getPromotion(db, id)).toMatchObject({ endsOn: '2026-10-25', cancelledAt: 123, tipCli: '000011' });
  });
  test('cascade delete removes items and customers', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo());
    insertItems(db, id, [{ coArt: 'A1', promoMonto: 5 }]);
    insertCustomers(db, id, [{ coCli: 'C1', previousTipCli: '000001' }]);
    db.delete(schema.pricingPromotions).where(eq(schema.pricingPromotions.id, id)).run();
    expect(listItems(db, id)).toEqual([]);
    expect(listCustomers(db, id)).toEqual([]);
  });
  test('findPromotionCustomerPrevious', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo({ kind: 'segment', tipCli: '000010' }));
    insertCustomers(db, id, [{ coCli: 'C1', previousTipCli: '000001' }]);
    expect(findPromotionCustomerPrevious(db, '000010', 'C1')).toBe('000001');
    expect(findPromotionCustomerPrevious(db, '000010', 'C9')).toBeUndefined();
    expect(findPromotionCustomerPrevious(db, '000099', 'C1')).toBeUndefined();
  });
  test('findPromotionCustomerPrevious: newest promotion wins when a segment has several', () => {
    const db = makeMemoryDb();
    const old = insertPromotion(db, promo({ kind: 'segment', tipCli: '000010' }));
    const recent = insertPromotion(db, promo({ kind: 'segment', tipCli: '000010', createdAt: 2 }));
    insertCustomers(db, old, [{ coCli: 'C1', previousTipCli: 'OLD' }]);
    insertCustomers(db, recent, [{ coCli: 'C1', previousTipCli: 'NEW' }]);
    expect(findPromotionCustomerPrevious(db, '000010', 'C1')).toBe('NEW');
  });
  test('insertItems/insertCustomers with [] are no-ops', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo());
    insertItems(db, id, []);
    insertCustomers(db, id, []);
    expect(listItems(db, id)).toEqual([]);
    expect(listCustomers(db, id)).toEqual([]);
  });
  test('updateItem with empty patch or unknown article is a no-op', () => {
    const db = makeMemoryDb();
    const id = insertPromotion(db, promo());
    insertItems(db, id, [{ coArt: 'A1', promoMonto: 5 }]);
    const before = listItems(db, id);
    updateItem(db, id, 'A1', {});
    updateItem(db, id, 'ZZ', { message: 'x', applied: true });
    expect(listItems(db, id)).toEqual(before);
  });
});
