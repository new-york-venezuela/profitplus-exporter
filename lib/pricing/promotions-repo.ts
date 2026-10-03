import { and, asc, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { Promotion, PromotionItem, PromotionCustomer } from '@/lib/db/schema';

export function insertPromotion(db: AppDb, p: Omit<Promotion, 'id'>): number {
  return db.insert(schema.pricingPromotions).values(p).returning({ id: schema.pricingPromotions.id }).get().id;
}

export function getPromotion(db: AppDb, id: number): Promotion | undefined {
  return db.select().from(schema.pricingPromotions).where(eq(schema.pricingPromotions.id, id)).get();
}

export function listPromotions(db: AppDb): Promotion[] {
  return db.select().from(schema.pricingPromotions).orderBy(asc(schema.pricingPromotions.id)).all();
}

export function insertItems(db: AppDb, promotionId: number, items: { coArt: string; promoMonto: number }[]): void {
  if (items.length === 0) return;
  db.insert(schema.pricingPromotionItems)
    .values(items.map(i => ({ promotionId, coArt: i.coArt, promoMonto: i.promoMonto }))).run();
}

export function listItems(db: AppDb, promotionId: number): PromotionItem[] {
  return db.select().from(schema.pricingPromotionItems)
    .where(eq(schema.pricingPromotionItems.promotionId, promotionId))
    .orderBy(asc(schema.pricingPromotionItems.id)).all();
}

export function updateItem(
  db: AppDb,
  promotionId: number,
  coArt: string,
  patch: { coAlma?: string | null; regularMonto?: number | null; applied?: boolean; message?: string | null; appliedFrom?: string | null; appliedTo?: string | null; cancelledOn?: string | null },
): void {
  const set: Partial<typeof schema.pricingPromotionItems.$inferInsert> = {};
  if (patch.coAlma !== undefined) set.coAlma = patch.coAlma;
  if (patch.regularMonto !== undefined) set.regularMonto = patch.regularMonto;
  if (patch.applied !== undefined) set.applied = patch.applied ? 1 : 0;
  if (patch.message !== undefined) set.message = patch.message;
  if (patch.appliedFrom !== undefined) set.appliedFrom = patch.appliedFrom;
  if (patch.appliedTo !== undefined) set.appliedTo = patch.appliedTo;
  if (patch.cancelledOn !== undefined) set.cancelledOn = patch.cancelledOn;
  if (Object.keys(set).length === 0) return;
  db.update(schema.pricingPromotionItems).set(set)
    .where(and(eq(schema.pricingPromotionItems.promotionId, promotionId), eq(schema.pricingPromotionItems.coArt, coArt))).run();
}

export function insertCustomers(db: AppDb, promotionId: number, rows: { coCli: string; previousTipCli: string }[]): void {
  if (rows.length === 0) return;
  db.insert(schema.pricingPromotionCustomers)
    .values(rows.map(r => ({ promotionId, coCli: r.coCli, previousTipCli: r.previousTipCli }))).run();
}

export function listCustomers(db: AppDb, promotionId: number): PromotionCustomer[] {
  return db.select().from(schema.pricingPromotionCustomers)
    .where(eq(schema.pricingPromotionCustomers.promotionId, promotionId))
    .orderBy(asc(schema.pricingPromotionCustomers.id)).all();
}

export function markCustomerMoved(db: AppDb, promotionId: number, coCli: string, moved: boolean): void {
  db.update(schema.pricingPromotionCustomers).set({ moved: moved ? 1 : 0 })
    .where(and(eq(schema.pricingPromotionCustomers.promotionId, promotionId), eq(schema.pricingPromotionCustomers.coCli, coCli))).run();
}

export function setPromotionEnd(db: AppDb, id: number, endsOn: string): void {
  db.update(schema.pricingPromotions).set({ endsOn }).where(eq(schema.pricingPromotions.id, id)).run();
}

export function cancelPromotion(db: AppDb, id: number, at: number): void {
  db.update(schema.pricingPromotions).set({ cancelledAt: at }).where(eq(schema.pricingPromotions.id, id)).run();
}

export function setPromotionTipCli(db: AppDb, id: number, tipCli: string): void {
  db.update(schema.pricingPromotions).set({ tipCli }).where(eq(schema.pricingPromotions.id, id)).run();
}

const P = schema.pricingPromotions;
const I = schema.pricingPromotionItems;

/** The open promotion item on list `coPrecio` for `coArt` whose tracked promo row reaches `from` or later. */
export function findOpenPromotionItem(
  db: AppDb, coPrecio: string, coArt: string, from: string,
): { name: string; appliedTo: string } | undefined {
  const row = db.select({ name: P.name, appliedTo: I.appliedTo }).from(I).innerJoin(P, eq(P.id, I.promotionId))
    .where(and(
      eq(P.coPrecio, coPrecio), isNull(P.cancelledAt), eq(I.coArt, coArt), isNull(I.cancelledOn), gte(I.appliedTo, from),
    ))
    .orderBy(desc(I.appliedTo)).get();
  return row && row.appliedTo ? { name: row.name, appliedTo: row.appliedTo } : undefined;
}

/** Promo rows the app wrote (and has not cancelled) on list `coPrecio`. */
export function listTrackedPromoRows(db: AppDb, coPrecio: string): {
  coArt: string; coAlma: string | null; appliedFrom: string; appliedTo: string; regularMonto: number | null;
}[] {
  return db.select({
    coArt: I.coArt, coAlma: I.coAlma, appliedFrom: I.appliedFrom, appliedTo: I.appliedTo, regularMonto: I.regularMonto,
  })
    .from(I).innerJoin(P, eq(P.id, I.promotionId))
    .where(and(eq(P.coPrecio, coPrecio), isNull(I.cancelledOn), isNotNull(I.appliedFrom), isNotNull(I.appliedTo))).all()
    .map(r => ({ ...r, appliedFrom: r.appliedFrom!, appliedTo: r.appliedTo! }));
}

export function findPromotionByTipCli(db: AppDb, tipCli: string): Promotion | undefined {
  return db.select().from(P).where(eq(P.tipCli, tipCli)).orderBy(desc(P.id)).get();
}

/**
 * Segment codes are freshly allocated and never reused, so a segment belongs to exactly one promotion
 * in practice. If that ever breaks, the newest promotion (then newest customer row) wins deterministically.
 */
export function findPromotionCustomerPrevious(db: AppDb, tipCli: string, coCli: string): string | undefined {
  const row = db.select({ previousTipCli: schema.pricingPromotionCustomers.previousTipCli })
    .from(schema.pricingPromotionCustomers)
    .innerJoin(schema.pricingPromotions, eq(schema.pricingPromotions.id, schema.pricingPromotionCustomers.promotionId))
    .where(and(eq(schema.pricingPromotions.tipCli, tipCli), eq(schema.pricingPromotionCustomers.coCli, coCli)))
    .orderBy(desc(schema.pricingPromotions.id), desc(schema.pricingPromotionCustomers.id)).get();
  return row?.previousTipCli;
}
