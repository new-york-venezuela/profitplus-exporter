import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { TokenExpiredError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Step 1: Extract token from route params
  const { token } = params;

  // Step 2: Validate token presence
  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  // Step 3: Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Step 4: Extract newPassword from body
  const { newPassword } = body as Record<string, unknown>;

  // Step 5: Validate password
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  // Step 6: Verify token
  let payload;
  try {
    payload = await verifyToken(token);
    if (!payload) {
      throw new TokenExpiredError();
    }
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    // If verifyToken returns null, treat as expired
    return NextResponse.json(
      { error: 'Token expired or invalid' },
      { status: 401 }
    );
  }

  // Step 7: Extract userId from payload sub claim
  const userId = payload.sub;

  // Step 8: Hash new password
  let hashedPassword: string;
  try {
    hashedPassword = await bcrypt.hash(newPassword, 10);
  } catch (error) {
    console.error('Error hashing password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Step 9: Update user password in DB by userId
  try {
    const db = getDb();
    const id = parseInt(userId, 10);

    await db
      .update(users)
      .set({ passwordHash: hashedPassword })
      .where(eq(users.id, id));
  } catch (error) {
    console.error('Error updating password in database:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Step 10: Return 200 with success response
  return NextResponse.json({
    ok: true,
    message: 'Password reset successful',
  });
}
