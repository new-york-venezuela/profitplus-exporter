import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth/session';
import argon2 from 'argon2';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const email = (body.email as string).trim().toLowerCase();
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    // Same error as wrong password — avoids user enumeration
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const valid = await argon2.verify(user.passwordHash, body.password as string);
  if (!valid) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const token = await signToken({ sub: String(user.id), role: user.role, name: user.name });
  const expiryDays = parseInt(process.env.JWT_EXPIRY_DAYS ?? '7');

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', token, {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax',
    path:      '/',
    maxAge:    expiryDays * 86400,
  });
  return response;
}
