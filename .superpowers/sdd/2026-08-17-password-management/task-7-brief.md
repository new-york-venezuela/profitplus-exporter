# Task 7: POST /api/auth/password-reset-request (Forgot Password)

## Responsibility

HTTP route for unauthenticated users to request a password reset. Generates JWT token, sends email with reset link.

## Files

- **Modify:** `__tests__/integration/password-reset-routes.integration.test.ts` (add tests)
- **Create:** `app/api/auth/password-reset-request/route.ts`

## What to build

A POST route handler:

```typescript
export async function POST(request: NextRequest) {
  // handle unauthenticated password reset request
}
```

**Logic:**
1. Parse request body: `await request.json()`
2. Extract `email` from body
3. Validate input:
   - `email` required and must be string
   - If invalid: return 400 JSON `{ error: 'Email is required' }`
4. Normalize email: `.trim().toLowerCase()`
5. Create ForgotPasswordService instance
6. Call `service.requestReset(normalizedEmail)` → returns `{ token, resetUrl }`
7. Create EmailService instance
8. Send email:
   - Call `emailService.send(normalizedEmail, 'password-reset', { userName: 'User', resetUrl, resetUrlPlain: resetUrl })`
   - Catch `SMTPError`: log error, return 500 JSON `{ error: 'Failed to send email' }`
9. Handle service errors:
   - Catch `InvalidEmailError`: return 404 JSON `{ error: 'Email not found' }`
10. Return 200 JSON `{ ok: true, message: 'Check your email for password reset instructions' }`

**Route configuration:**
- Use `export const dynamic = 'force-dynamic'`
- POST method only

**Imports:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordService } from '@/lib/services/forgot-password-service';
import { EmailService } from '@/lib/services/email-service';
import { InvalidEmailError, SMTPError } from '@/lib/errors/password-reset';
```

## Testing

Add integration tests to `__tests__/integration/password-reset-routes.integration.test.ts`:

1. Test: sends reset email for valid email
2. Test: returns 404 when email not found
3. Test: returns 400 when email is missing

Mock or use real database. Mock EmailService (don't actually send emails in tests).

## Success criteria

- Route file created at `app/api/auth/password-reset-request/route.ts`
- POST handler with correct signature
- Validates email input
- Calls ForgotPasswordService.requestReset()
- Sends email via EmailService
- Proper error handling with correct HTTP status codes
- Returns 200 with `{ ok: true, message: ... }` on success
- Integration tests pass
- Commit with message: `feat: implement forgot password request endpoint`

## Interfaces used from prior tasks

**Consumed:**
- `ForgotPasswordService` from Task 3
- `EmailService` from Task 4
- `InvalidEmailError`, `SMTPError` from Task 1

**Produces:**
- POST /api/auth/password-reset-request endpoint

