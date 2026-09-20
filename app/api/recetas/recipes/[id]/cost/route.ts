import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getDb } from '@/lib/db/sqlite';
import { recipes, recipeLines } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { computeProductCost, type RecipeLineInput } from '@/lib/costing/product-cost';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { id } = await params;
  const recipe = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  const lines = db.select().from(recipeLines)
    .where(eq(recipeLines.recipeId, recipe.id))
    .orderBy(recipeLines.sortOrder)
    .all();

  const input: RecipeLineInput[] = lines.map(l => ({
    lineType: l.lineType,
    coArt: l.coArt,
    quantity: l.quantity,
    manualUnitCostUsd: l.manualUnitCostUsd,
  }));

  try {
    const pool = await getPool();
    const result = await computeProductCost(pool, input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Product cost computation error:', error);
    return NextResponse.json({ error: 'Error al calcular el costo' }, { status: 500 });
  }
}
