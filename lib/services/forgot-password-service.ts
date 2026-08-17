import { SignJWT } from 'jose';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { type SessionPayload } from '@/lib/auth/session';
import { InvalidEmailError } from '@/lib/errors/password-reset';

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

async function signResetToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecret());
}

export class ForgotPasswordService {
  async requestReset(email: string): Promise<{ token: string; resetUrl: string }> {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Fetch user from DB by email
    const db = getDb();
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .then((rows) => rows[0]);

    // If user not found, throw InvalidEmailError
    if (!user) {
      throw new InvalidEmailError();
    }

    // Generate JWT with payload
    const token = await signResetToken({
      sub: user.id.toString(),
      role: user.role,
      name: user.name,
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/password-reset?token=${token}`;

    // Return token and resetUrl
    return { token, resetUrl };
  }
}
