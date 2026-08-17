# Task 7: POST /api/auth/password-reset-request Implementation Report

## Status: ✅ COMPLETE

### Summary
Successfully implemented the forgot password request endpoint that allows unauthenticated users to initiate a password reset. The endpoint generates a JWT token, constructs a reset URL, and sends a password reset email.

### Files Created/Modified

**Created:**
- `/app/api/auth/password-reset-request/route.ts` - HTTP route handler for POST requests

**Modified:**
- `/__tests__/integration/password-reset-routes.integration.test.ts` - Added 3 integration tests

### Implementation Details

#### Route Handler (`app/api/auth/password-reset-request/route.ts`)
- **Configuration:** `export const dynamic = 'force-dynamic'`
- **Method:** POST only
- **Imports:**
  - `NextRequest`, `NextResponse` from `next/server`
  - `ForgotPasswordService` from service layer
  - `EmailService` for sending emails
  - Error classes: `InvalidEmailError`, `SMTPError`

**Logic Flow:**
1. Parse JSON request body with error handling
2. Extract and validate `email` parameter (required, must be string)
3. Return 400 with "Email is required" if validation fails
4. Normalize email with `.trim().toLowerCase()`
5. Create `ForgotPasswordService` instance
6. Call `service.requestReset(normalizedEmail)` to get token and resetUrl
7. Catch `InvalidEmailError` → return 404 with "Email not found"
8. Create `EmailService` instance
9. Send email: `emailService.send(normalizedEmail, 'password-reset', { userName: 'User', resetUrl, resetUrlPlain: resetUrl })`
10. Catch `SMTPError` → log error, return 500 with "Failed to send email"
11. On success → return 200 with `{ ok: true, message: 'Check your email for password reset instructions' }`

#### Error Handling
- **400 Bad Request:** Missing or non-string email, invalid JSON body
- **404 Not Found:** Email address not found in database (InvalidEmailError)
- **500 Internal Server Error:** Email sending failure (SMTPError)

### Integration Tests Added

Three comprehensive tests added to `__tests__/integration/password-reset-routes.integration.test.ts`:

1. **Test: "sends reset email for valid email"**
   - Mocks ForgotPasswordService and EmailService
   - Calls endpoint with valid email
   - Verifies 200 status code
   - Confirms response has `{ ok: true, message: '...' }`

2. **Test: "returns 404 when email not found"**
   - Mocks ForgotPasswordService to throw InvalidEmailError
   - Calls endpoint with non-existent email
   - Verifies 404 status code
   - Confirms error message is "Email not found"

3. **Test: "returns 400 when email is missing"**
   - Calls endpoint with empty body (no email parameter)
   - Verifies 400 status code
   - Confirms error message is "Email is required"

### Test Results
All 11 tests pass successfully (including 3 new Task 7 tests + 8 existing tests for Task 6 endpoint).

```
✓ 11 pass
✗ 0 fail
  21 expect() calls
  Ran 11 tests across 1 file. [103.00ms]
```

### Code Quality
- Type-safe with TypeScript
- Proper error handling with typed exceptions
- Clear separation of concerns (route → service → database/email)
- Follows Next.js App Router conventions
- Comprehensive test coverage for success and error paths
- External dependencies mocked in tests (SMTP, database)

### Commit
- **Hash:** fbf036c
- **Message:** `feat: implement forgot password request endpoint`
- **Changes:** 2 files changed, 176 insertions(+)

### Success Criteria Met
✅ Route file created at correct path
✅ POST handler with correct signature
✅ Email input validation (required, string)
✅ Email normalization (trim, lowercase)
✅ Calls ForgotPasswordService.requestReset()
✅ Sends email via EmailService
✅ Proper error handling (400, 404, 500)
✅ Correct HTTP status codes returned
✅ Returns 200 with `{ ok: true, message: ... }` on success
✅ Integration tests pass (all 3 new tests)
✅ Commit message follows convention
