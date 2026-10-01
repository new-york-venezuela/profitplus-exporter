import { eq, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import type { RouteDto } from './types';

export type AppDb = BunSQLiteDatabase<typeof schema>;

export class DuplicateRouteError extends Error {
  constructor() { super('Ya existe una ruta con ese nombre para este vendedor'); this.name = 'DuplicateRouteError'; }
}
export class RouteNotFoundError extends Error {
  constructor() { super('Ruta no encontrada'); this.name = 'RouteNotFoundError'; }
}

function isUniqueViolation(err: unknown): boolean {
  const text = (e: unknown) => (e instanceof Error ? e.message : '');
  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  return /UNIQUE constraint failed/i.test(text(err)) || /UNIQUE constraint failed/i.test(text(cause));
}

function toDtos(db: AppDb, ids?: number[]): RouteDto[] {
  const base = db.select().from(schema.routes);
  const rows = (ids ? base.where(inArray(schema.routes.id, ids)) : base).orderBy(schema.routes.name).all();
  if (rows.length === 0) return [];
  const members = db.select().from(schema.routeCustomers)
    .where(inArray(schema.routeCustomers.routeId, rows.map(r => r.id))).all();
  return rows.map(r => ({
    id: r.id, name: r.name, sellerCode: r.sellerCode,
    customerCodes: members.filter(m => m.routeId === r.id).map(m => m.customerCode),
  }));
}

export function listRoutes(db: AppDb): RouteDto[] {
  return toDtos(db);
}

export function createRoute(db: AppDb, input: { name: string; sellerCode: string }): RouteDto {
  try {
    const row = db.insert(schema.routes)
      .values({ name: input.name, sellerCode: input.sellerCode, createdAt: Date.now() })
      .returning().get()!;
    return { id: row.id, name: row.name, sellerCode: row.sellerCode, customerCodes: [] };
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateRouteError();
    throw err;
  }
}

export function updateRoute(
  db: AppDb, id: number, patch: { name?: string; sellerCode?: string; customerCodes?: string[] },
): RouteDto {
  try {
    db.transaction(tx => {
      const existing = tx.select().from(schema.routes).where(eq(schema.routes.id, id)).get();
      if (!existing) throw new RouteNotFoundError();
      if (patch.name !== undefined || patch.sellerCode !== undefined) {
        tx.update(schema.routes)
          .set({ name: patch.name ?? existing.name, sellerCode: patch.sellerCode ?? existing.sellerCode })
          .where(eq(schema.routes.id, id)).run();
      }
      if (patch.customerCodes !== undefined) {
        tx.delete(schema.routeCustomers).where(eq(schema.routeCustomers.routeId, id)).run();
        for (const customerCode of patch.customerCodes) {
          tx.insert(schema.routeCustomers).values({ routeId: id, customerCode }).run();
        }
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateRouteError();
    throw err;
  }
  return toDtos(db, [id])[0];
}

export function deleteRoute(db: AppDb, id: number): void {
  const existing = db.select().from(schema.routes).where(eq(schema.routes.id, id)).get();
  if (!existing) throw new RouteNotFoundError();
  db.delete(schema.routes).where(eq(schema.routes.id, id)).run();   // memberships cascade (FK ON DELETE CASCADE)
}
