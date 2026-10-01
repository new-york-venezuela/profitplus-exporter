import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import {
  listRoutes, createRoute, updateRoute, deleteRoute, DuplicateRouteError, RouteNotFoundError,
} from '@/lib/geo/routes-repo';

const sqlite = new Database(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
const db = drizzle(sqlite, { schema });

beforeAll(() => { migrate(db, { migrationsFolder: './migrations/sqlite' }); });
beforeEach(() => { sqlite.exec('DELETE FROM route_customers'); sqlite.exec('DELETE FROM routes'); });

describe('routes repo', () => {
  test('create then list', () => {
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    expect(r).toMatchObject({ name: 'Lunes', sellerCode: '000001', customerCodes: [] });
    expect(listRoutes(db)).toEqual([r]);
  });
  test('same name for the same seller is a DuplicateRouteError; same name for another seller is fine', () => {
    createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    expect(() => createRoute(db, { name: 'Lunes', sellerCode: '000001' })).toThrow(DuplicateRouteError);
    expect(createRoute(db, { name: 'Lunes', sellerCode: '000002' }).id).toBeGreaterThan(0);
  });
  test('updateRoute replaces membership atomically and renames', () => {
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    expect(updateRoute(db, r.id, { customerCodes: ['A', 'B'] }).customerCodes.sort()).toEqual(['A', 'B']);
    const again = updateRoute(db, r.id, { name: 'Martes', customerCodes: ['B', 'C'] });
    expect(again.name).toBe('Martes');
    expect(again.customerCodes.sort()).toEqual(['B', 'C']);
  });
  test('renaming into a duplicate throws and leaves membership unchanged', () => {
    createRoute(db, { name: 'Martes', sellerCode: '000001' });
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    updateRoute(db, r.id, { customerCodes: ['A'] });
    expect(() => updateRoute(db, r.id, { name: 'Martes', customerCodes: ['Z'] })).toThrow(DuplicateRouteError);
    expect(listRoutes(db).find(x => x.id === r.id)!.customerCodes).toEqual(['A']);
  });
  test('unknown id → RouteNotFoundError (update and delete)', () => {
    expect(() => updateRoute(db, 999, { name: 'x' })).toThrow(RouteNotFoundError);
    expect(() => deleteRoute(db, 999)).toThrow(RouteNotFoundError);
  });
  test('deleting a route cascades its memberships', () => {
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    updateRoute(db, r.id, { customerCodes: ['A'] });
    deleteRoute(db, r.id);
    expect(listRoutes(db)).toEqual([]);
    expect(sqlite.query('SELECT COUNT(*) AS n FROM route_customers').get()).toEqual({ n: 0 });
  });
});
