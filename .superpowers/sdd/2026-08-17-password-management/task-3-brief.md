# Task 3: ForgotPasswordService

## Responsibility

Service for unauthenticated password reset flow. Takes email, generates reset JWT token valid for 15 minutes, and returns token + reset URL for caller to send via email.

## Files

- **Create:** `lib/services/forgot-password-service.ts`
- **Create:** `__tests__/unit/services/forgot-password-service.test.ts`

## What to build

A class `ForgotPasswordService` with one async method:

```typescript
requestReset(email: string): Promise<{ token: string; resetUrl: string }>
```

**Logic:**
1. Normalize email: `email.toLowerCase().trim()`
2. Fetch user from DB by email
3. If user not found, throw `InvalidEmailError`
4. Generate JWT with payload:
   - `sub`: user id as string
   - `role`: 'user'
   - `name`: user name
   - `iat`: issued at (automatic with signToken)
   - `exp`: 15 minutes from now (use `signToken` with 15 min expiry)
5. Build reset URL: `${process.env.NEXT_PUBLIC_APP_URL}/auth/password-reset?token=${token}`
6. Return `{ token, resetUrl }`

**Error paths:**
- If email not found: throw `InvalidEmailError` (same as login—no user enumeration)
- If DB error: let error propagate

**No side effects:** Does NOT send email. That's the caller's (route) job.

## Imports needed

```typescript
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signToken, type SessionPayload } from '@/lib/auth/session';
import { InvalidEmailError } from '@/lib/errors/password-reset';
```

## JWT Token Spec

Use existing `signToken()` from `lib/auth/session.ts`. It already handles:
- Signing with `JWT_SECRET`
- Setting `iat` (issued at)
- Setting expiry via `setExpirationTime()`

Pass payload with `sub`, `role`, `name`. The token will be valid for 15 minutes (you can set expiry time in the token or rely on environment variable—check existing signToken implementation for how it handles expiry).

> **Note:** The existing `SessionPayload` type doesn't have an `aud` field for audience. That's OK—we'll verify audience in the reset endpoint when the token comes back. For now, just pass a standard SessionPayload.

## URL Construction

- Use `process.env.NEXT_PUBLIC_APP_URL` (fallback to `http://localhost:3000` if not set)
- Reset URL format: `${baseUrl}/auth/password-reset?token=${token}`
- Example: `http://localhost:3000/auth/password-reset?token=eyJ0eXAi...`

## Testing

Write tests that verify:
1. Token and resetUrl generated for valid email
2. `InvalidEmailError` thrown for nonexistent email
3. Reset URL contains the generated token
4. Token is a valid JWT string (contains dots)

Mock `getDb()` and `signToken()` in tests.

## Success criteria

- Service class defined and exported
- `requestReset()` method matches signature exactly
- Fetches user from DB by email
- Throws `InvalidEmailError` if email not found
- Calls `signToken()` to generate JWT
- Constructs reset URL with token
- Returns `{ token, resetUrl }` object
- Tests pass (verify with `npm test`)
- Commit with message: `feat: implement ForgotPasswordService with tests`

## Interfaces used from prior tasks

**Consumed:**
- `InvalidEmailError` from Task 1
- `getDb()`, `users` table from existing codebase
- `signToken()`, `SessionPayload` from `lib/auth/session.ts` (already in codebase)

**Produces:**
- `ForgotPasswordService` class with `requestReset(email)` method returning `{ token, resetUrl }`

