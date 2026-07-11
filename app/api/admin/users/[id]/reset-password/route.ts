import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { getSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!body.newPassword || !body.confirmPassword) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: 'Las contraseñas no coinciden' }, { status: 400 });
    }
    if (!body.newPassword || (body.newPassword as string).length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const passwordHash = await argon2.hash(body.newPassword as string);
    db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
