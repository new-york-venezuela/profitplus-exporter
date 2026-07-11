import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (userId === parseInt(session.sub, 10)) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
    }

    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    db.delete(users).where(eq(users.id, userId)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
