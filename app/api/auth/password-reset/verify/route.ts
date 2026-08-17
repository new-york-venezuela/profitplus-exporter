import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TokenExpiredError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Extract token from query params
    const token = request.nextUrl.searchParams.get('token');

    // Step 2: Validate token presence
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Step 3: Verify token
    const payload = await verifyToken(token);

    // Step 4: If invalid/expired, throw TokenExpiredError
    if (!payload) {
      throw new TokenExpiredError('Token expired or invalid');
    }

    // Step 5: Extract userId from payload sub claim and parse to int
    const userId = parseInt(payload.sub, 10);

    // Step 6: Fetch user from DB by userId
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // Step 7: If user not found, throw TokenExpiredError
    if (!user) {
      throw new TokenExpiredError('Token expired or invalid');
    }

    // Step 8: Return 200 JSON with user email and name
    return NextResponse.json({
      valid: true,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    // Step 9: Handle TokenExpiredError
    if (error instanceof TokenExpiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    // Step 10: Catch other errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
