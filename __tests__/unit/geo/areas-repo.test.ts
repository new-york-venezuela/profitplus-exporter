import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import {
  listAreas, createArea, updateArea, deleteArea,
  AreaNotFoundError, DuplicateAreaError, InvalidPolygonError, AreaOverlapError,
} from '@/lib/geo/areas-repo';
import type { Ring } from '@/lib/geo/geometry';

const sqlite = new Database(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
const db = drizzle(sqlite, { schema });

beforeAll(() => { migrate(db, { migrationsFolder: './migrations/sqlite' }); });
beforeEach(() => { sqlite.exec('DELETE FROM sales_area_sellers'); sqlite.exec('DELETE FROM sales_areas'); });

const sq = (x: number, y: number, size = 2): Ring => [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
const input = (name: string, ring: Ring, sellerCodes: string[] = []) => ({ name, color: '#2563EB', ring, sellerCodes });

describe('areas repo', () => {
  test('create then list round-trips ring, color and sellers', () => {
    const a = createArea(db, input('Norte', sq(0, 0), ['000001', '000002']));
    expect(a).toMatchObject({ name: 'Norte', color: '#2563EB', ring: sq(0, 0) });
    expect(a.sellerCodes.sort()).toEqual(['000001', '000002']);
    expect(listAreas(db)).toEqual([a]);
  });
  test('rejects an invalid polygon with the reason, and stores nothing', () => {
    expect(() => createArea(db, input('Bad', [[0, 0], [2, 2], [2, 0], [0, 2]]))).toThrow(InvalidPolygonError);
    try { createArea(db, input('Bad', [[0, 0], [1, 1]])); } catch (e) { expect((e as InvalidPolygonError).reason).toBe('TOO_FEW_VERTICES'); }
    expect(listAreas(db)).toEqual([]);
  });
  test('rejects an overlapping area and names the conflict', () => {
    createArea(db, input('Norte', sq(0, 0)));
    try { createArea(db, input('Centro', sq(1, 1))); throw new Error('should have thrown'); }
    catch (e) {
      expect(e).toBeInstanceOf(AreaOverlapError);
      expect((e as AreaOverlapError).conflict.name).toBe('Norte');
    }
  });
  test('accepts a neighbour that shares a full edge', () => {
    createArea(db, input('Norte', sq(0, 0)));
    expect(createArea(db, input('Este', sq(2, 0))).id).toBeGreaterThan(0);
  });
  test('duplicate name → DuplicateAreaError', () => {
    createArea(db, input('Norte', sq(0, 0)));
    expect(() => createArea(db, input('Norte', sq(10, 10)))).toThrow(DuplicateAreaError);
  });
  test('updating an area never conflicts with itself', () => {
    const a = createArea(db, input('Norte', sq(0, 0)));
    expect(updateArea(db, a.id, { ring: sq(0, 0, 3) }).ring).toEqual(sq(0, 0, 3));
  });
  test('updating the ring into a neighbour is rejected and leaves the old ring', () => {
    const a = createArea(db, input('Norte', sq(0, 0)));
    createArea(db, input('Este', sq(2, 0)));
    expect(() => updateArea(db, a.id, { ring: sq(1, 0) })).toThrow(AreaOverlapError);
    expect(listAreas(db).find(x => x.id === a.id)!.ring).toEqual(sq(0, 0));
  });
  test('update replaces seller assignment atomically; renaming into an existing name throws', () => {
    const a = createArea(db, input('Norte', sq(0, 0), ['1', '2']));
    createArea(db, input('Este', sq(5, 5)));
    expect(updateArea(db, a.id, { sellerCodes: ['3'] }).sellerCodes).toEqual(['3']);
    expect(() => updateArea(db, a.id, { name: 'Este', sellerCodes: ['9'] })).toThrow(DuplicateAreaError);
    expect(listAreas(db).find(x => x.id === a.id)!.sellerCodes).toEqual(['3']);
  });
  test('unknown id → AreaNotFoundError', () => {
    expect(() => updateArea(db, 999, { name: 'x' })).toThrow(AreaNotFoundError);
    expect(() => deleteArea(db, 999)).toThrow(AreaNotFoundError);
  });
  test('delete cascades seller rows', () => {
    const a = createArea(db, input('Norte', sq(0, 0), ['1']));
    deleteArea(db, a.id);
    expect(listAreas(db)).toEqual([]);
    expect(sqlite.query('SELECT COUNT(*) AS n FROM sales_area_sellers').get()).toEqual({ n: 0 });
  });
  test('a closed ring (first point repeated) is stored and returned open', () => {
    const a = createArea(db, input('Norte', [...sq(0, 0), sq(0, 0)[0]]));
    expect(a.ring).toEqual(sq(0, 0));
  });
});
