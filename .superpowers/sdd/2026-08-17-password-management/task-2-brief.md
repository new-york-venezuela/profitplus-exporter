# Task 2: PasswordResetService

## Responsibility

Service for authenticated password reset. User provides current password + new password. Service verifies current password against DB hash, then hashes and updates the new password.

## Files

- **Create:** `lib/services/password-reset-service.ts`
- **Create:** `__tests__/unit/services/password-reset-service.test.ts`

## What to build

A class `PasswordResetService` with one async method:

```typescript
reset(userId: string, currentPassword: string, newPassword: string): Promise<void>
```

**Logic:**
1. Fetch user from DB by `userId` (parse to int)
2. Compare `currentPassword` against stored `user.passwordHash` using `bcrypt.compare()`
3. If mismatch, throw `InvalidCredentialError`
4. If match, hash `newPassword` using `bcrypt.hash()` with salt rounds 10
5. Update user row: set `passwordHash` to new hash
6. Return (no value)

**Error paths:**
- If user not found: throw `InvalidCredentialError` (same as wrong password—no user enumeration)
- If current password wrong: throw `InvalidCredentialError`
- If DB operations fail: let error propagate (caller will handle)

**No side effects:** No email, no tokens, no sessions. Pure password update.

## Imports needed

```typescript
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { InvalidCredentialError } from '@/lib/errors/password-reset';
```

## Testing

Write tests that verify:
1. Password is updated when current password is correct
2. `InvalidCredentialError` thrown when current password is wrong
3. `InvalidCredentialError` thrown when user not found
4. No side effects (password actually updated in DB)

Mock `getDb()` and `bcrypt` in tests. Use real DB calls for integration tests (optional for this task).

## Success criteria

- Service class defined and exported
- `reset()` method matches signature exactly
- Calls `bcrypt.compare()` to verify current password
- Calls `bcrypt.hash()` with salt 10 to hash new password
- Throws `InvalidCredentialError` for wrong/missing password
- Updates DB with new hash
- Tests pass (verify with `npm test`)
- Commit with message: `feat: implement PasswordResetService with tests`

## Interfaces used from prior tasks

**Consumed:**
- `InvalidCredentialError` from Task 1 (already exported from `lib/errors/password-reset.ts`)
- `getDb()` from existing codebase (returns Drizzle DB instance)
- `users` table from schema (already exists, has `id`, `passwordHash` fields)
- `bcrypt` npm package (already installed)

**Produces:**
- `PasswordResetService` class with `reset(userId, currentPassword, newPassword)` method

