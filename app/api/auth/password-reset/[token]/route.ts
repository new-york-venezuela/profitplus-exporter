import { NextRequest, NextResponse } from 'next/server';
import { verifyResetToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { TokenExpiredError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Await params (Next 16 requirement)
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { newPassword } = body as Record<string, unknown>;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  let payload;
  try {
    payload = await verifyResetToken(token);
    if (!payload) {
      throw new TokenExpiredError();
    }
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return NextResponse.json(
        { error: 'Token expired or invalid' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  try {
    const userId = parseInt(payload.sub, 10);
    const newHash = await bcrypt.hash(newPassword, 10);

    const db = getDb();
    db.update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, userId))
      .run();

    return NextResponse.json({
      ok: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
