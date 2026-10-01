import { eq, inArray } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from './routes-repo';
import {
  validatePolygon, polygonsOverlap, normalizeRing, toGeoJsonPolygon, fromGeoJsonPolygon,
  polygonErrorMessage, type PolygonError, type Ring,
} from './geometry';

export interface AreaDto { id: number; name: string; color: string; ring: Ring; sellerCodes: string[] }

export class AreaNotFoundError extends Error {
  constructor() { super('Zona no encontrada'); this.name = 'AreaNotFoundError'; }
}
export class DuplicateAreaError extends Error {
  constructor() { super('Ya existe una zona con ese nombre'); this.name = 'DuplicateAreaError'; }
}
export class InvalidPolygonError extends Error {
  constructor(public reason: PolygonError) { super(polygonErrorMessage(reason)); this.name = 'InvalidPolygonError'; }
}
export class AreaOverlapError extends Error {
  constructor(public conflict: { id: number; name: string }) {
    super(`La zona se superpone con «${conflict.name}»`);
    this.name = 'AreaOverlapError';
  }
}

function isUniqueViolation(err: unknown): boolean {
  const text = (e: unknown) => (e instanceof Error ? e.message : '');
  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  return /UNIQUE constraint failed/i.test(text(err)) || /UNIQUE constraint failed/i.test(text(cause));
}

function toDtos(db: AppDb, ids?: number[]): AreaDto[] {
  const base = db.select().from(schema.salesAreas);
  const rows = (ids ? base.where(inArray(schema.salesAreas.id, ids)) : base).orderBy(schema.salesAreas.id).all();
  if (rows.length === 0) return [];
  const sellers = db.select().from(schema.salesAreaSellers)
    .where(inArray(schema.salesAreaSellers.areaId, rows.map(r => r.id))).all();
  return rows.flatMap(r => {
    const ring = fromGeoJsonPolygon(r.polygon);
    if (!ring) return [];                    // a corrupt row must not take the whole map down
    return [{ id: r.id, name: r.name, color: r.color, ring, sellerCodes: sellers.filter(s => s.areaId === r.id).map(s => s.sellerCode) }];
  });
}

export function listAreas(db: AppDb): AreaDto[] {
  return toDtos(db);
}

// Validity first, then overlap against every OTHER area.
function assertRingAllowed(db: AppDb, ring: Ring, selfId: number | null): Ring {
  const open = normalizeRing(ring);
  const v = validatePolygon(open);
  if (!v.ok) throw new InvalidPolygonError(v.error);
  for (const other of toDtos(db)) {
    if (other.id !== selfId && polygonsOverlap(open, other.ring)) throw new AreaOverlapError({ id: other.id, name: other.name });
  }
  return open;
}

export function createArea(
  db: AppDb, input: { name: string; color: string; ring: Ring; sellerCodes: string[] },
): AreaDto {
  const ring = assertRingAllowed(db, input.ring, null);
  try {
    return db.transaction(tx => {
      const row = tx.insert(schema.salesAreas)
        .values({ name: input.name, color: input.color, polygon: toGeoJsonPolygon(ring), createdAt: Date.now() })
        .returning().get()!;
      for (const sellerCode of input.sellerCodes) tx.insert(schema.salesAreaSellers).values({ areaId: row.id, sellerCode }).run();
      return { id: row.id, name: row.name, color: row.color, ring, sellerCodes: [...input.sellerCodes] };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateAreaError();
    throw err;
  }
}

export function updateArea(
  db: AppDb, id: number, patch: { name?: string; color?: string; ring?: Ring; sellerCodes?: string[] },
): AreaDto {
  const existing = db.select().from(schema.salesAreas).where(eq(schema.salesAreas.id, id)).get();
  if (!existing) throw new AreaNotFoundError();
  const ring = patch.ring ? assertRingAllowed(db, patch.ring, id) : null;

  try {
    db.transaction(tx => {
      tx.update(schema.salesAreas).set({
        name: patch.name ?? existing.name,
        color: patch.color ?? existing.color,
        polygon: ring ? toGeoJsonPolygon(ring) : existing.polygon,
      }).where(eq(schema.salesAreas.id, id)).run();
      if (patch.sellerCodes !== undefined) {
        tx.delete(schema.salesAreaSellers).where(eq(schema.salesAreaSellers.areaId, id)).run();
        for (const sellerCode of patch.sellerCodes) tx.insert(schema.salesAreaSellers).values({ areaId: id, sellerCode }).run();
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateAreaError();
    throw err;
  }
  return toDtos(db, [id])[0];
}

export function deleteArea(db: AppDb, id: number): void {
  const existing = db.select().from(schema.salesAreas).where(eq(schema.salesAreas.id, id)).get();
  if (!existing) throw new AreaNotFoundError();
  db.delete(schema.salesAreas).where(eq(schema.salesAreas.id, id)).run();   // seller rows cascade
}
