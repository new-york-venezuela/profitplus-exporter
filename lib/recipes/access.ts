import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';

export async function hasRecipesAccess(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<boolean> {
  if (role === 'admin') return true;

  const grant = db
    .select({ id: schema.userModules.id })
    .from(schema.userModules)
    .where(
      and(
        eq(schema.userModules.userId, parseInt(userId, 10)),
        eq(schema.userModules.module, 'recipes'),
      ),
    )
    .get();

  return grant !== undefined;
}
