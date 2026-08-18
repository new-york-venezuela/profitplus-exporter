# Task 8: GET /api/auth/password-reset/verify (Token Verification)

## Responsibility

HTTP route for front-end to verify reset token validity and retrieve user email. Called before showing reset form.

## Files

- **Modify:** `__tests__/integration/password-reset-routes.integration.test.ts` (add tests)
- **Create:** `app/api/auth/password-reset/verify/route.ts`

## What to build

A GET route handler:

```typescript
export async function GET(request: NextRequest) {
  // verify reset token
}
```

**Logic:**
1. Extract `token` from query params: `request.nextUrl.searchParams.get('token')`
2. Validate:
   - If no token: return 400 JSON `{ error: 'Token is required' }`
3. Verify token: `await verifyToken(token)` → returns payload or null
4. If invalid/expired: throw `TokenExpiredError('Token expired or invalid')`
5. Extract `userId` from payload `sub` claim (parse to int for DB)
6. Fetch user from DB by userId
7. If user not found: throw `TokenExpiredError`
8. Return 200 JSON:
   ```json
   {
     "valid": true,
     "email": "user@example.com",
     "name": "User Name"
   }
   ```

**Error handling:**
- Catch `TokenExpiredError`: return 401 JSON with message
- Other errors: return 500

**Route configuration:**
- Use `export const dynamic = 'force-dynamic'`
- GET method only

**Imports:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TokenExpiredError } from '@/lib/errors/password-reset';
```

## Testing

Add integration tests to `__tests__/integration/password-reset-routes.integration.test.ts`:

1. Test: verify valid token returns email and name
2. Test: returns 400 when token is missing
3. Test: returns 401 when token is invalid/expired

Use real database and real tokens (from `signToken()`).

## Success criteria

- Route file created at `app/api/auth/password-reset/verify/route.ts`
- GET handler with correct signature
- Extracts and validates token from query param
- Calls verifyToken()
- Fetches user from DB
- Returns email and name on success
- Returns 401 for invalid/expired tokens
- Returns 400 for missing token
- Integration tests pass
- Commit with message: `feat: implement token verification endpoint`

## Interfaces used from prior tasks

**Consumed:**
- `TokenExpiredError` from Task 1
- Existing `verifyToken()` from auth module
- Existing DB and schema

**Produces:**
- GET /api/auth/password-reset/verify endpoint

