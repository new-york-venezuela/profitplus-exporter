import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const VALID_MODULES = ['inventory', 'dwh'] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.modules)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const modules: string[] = body.modules;
    if (modules.some(m => !VALID_MODULES.includes(m as typeof VALID_MODULES[number]))) {
      return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
    }

    const db = getDb();
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    db.delete(userModules).where(eq(userModules.userId, userId)).run();
    for (const moduleName of modules) {
      db.insert(userModules).values({ userId, module: moduleName as 'inventory' | 'dwh' }).run();
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
