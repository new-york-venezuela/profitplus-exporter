# Task 1 Review Package

## Commits

0fcdf03 feat: add password reset error classes

## Diff stat

```
__tests__/unit/errors/password-reset.test.ts | 147 ++++++++++++++++++++++++++++++
 lib/errors/password-reset.ts                 |  45 ++++++++
 package.json                                 |   1 +
 3 files changed, 193 insertions(+)
```

## Full diff

```diff
diff --git a/__tests__/unit/errors/password-reset.test.ts b/__tests__/unit/errors/password-reset.test.ts
new file mode 100644
index 0000000..3d0253a
--- /dev/null
+++ b/__tests__/unit/errors/password-reset.test.ts
@@ -0,0 +1,147 @@
+import { describe, test, expect } from 'bun:test';
+import {
+  PasswordResetError,
+  InvalidCredentialError,
+  InvalidEmailError,
+  TokenExpiredError,
+  SMTPError,
+  TemplateNotFoundError,
+} from '../../../lib/errors/password-reset';
+
+describe('PasswordResetError', () => {
+  test('instantiates with statusCode and message', () => {
+    const error = new PasswordResetError(400, 'Test error');
+    expect(error.statusCode).toBe(400);
+    expect(error.message).toBe('Test error');
+    expect(error.name).toBe('PasswordResetError');
+  });
+
+  test('instanceof checks work for base class', () => {
+    const error = new PasswordResetError(400, 'Test');
+    expect(error instanceof PasswordResetError).toBe(true);
+    expect(error instanceof Error).toBe(true);
+  });
+});
+
+describe('InvalidCredentialError', () => {
+  test('instantiates with correct statusCode', () => {
+    const error = new InvalidCredentialError();
+    expect(error.statusCode).toBe(401);
+  });
+
+  test('has correct default message', () => {
+    const error = new InvalidCredentialError();
+    expect(error.message).toBe('Current password is incorrect');
+  });
+
+  test('custom message overrides default', () => {
+    const error = new InvalidCredentialError('Custom credential error');
+    expect(error.message).toBe('Custom credential error');
+  });
+
+  test('instanceof checks work', () => {
+    const error = new InvalidCredentialError();
+    expect(error instanceof InvalidCredentialError).toBe(true);
+    expect(error instanceof PasswordResetError).toBe(true);
+    expect(error instanceof Error).toBe(true);
+  });
+});
+
+describe('InvalidEmailError', () => {
+  test('instantiates with correct statusCode', () => {
+    const error = new InvalidEmailError();
+    expect(error.statusCode).toBe(404);
+  });
+
+  test('has correct default message', () => {
+    const error = new InvalidEmailError();
+    expect(error.message).toBe('Email not found');
+  });
+
+  test('custom message overrides default', () => {
+    const error = new InvalidEmailError('Custom email error');
+    expect(error.message).toBe('Custom email error');
+  });
+
+  test('instanceof checks work', () => {
+    const error = new InvalidEmailError();
+    expect(error instanceof InvalidEmailError).toBe(true);
+    expect(error instanceof PasswordResetError).toBe(true);
+    expect(error instanceof Error).toBe(true);
+  });
+});
+
+describe('TokenExpiredError', () => {
+  test('instantiates with correct statusCode', () => {
+    const error = new TokenExpiredError();
+    expect(error.statusCode).toBe(401);
+  });
+
+  test('has correct default message', () => {
+    const error = new TokenExpiredError();
+    expect(error.message).toBe('Token expired or invalid');
+  });
+
+  test('custom message overrides default', () => {
+    const error = new TokenExpiredError('Custom token error');
+    expect(error.message).toBe('Custom token error');
+  });
+
+  test('instanceof checks work', () => {
+    const error = new TokenExpiredError();
+    expect(error instanceof TokenExpiredError).toBe(true);
+    expect(error instanceof PasswordResetError).toBe(true);
+    expect(error instanceof Error).toBe(true);
+  });
+});
+
+describe('SMTPError', () => {
+  test('instantiates with correct statusCode', () => {
+    const error = new SMTPError();
+    expect(error.statusCode).toBe(500);
+  });
+
+  test('has correct default message', () => {
+    const error = new SMTPError();
+    expect(error.message).toBe('Failed to send email');
+  });
+
+  test('custom message overrides default', () => {
+    const error = new SMTPError('Custom SMTP error');
+    expect(error.message).toBe('Custom SMTP error');
+  });
+
+  test('instanceof checks work', () => {
+    const error = new SMTPError();
+    expect(error instanceof SMTPError).toBe(true);
+    expect(error instanceof PasswordResetError).toBe(true);
+    expect(error instanceof Error).toBe(true);
+  });
+});
+
+describe('TemplateNotFoundError', () => {
+  test('instantiates with correct statusCode', () => {
+    const error = new TemplateNotFoundError('reset.hbs');
+    expect(error.statusCode).toBe(500);
+  });
+
+  test('constructs message with template name', () => {
+    const error = new TemplateNotFoundError('reset.hbs');
+    expect(error.message).toBe('Email template not found: reset.hbs');
+  });
+
+  test('works with different template names', () => {
+    const error1 = new TemplateNotFoundError('confirm.hbs');
+    expect(error1.message).toBe('Email template not found: confirm.hbs');
+
+    const error2 = new TemplateNotFoundError('welcome.hbs');
+    expect(error2.message).toBe('Email template not found: welcome.hbs');
+  });
+
+  test('instanceof checks work', () => {
+    const error = new TemplateNotFoundError('reset.hbs');
+    expect(error instanceof TemplateNotFoundError).toBe(true);
+    expect(error instanceof PasswordResetError).toBe(true);
+    expect(error instanceof Error).toBe(true);
+  });
+});
+
+diff --git a/lib/errors/password-reset.ts b/lib/errors/password-reset.ts
+new file mode 100644
+index 0000000..4a4528c
+--- /dev/null
++++ b/lib/errors/password-reset.ts
+@@ -0,0 +1,45 @@
++export class PasswordResetError extends Error {
++  constructor(
++    public statusCode: number,
++    message: string
++  ) {
++    super(message);
++    this.name = this.constructor.name;
++    Object.setPrototypeOf(this, PasswordResetError.prototype);
++  }
++}
++
++export class InvalidCredentialError extends PasswordResetError {
++  constructor(message = 'Current password is incorrect') {
++    super(401, message);
++    Object.setPrototypeOf(this, InvalidCredentialError.prototype);
++  }
++}
++
++export class InvalidEmailError extends PasswordResetError {
++  constructor(message = 'Email not found') {
++    super(404, message);
++    Object.setPrototypeOf(this, InvalidEmailError.prototype);
++  }
++}
++
++export class TokenExpiredError extends PasswordResetError {
++  constructor(message = 'Token expired or invalid') {
++    super(401, message);
++    Object.setPrototypeOf(this, TokenExpiredError.prototype);
++  }
++}
++
++export class SMTPError extends PasswordResetError {
++  constructor(message = 'Failed to send email') {
++    super(500, message);
++    Object.setPrototypeOf(this, SMTPError.prototype);
++  }
++}
++
++export class TemplateNotFoundError extends PasswordResetError {
++  constructor(templateName: string) {
++    super(500, `Email template not found: ${templateName}`);
++    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
++  }
++}
+
+diff --git a/package.json b/package.json
+index 44074c5..79175a4 100644
+--- a/package.json
++++ b/package.json
+@@ -1,20 +1,21 @@
+ {
+   "name": "kigali-scaffold",
+   "version": "0.1.0",
+   "private": true,
+   "scripts": {
+     "dev": "bun --bun run next dev",
+     "debug": "bun --bun next dev  --inspect",
+     "build": "bun --bun run next build",
+     "start": "bun --bun run next start",
+     "lint": "eslint",
++    "test": "bun test",
+     "seed": "bun --bun run scripts/seed.ts",
+     "migrate": "bun --bun run scripts/migrate.ts",
+     "db:generate": "drizzle-kit generate",
+     "db:studio": "drizzle-kit studio"
+   },
```

## Implementer report

Read: `.superpowers/sdd/2026-08-17-password-management/task-1-report.md`
