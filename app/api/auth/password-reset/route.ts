import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { PasswordResetService } from '@/lib/services/password-reset-service';
import { InvalidCredentialError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Step 1: Extract session token from cookies
  const sessionToken = request.cookies.get('session')?.value;

  // Step 2: If no session, return 401
  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Step 3: Verify session token
  const session = await verifyToken(sessionToken);

  // Step 4: If invalid, return 401
  if (!session) {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  // Step 5: Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Step 6: Extract currentPassword and newPassword
  const { currentPassword, newPassword } = body as Record<string, unknown>;

  // Step 7: Validate input
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters' },
      { status: 400 }
    );
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters' },
      { status: 400 }
    );
  }

  // Step 8: Create PasswordResetService instance
  const service = new PasswordResetService();

  // Step 9: Call service.reset()
  try {
    await service.reset(session.sub, currentPassword as string, newPassword);
  } catch (error) {
    // Step 10: Handle errors
    if (error instanceof InvalidCredentialError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    // Catch other errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Step 11: Return 200 with { ok: true }
  return NextResponse.json({ ok: true });
}
