# Task 1: Error Classes

## Responsibility

Create custom error classes for password reset flows. These are foundational — all services and routes will throw and catch these errors.

## Files

- **Create:** `lib/errors/password-reset.ts`

## What to build

A module exporting six error classes, all extending a base `PasswordResetError`:

1. **PasswordResetError** — base class with `statusCode` (number) and `message` (string). Extends Error. Set `this.name` and `Object.setPrototypeOf()` for proper error chain.

2. **InvalidCredentialError** — 401 status. Default message: `"Current password is incorrect"`. Thrown when password verification fails.

3. **InvalidEmailError** — 404 status. Default message: `"Email not found"`. Thrown when email lookup fails (used by ForgotPasswordService).

4. **TokenExpiredError** — 401 status. Default message: `"Token expired or invalid"`. Thrown when JWT verification fails.

5. **SMTPError** — 500 status. Default message: `"Failed to send email"`. Thrown when email delivery fails.

6. **TemplateNotFoundError** — 500 status. Constructor takes `templateName` string; message: `"Email template not found: {templateName}"`. Thrown when email template file doesn't exist.

## Code spec

```typescript
export class PasswordResetError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, PasswordResetError.prototype);
  }
}

export class InvalidCredentialError extends PasswordResetError {
  constructor(message = 'Current password is incorrect') {
    super(401, message);
    Object.setPrototypeOf(this, InvalidCredentialError.prototype);
  }
}

export class InvalidEmailError extends PasswordResetError {
  constructor(message = 'Email not found') {
    super(404, message);
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

export class TokenExpiredError extends PasswordResetError {
  constructor(message = 'Token expired or invalid') {
    super(401, message);
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

export class SMTPError extends PasswordResetError {
  constructor(message = 'Failed to send email') {
    super(500, message);
    Object.setPrototypeOf(this, SMTPError.prototype);
  }
}

export class TemplateNotFoundError extends PasswordResetError {
  constructor(templateName: string) {
    super(500, `Email template not found: ${templateName}`);
    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
  }
}
```

## Testing

Write a test file `__tests__/unit/errors/password-reset.test.ts` that verifies:
1. Each error class instantiates and has the correct statusCode
2. Each error class has the correct default message
3. Custom messages override defaults
4. Each error's `instanceof` checks work (inheritance chain)

## Success criteria

- All 6 error classes defined and exported
- statusCode and message properties match the spec exactly
- Tests pass (verify with `npm test`)
- Commit with message: `feat: add password reset error classes`

