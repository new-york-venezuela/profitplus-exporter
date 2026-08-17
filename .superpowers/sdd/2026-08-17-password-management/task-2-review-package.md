# Task 2 Review Package

## Commits

50a6258 feat: implement PasswordResetService with tests

## Diff stat

```
__tests__/unit/services/password-reset-service.test.ts | 99 ++++++++++++++++++++++
lib/services/password-reset-service.ts                 | 48 +++++++++++
2 files changed, 147 insertions(+)
```

## Full diff

```diff
diff --git a/__tests__/unit/services/password-reset-service.test.ts b/__tests__/unit/services/password-reset-service.test.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/__tests__/unit/services/password-reset-service.test.ts
@@ -0,0 +1,99 @@
+import { describe, test, expect, beforeEach } from 'bun:test';
+import { PasswordResetService } from '@/lib/services/password-reset-service';
+import { InvalidCredentialError } from '@/lib/errors/password-reset';
+import * as bcrypt from 'bcrypt';
+import { vi } from 'vitest';
+
+// Mock dependencies
+vi.mock('@/lib/db/sqlite', () => ({
+  getDb: vi.fn(),
+}));
+
+vi.mock('bcrypt');
+
+describe('PasswordResetService', () => {
+  let service: PasswordResetService;
+  let mockDb: any;
+
+  beforeEach(() => {
+    mockDb = {
+      select: vi.fn().mockReturnThis(),
+      from: vi.fn().mockReturnThis(),
+      where: vi.fn().mockReturnThis(),
+      get: vi.fn(),
+      update: vi.fn().mockReturnThis(),
+      set: vi.fn().mockReturnThis(),
+      run: vi.fn(),
+    };
+
+    service = new PasswordResetService();
+  });
+
+  test('should update password when current password is correct', async () => {
+    const userId = '1';
+    const currentPassword = 'oldPass123';
+    const newPassword = 'newPass456';
+
+    mockDb.get.mockReturnValue({
+      id: 1,
+      email: 'user@example.com',
+      passwordHash: 'hashedOldPassword',
+    });
+
+    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
+    vi.mocked(bcrypt.hash).mockResolvedValue('hashedNewPassword' as any);
+
+    await service.reset(userId, currentPassword, newPassword);
+
+    expect(mockDb.update).toHaveBeenCalled();
+    expect(mockDb.set).toHaveBeenCalledWith({ passwordHash: 'hashedNewPassword' });
+  });
+
+  test('should throw InvalidCredentialError when current password is wrong', async () => {
+    const userId = '1';
+    const currentPassword = 'wrongPass';
+    const newPassword = 'newPass456';
+
+    mockDb.get.mockReturnValue({
+      id: 1,
+      email: 'user@example.com',
+      passwordHash: 'hashedOldPassword',
+    });
+
+    vi.mocked(bcrypt.compare).mockResolvedValue(false as any);
+
+    await expect(service.reset(userId, currentPassword, newPassword)).rejects.toThrow(InvalidCredentialError);
+  });
+
+  test('should throw InvalidCredentialError when user not found', async () => {
+    const userId = '999';
+    const currentPassword = 'pass';
+    const newPassword = 'newPass';
+
+    mockDb.get.mockReturnValue(undefined);
+
+    await expect(service.reset(userId, currentPassword, newPassword)).rejects.toThrow(InvalidCredentialError);
+  });
+
+  test('should use bcrypt.hash with correct salt rounds', async () => {
+    const userId = '1';
+    const currentPassword = 'oldPass123';
+    const newPassword = 'newPass456';
+
+    mockDb.get.mockReturnValue({
+      id: 1,
+      email: 'user@example.com',
+      passwordHash: 'hashedOldPassword',
+    });
+
+    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
+    vi.mocked(bcrypt.hash).mockResolvedValue('hashedNewPassword' as any);
+
+    await service.reset(userId, currentPassword, newPassword);
+
+    expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
+  });
+});
+
+diff --git a/lib/services/password-reset-service.ts b/lib/services/password-reset-service.ts
+new file mode 100644
+index 0000000..abcdefg
+--- /dev/null
++++ b/lib/services/password-reset-service.ts
+@@ -0,0 +1,48 @@
++import { getDb } from '@/lib/db/sqlite';
++import { users } from '@/lib/db/schema';
++import { eq } from 'drizzle-orm';
++import * as bcrypt from 'bcrypt';
++import { InvalidCredentialError } from '@/lib/errors/password-reset';
++
++export class PasswordResetService {
++  async reset(userId: string, currentPassword: string, newPassword: string): Promise<void> {
++    const db = getDb();
++    const user = db
++      .select()
++      .from(users)
++      .where(eq(users.id, parseInt(userId)))
++      .get();
++
++    if (!user) {
++      throw new InvalidCredentialError('User not found');
++    }
++
++    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
++    if (!isValid) {
++      throw new InvalidCredentialError('Current password is incorrect');
++    }
++
++    const newHash = await bcrypt.hash(newPassword, 10);
++    db.update(users)
++      .set({ passwordHash: newHash })
++      .where(eq(users.id, parseInt(userId)))
++      .run();
++  }
++}
```

## Implementer report

Read: `.superpowers/sdd/2026-08-17-password-management/task-2-report.md`
