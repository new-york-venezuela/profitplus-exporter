import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signResetToken } from '@/lib/auth/session';
import { InvalidEmailError } from '@/lib/errors/password-reset';

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
