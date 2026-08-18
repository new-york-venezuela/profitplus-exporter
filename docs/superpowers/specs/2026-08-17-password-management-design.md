# Password Management System Design
**Date:** 2026-08-17  
**Scope:** Password reset (authenticated) and forgot password (unauthenticated) workflows with email delivery

---

## Overview

Two independent user flows for password management:
1. **Authenticated reset** — user changes password with current password verification
2. **Forgot password** — unauthenticated user requests reset link via email, resets via token

Both flows delegate to service classes with clear interfaces, decoupling business logic from HTTP routing. Email delivery is abstracted—templates and SMTP configuration centralized.

---

## Architecture

### Service Layer

Three focused services, each with one responsibility:

#### `PasswordResetService`
**Authenticated password change.**

```typescript
interface PasswordResetService {
  reset(userId: string, currentPassword: string, newPassword: string): Promise<void>
    // Throws: InvalidCredentialError, DatabaseError
}
```

- Fetch user from DB by `userId`
- Verify `currentPassword` against stored hash (bcrypt)
- Hash `newPassword` with bcrypt
- Update user row in DB
- Throw `InvalidCredentialError` if current password is wrong

**No side effects** (no email, no token generation). Test with mocked database.

---

#### `ForgotPasswordService`
**Generate password reset JWT and initiate email flow.**

```typescript
interface ForgotPasswordService {
  requestReset(email: string): Promise<{ token: string; resetUrl: string }>
    // Throws: InvalidEmailError, DatabaseError
}
```

- Look up user by email in DB
- Generate JWT: `{ sub: userId, aud: 'password-reset', iat, exp: now + 15min }`
- Sign with `JWT_SECRET` (reuse existing session infrastructure)
- Construct reset URL: `https://app.com/auth/password-reset?token=[JWT]`
- Return token + URL (caller decides whether to email)
- Throw `InvalidEmailError` if email not found (same as login—no user enumeration)

**Does not send email.** That's the caller's job. Keeps this service testable without SMTP mocking.

---

#### `EmailService`
**Template rendering and SMTP delivery.**

```typescript
interface EmailService {
  send(to: string, templateName: string, data: Record<string, string>): Promise<void>
    // Throws: TemplateNotFoundError, SMTPError
}
```

- Load template by name from `src/lib/email/templates/`
- Compile with Handlebars (or similar)
- Inject `data` into compiled template
- Send via SMTP (nodemailer or similar)
- Throw specific errors for missing templates and delivery failures

**Templates use simple placeholders:** `{{ userName }}`, `{{ resetUrl }}`, etc.

---

### HTTP Routes

#### `POST /api/auth/password-reset` (authenticated)
**Change password for logged-in user.**

```
POST /api/auth/password-reset
Cookie: session=<JWT>
Body: { currentPassword: string, newPassword: string }

200 OK: { ok: true }
400 Bad Request: { error: "Validation failed" }
401 Unauthorized: { error: "Current password is incorrect" }
401 Unauthorized (no session): { error: "Authentication required" }
500 Server Error: { error: "Database error" }
```

- Extract `userId` from session token
- Call `PasswordResetService.reset(userId, currentPassword, newPassword)`
- Catch `InvalidCredentialError` → 401 "Current password incorrect"
- Return 200 on success

---

#### `POST /api/auth/password-reset-request` (unauthenticated)
**Request password reset email.**

```
POST /api/auth/password-reset-request
Body: { email: string }

200 OK: { ok: true, message: "Check your email" }
400 Bad Request: { error: "Email is required" }
404 Not Found: { error: "Email not found" }
500 Server Error: { error: "Failed to send email" }
```

- Validate `email` format
- Call `ForgotPasswordService.requestReset(email)`
- Get back `{ token, resetUrl }`
- Call `EmailService.send(email, 'password-reset', { userName, resetUrl })`
- Return 200 + message (same response whether email exists or not—privacy)
- Catch `SMTPError` → 500 (user sees generic "email failed" message)

---

#### `GET /api/auth/password-reset/verify` (unauthenticated)
**Validate reset token (called by front-end before showing form).**

```
GET /api/auth/password-reset/verify?token=<JWT>

200 OK: { valid: true, email: "user@example.com" }
400 Bad Request: { error: "Token is required" }
401 Unauthorized: { error: "Token expired or invalid" }
```

