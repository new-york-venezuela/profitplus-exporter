import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { ListMeta } from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';

export function getListMeta(db: AppDb, coPrecio: string): ListMeta | undefined {
  return db.select().from(schema.pricingListMeta).where(eq(schema.pricingListMeta.coPrecio, coPrecio)).get();
}
export function setListMeta(db: AppDb, row: ListMeta): void {
  db.insert(schema.pricingListMeta).values(row).onConflictDoUpdate({ target: schema.pricingListMeta.coPrecio, set: { coMone: row.coMone } }).run();
}
export function getListMetaMap(db: AppDb): Map<string, ListMeta> {
  return new Map(db.select().from(schema.pricingListMeta).all().map(r => [r.coPrecio, r]));
}
