import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { getListMeta, setListMeta, getListMetaMap } from '@/lib/pricing/lists-repo';
describe('lists repo', () => {
  test('upsert round-trip', () => {
    const db = makeMemoryDb();
    setListMeta(db, { coPrecio: '11', coMone: 'USD', createdBy: '1', createdAt: 1 });
    setListMeta(db, { coPrecio: '11', coMone: 'BSD', createdBy: '1', createdAt: 1 });
    expect(getListMeta(db, '11')?.coMone).toBe('BSD');
    expect(getListMetaMap(db).size).toBe(1);
    expect(getListMeta(db, '99')).toBeUndefined();
  });
});
