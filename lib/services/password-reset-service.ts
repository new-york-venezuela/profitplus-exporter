import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { InvalidCredentialError } from '@/lib/errors/password-reset';

export class PasswordResetService {
  async reset(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const db = getDb();
    const id = parseInt(userId, 10);

    // Fetch user by ID
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .then((rows) => rows[0]);

    // User not found: throw InvalidCredentialError (no enumeration)
    if (!user) {
      throw new InvalidCredentialError();
    }

    // Compare current password against stored hash
    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    // Password mismatch: throw InvalidCredentialError
    if (!passwordMatches) {
      throw new InvalidCredentialError();
    }

    // Hash new password with salt rounds 10
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update user row with new hash
    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, id));
  }
}
