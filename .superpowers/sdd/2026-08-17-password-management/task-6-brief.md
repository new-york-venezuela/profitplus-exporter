# Task 6: POST /api/auth/password-reset (Authenticated Reset)

## Responsibility

HTTP route for authenticated users to change their password. Requires session token, validates current password, applies new password.

## Files

- **Create:** `app/api/auth/password-reset/route.ts`
- **Create:** `__tests__/integration/password-reset-routes.integration.test.ts` (first file; add to it in later tasks)

## What to build

A POST route handler:

```typescript
export async function POST(request: NextRequest) {
  // handle authenticated password reset
}
```

**Logic:**
1. Extract session token from cookies: `cookies.get('session')?.value`
2. If no session: return 401 JSON `{ error: 'Authentication required' }`
3. Verify session token: `await verifyToken(sessionToken)`
4. If invalid: return 401 JSON `{ error: 'Invalid session' }`
5. Parse request body: `await request.json()`
6. Extract `currentPassword` and `newPassword`
7. Validate input:
   - Both fields required
   - `newPassword` must be string, at least 8 characters
   - If validation fails: return 400 JSON `{ error: 'New password must be at least 8 characters' }`
8. Create PasswordResetService instance
9. Call `service.reset(session.sub, currentPassword, newPassword)`
10. Handle errors:
    - Catch `InvalidCredentialError`: return 401 JSON with error message
    - Catch other errors: return 500 JSON `{ error: 'Internal server error' }`
11. Return 200 JSON `{ ok: true }`

**Route configuration:**
- Use `export const dynamic = 'force-dynamic'`
- POST method only

**Imports:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { PasswordResetService } from '@/lib/services/password-reset-service';
import { InvalidCredentialError } from '@/lib/errors/password-reset';
import { cookies } from 'next/headers';
```

## Testing

Write integration tests in `__tests__/integration/password-reset-routes.integration.test.ts`:

1. Test: password updates when current is correct
2. Test: 401 error when current password wrong
3. Test: 401 error when no session provided
4. Test: 400 error when password too short
5. Test: 400 error when fields missing

Mock or use real database for integration tests. Use real session tokens (from `signToken()`).

## Success criteria

- Route file created at `app/api/auth/password-reset/route.ts`
- POST handler with correct signature
- Extracts and validates session token
- Calls PasswordResetService.reset()
- Proper error handling with correct HTTP status codes
- Returns 200 with `{ ok: true }` on success
- Integration tests pass
- Commit with message: `feat: implement authenticated password reset endpoint`

## Interfaces used from prior tasks

**Consumed:**
- `PasswordResetService` from Task 2
- `InvalidCredentialError` from Task 1
- `verifyToken()` from existing auth module
- `cookies()` from Next.js

**Produces:**
- POST /api/auth/password-reset endpoint

