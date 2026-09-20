import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getDb } from '@/lib/db/sqlite';
import { recipes } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const rows = db.select().from(recipes).all();
  return NextResponse.json(rows.map(r => ({ id: r.id, coArt: r.coArt, label: r.label, active: r.active })));
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.coArt !== 'string' || body.coArt.trim() === '' || typeof body.label !== 'string' || body.label.trim() === '') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const existing = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.coArt, body.coArt.trim())).get();
  if (existing) {
    return NextResponse.json({ error: 'Ya existe una receta para este artículo' }, { status: 400 });
  }

  const now = Date.now();
  const created = db.insert(recipes).values({
    coArt: body.coArt.trim(), label: body.label.trim(), active: true, createdAt: now, updatedAt: now,
  }).returning({ id: recipes.id }).get();

  return NextResponse.json({ id: created!.id }, { status: 201 });
}
