import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const db = getDb();
    const list = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .all();

    const allModuleGrants = db.select().from(userModules).all();
    const modulesByUser = new Map<number, string[]>();
    for (const grant of allModuleGrants) {
      const existing = modulesByUser.get(grant.userId) ?? [];
      existing.push(grant.module);
      modulesByUser.set(grant.userId, existing);
    }

    const withModules = list.map(u => ({
      ...u,
      modules: modulesByUser.get(u.id) ?? [],
    }));

    return NextResponse.json(withModules);
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.name || !body.password || !body.role) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!['user', 'admin'].includes(body.role as string)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!body.password || (body.password as string).length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const email = (body.email as string).trim().toLowerCase();

    const db = getDb();
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password as string, 10);
    const result = db
      .insert(users)
      .values({
        email,
        name: (body.name as string).trim(),
        passwordHash,
        role: body.role as 'user' | 'admin',
        createdAt: Date.now(),
      })
      .returning({ id: users.id })
      .get();

    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