- Extract token from query param
- Verify JWT signature + expiry + audience (`password-reset`)
- Extract `userId` from `sub` claim
- Fetch user by `userId`, return their email
- Throw on invalid/expired token → 401

---

#### `POST /api/auth/password-reset/[token]` (unauthenticated)
**Submit new password with reset token.**

```
POST /api/auth/password-reset/[token]
Body: { newPassword: string }

200 OK: { ok: true, message: "Password reset successful" }
400 Bad Request: { error: "Validation failed" }
401 Unauthorized: { error: "Token expired or invalid" }
500 Server Error: { error: "Database error" }
```

- Extract token from URL path (or query param—decide on one)
- Verify JWT signature + expiry + audience
- Extract `userId` from `sub` claim
- Hash `newPassword`
- Update user row in DB by `userId`
- Return 200 on success
- No token revocation needed (JWT is time-bounded)

---

### Database Schema

Add to `schema.ts`:

```typescript
// No new table required—password reset uses JWT tokens.
// Existing `users` table stores passwordHash (already in place).
```

Tokens are stateless; no database table needed. Signature verification is sufficient.

---

### Email Templates

**Location:** `src/lib/email/templates/password-reset.hbs`

```handlebars
Hello {{ userName }},

We received a request to reset your password. If you didn't make this request, you can ignore this email.

To reset your password, click the link below (valid for 15 minutes):

{{ resetUrl }}

If the link doesn't work, paste this into your browser:
{{ resetUrlPlain }}

This link expires in 15 minutes for security.

—  
ProfitPlus Exporter Team
```

Simple string replacement is fine; Handlebars adds minimal overhead for future multi-language support.

---

### Error Handling

**Custom error classes:**

```typescript
class PasswordResetError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class InvalidCredentialError extends PasswordResetError {
  constructor(message = 'Invalid credentials') {
    super(401, message);
  }
}

class InvalidEmailError extends PasswordResetError {
  constructor(message = 'Email not found') {
    super(404, message);
  }
}

class TokenExpiredError extends PasswordResetError {
  constructor(message = 'Token expired or invalid') {
    super(401, message);
  }
}

class SMTPError extends PasswordResetError {
  constructor(message = 'Failed to send email') {
    super(500, message);
  }
}
```

Routes catch these and return appropriate HTTP responses. No generic "internal server error" leaks service details.

---

### Testing Strategy

**Unit tests** (no external dependencies):
- `PasswordResetService`: mocked DB, verify password hash comparison
- `ForgotPasswordService`: mocked DB, verify JWT generation + expiry
- `EmailService`: mocked SMTP client, verify template rendering

**Integration tests**:
- `POST /api/auth/password-reset`: real session, real DB
- `POST /api/auth/password-reset-request`: real DB, mocked SMTP
- `POST /api/auth/password-reset/[token]`: real DB, valid/expired/invalid tokens

**No tests needed** for successful SMTP delivery (mocked); test the error path instead.

---

### Configuration

**Environment variables** (add to `.env.example`):

```env
# ─── Email (SMTP) ──────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=changeme
SMTP_FROM_NAME=ProfitPlus Exporter
SMTP_FROM_EMAIL=noreply@example.com

# ─── Password Reset ────────────────────────────────────
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=15
```

Reuse existing `JWT_SECRET` for signing reset tokens.

---

## Implementation Order

1. Define error classes
2. Implement `PasswordResetService` + unit tests
3. Implement `ForgotPasswordService` + unit tests
4. Implement `EmailService` + unit tests (mock SMTP)
5. Create `POST /api/auth/password-reset` route
6. Create `POST /api/auth/password-reset-request` route
7. Create `GET /api/auth/password-reset/verify` route
8. Create `POST /api/auth/password-reset/[token]` route
9. Add email template
10. Create integration tests
11. Front-end: forgot password form, reset form, success feedback

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **JWT tokens in URL** | Short-lived (15 min), no DB cleanup, fits existing session pattern. URL length acceptable. |
| **No email on password change** | Reduces complexity; can add notification later as a feature flag. |
| **No rate limiting** | Internal tool; can add if abuse patterns emerge. |
| **Services don't send email** | Decouples business logic from I/O. Routes compose services. Unit tests don't mock SMTP. |
| **Same error for nonexistent emails** | Prevents user enumeration attacks (consistent with login endpoint). |
| **Handlebars templates** | Minimal overhead, supports future i18n. |

