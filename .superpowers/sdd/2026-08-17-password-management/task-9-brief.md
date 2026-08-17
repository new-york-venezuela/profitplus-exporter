# Task 9: POST /api/auth/password-reset/[token] (Reset with Token)

## Responsibility

HTTP route for unauthenticated users to submit new password with reset token. Final step of forgot password flow.

## Files

- **Modify:** `__tests__/integration/password-reset-routes.integration.test.ts` (add tests)
- **Create:** `app/api/auth/password-reset/[token]/route.ts`

## What to build

A POST route handler with dynamic segment:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // reset password with token
}
```

**Logic:**
1. Extract `token` from route params: `params.token`
2. Validate:
   - If no token: return 400 JSON `{ error: 'Token is required' }`
3. Parse request body: `await request.json()`
4. Extract `newPassword`
5. Validate password:
   - Must be string, at least 8 characters
   - If invalid: return 400 JSON `{ error: 'Password must be at least 8 characters' }`
6. Verify token: `await verifyToken(token)`
7. If invalid/expired: throw `TokenExpiredError`
8. Extract `userId` from payload `sub` claim
9. Hash new password: `await bcrypt.hash(newPassword, 10)`
10. Update user password in DB by userId
11. Return 200 JSON `{ ok: true, message: 'Password reset successful' }`

**Error handling:**
- Catch `TokenExpiredError`: return 401 JSON
- Other errors: return 500

**Route configuration:**
- Use `export const dynamic = 'force-dynamic'`
- POST method only

**Imports:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { TokenExpiredError } from '@/lib/errors/password-reset';
```

## Testing

Add integration tests to `__tests__/integration/password-reset-routes.integration.test.ts`:

1. Test: password updated with valid token
2. Test: returns 401 with expired token
3. Test: returns 400 when password too short
4. Verify password was actually changed in DB (hash comparison)

Use real database and real tokens.

## Success criteria

- Route file created at `app/api/auth/password-reset/[token]/route.ts`
- POST handler with correct signature
- Extracts token from route params
- Validates password (min 8 chars)
- Calls verifyToken()
- Hashes new password with bcrypt salt 10
- Updates user password in DB
- Returns 200 with `{ ok: true, message: ... }` on success
- Returns 401 for invalid/expired token
- Returns 400 for validation failures
- Integration tests pass
- Commit with message: `feat: implement password reset with token endpoint`

## Interfaces used from prior tasks

**Consumed:**
- `TokenExpiredError` from Task 1
- Existing `verifyToken()` from auth module
- Existing DB, schema, bcrypt

**Produces:**
- POST /api/auth/password-reset/[token] endpoint

