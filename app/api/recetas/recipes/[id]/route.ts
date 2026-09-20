import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getDb } from '@/lib/db/sqlite';
import { recipes, recipeLines } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface LineInput {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  manualLabel: string | null;
  quantity: number;
  unit: string;
  manualUnitCostUsd: number | null;
}

function isValidLine(line: unknown): line is LineInput {
  if (!line || typeof line !== 'object') return false;
  const l = line as Record<string, unknown>;
  if (l.lineType !== 'erp_article' && l.lineType !== 'manual') return false;
  if (typeof l.quantity !== 'number' || !isFinite(l.quantity) || l.quantity <= 0) return false;
  if (typeof l.unit !== 'string' || l.unit.trim() === '') return false;
  if (l.lineType === 'erp_article' && (typeof l.coArt !== 'string' || l.coArt.trim() === '')) return false;
  if (l.lineType === 'manual' && (typeof l.manualLabel !== 'string' || l.manualLabel.trim() === '')) return false;
  return true;
}

async function authorize(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return { error: 'Prohibido', status: 403 } as const;
  return { session } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb();
  const recipe = db.select().from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  const lines = db.select().from(recipeLines)
    .where(eq(recipeLines.recipeId, recipe.id))
    .orderBy(recipeLines.sortOrder)
    .all();

  return NextResponse.json({
    id: recipe.id, coArt: recipe.coArt, label: recipe.label, active: recipe.active,
    lines: lines.map(l => ({
      id: l.id, lineType: l.lineType, coArt: l.coArt, manualLabel: l.manualLabel,
      quantity: l.quantity, unit: l.unit, manualUnitCostUsd: l.manualUnitCostUsd,
    })),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb();
  const recipe = db.select().from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.label !== 'string' || body.label.trim() === '' || typeof body.active !== 'boolean' || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (!body.lines.every(isValidLine)) {
    return NextResponse.json({ error: 'Renglón de receta inválido' }, { status: 400 });
  }

  db.update(recipes).set({ label: body.label.trim(), active: body.active, updatedAt: Date.now() }).where(eq(recipes.id, recipe.id)).run();

  db.delete(recipeLines).where(eq(recipeLines.recipeId, recipe.id)).run();
  if (body.lines.length > 0) {
    db.insert(recipeLines).values(
      (body.lines as LineInput[]).map((line, index) => ({
        recipeId: recipe.id,
        lineType: line.lineType,
        coArt: line.lineType === 'erp_article' ? line.coArt!.trim() : null,
        manualLabel: line.lineType === 'manual' ? line.manualLabel!.trim() : null,
        quantity: line.quantity,
        unit: line.unit.trim(),
        manualUnitCostUsd: line.lineType === 'manual' ? (line.manualUnitCostUsd ?? 0) : null,
        sortOrder: index,
      })),
    ).run();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb();
  const recipe = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, Number(id))).get();
  if (!recipe) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });

  db.delete(recipes).where(eq(recipes.id, recipe.id)).run();
  return NextResponse.json({ ok: true });
}
