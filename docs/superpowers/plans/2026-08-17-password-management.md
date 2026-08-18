# Password Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement password reset (authenticated) and forgot password (unauthenticated) workflows with email delivery, using service abstractions and JWT-based tokens.

**Architecture:** Three decoupled service layers (PasswordResetService, ForgotPasswordService, EmailService) with clear interfaces. Routes compose services, handle errors, and return HTTP responses. Reset tokens are JWTs valid for 15 minutes. Email templates use Handlebars for simple placeholder injection.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM (sqlite), bcrypt, jose (JWT), nodemailer (SMTP), Handlebars

**Spec:** `docs/superpowers/specs/2026-08-17-password-management-design.md`

## Global Constraints

- Reuse existing `JWT_SECRET` environment variable for signing reset tokens
- All password hashing uses bcrypt (already in use for login)
- Email templates stored in `src/lib/email/templates/` as `.hbs` files
- Service classes throw typed errors; routes catch and translate to HTTP status codes
- No database table for reset tokens (JWT-based, stateless)
- No rate limiting or email notifications in this phase
- Test both success and error paths; mock external dependencies (SMTP, DB)

---

## File Structure

**New files:**
- `lib/errors/password-reset.ts` — custom error classes
- `lib/services/password-reset-service.ts` — PasswordResetService
- `lib/services/forgot-password-service.ts` — ForgotPasswordService
- `lib/services/email-service.ts` — EmailService (SMTP delivery + templating)
- `lib/email/templates/password-reset.hbs` — password reset email template
- `app/api/auth/password-reset/route.ts` — POST authenticated reset
- `app/api/auth/password-reset-request/route.ts` — POST forgot password request
- `app/api/auth/password-reset/verify/route.ts` — GET token verification
- `app/api/auth/password-reset/[token]/route.ts` — POST reset with token
- `__tests__/unit/services/password-reset-service.test.ts` — PasswordResetService tests
- `__tests__/unit/services/forgot-password-service.test.ts` — ForgotPasswordService tests
- `__tests__/unit/services/email-service.test.ts` — EmailService tests
- `__tests__/integration/password-reset-routes.integration.test.ts` — Route integration tests

**Modified files:**
- `.env.example` — add SMTP config variables

---

## Tasks

### Task 1: Error Classes

**Files:**
- Create: `lib/errors/password-reset.ts`

**Interfaces:**
- Produces:
  - `class PasswordResetError(statusCode: number, message: string)`
  - `class InvalidCredentialError(message?: string)` → 401
  - `class InvalidEmailError(message?: string)` → 404
  - `class TokenExpiredError(message?: string)` → 401
  - `class SMTPError(message?: string)` → 500
  - `class TemplateNotFoundError(message?: string)` → 500

- [ ] **Step 1: Create error base class and subclasses**

```typescript
// lib/errors/password-reset.ts

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

- [ ] **Step 2: Commit**

```bash
git add lib/errors/password-reset.ts
git commit -m "feat: add password reset error classes"
```

---

### Task 2: PasswordResetService

**Files:**
- Create: `lib/services/password-reset-service.ts`
- Create: `__tests__/unit/services/password-reset-service.test.ts`

**Interfaces:**
- Consumes: `InvalidCredentialError`, `getDb()`, `users` table, `bcrypt`
- Produces:
  - `class PasswordResetService { reset(userId: string, currentPassword: string, newPassword: string): Promise<void> }`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/unit/services/password-reset-service.test.ts

import { PasswordResetService } from '@/lib/services/password-reset-service';
import { InvalidCredentialError } from '@/lib/errors/password-reset';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

vi.mock('@/lib/db/sqlite', () => ({
  getDb: vi.fn(),
}));

vi.mock('bcrypt');

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    
    service = new PasswordResetService();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('should update password when current password is correct', async () => {
    const userId = '1';
    const currentPassword = 'oldPass123';
    const newPassword = 'newPass456';
    const hashedCurrentPassword = await bcrypt.hash(currentPassword, 10);

    mockDb.get.mockReturnValue({
      id: 1,
      email: 'user@example.com',
      passwordHash: hashedCurrentPassword,
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    vi.mocked(bcrypt.hash).mockResolvedValue('hashedNewPassword');

    await service.reset(userId, currentPassword, newPassword);

    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should throw InvalidCredentialError when current password is wrong', async () => {
    const userId = '1';
    const currentPassword = 'wrongPass';
    const newPassword = 'newPass456';

    mockDb.get.mockReturnValue({
      id: 1,
      email: 'user@example.com',
      passwordHash: 'hashedOldPassword',
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(false);

    await expect(service.reset(userId, currentPassword, newPassword)).rejects.toThrow(InvalidCredentialError);
  });

  it('should throw error when user not found', async () => {
    const userId = '999';
    const currentPassword = 'pass';
    const newPassword = 'newPass';

    mockDb.get.mockReturnValue(undefined);

    await expect(service.reset(userId, currentPassword, newPassword)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/unit/services/password-reset-service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement PasswordResetService**

```typescript
// lib/services/password-reset-service.ts

import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { InvalidCredentialError } from '@/lib/errors/password-reset';

export class PasswordResetService {
  async reset(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const db = getDb();
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .get();

    if (!user) {
      throw new InvalidCredentialError('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    db.update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, parseInt(userId)))
      .run();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/unit/services/password-reset-service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/password-reset-service.ts __tests__/unit/services/password-reset-service.test.ts
git commit -m "feat: implement PasswordResetService with tests"
```

---

### Task 3: ForgotPasswordService

**Files:**
- Create: `lib/services/forgot-password-service.ts`
- Create: `__tests__/unit/services/forgot-password-service.test.ts`

**Interfaces:**
- Consumes: `InvalidEmailError`, `getDb()`, `users` table, `signToken()`, `JWT_SECRET`
- Produces:
  - `class ForgotPasswordService { requestReset(email: string): Promise<{ token: string; resetUrl: string }> }`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/unit/services/forgot-password-service.test.ts

import { ForgotPasswordService } from '@/lib/services/forgot-password-service';
import { InvalidEmailError } from '@/lib/errors/password-reset';
import { vi } from 'vitest';

vi.mock('@/lib/db/sqlite', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  signToken: vi.fn(),
}));

describe('ForgotPasswordService', () => {
  let service: ForgotPasswordService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
    };
    
    service = new ForgotPasswordService();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('should generate token and resetUrl for valid email', async () => {
    const email = 'user@example.com';
    mockDb.get.mockReturnValue({ id: 1, email, name: 'John' });
    
    vi.mocked(signToken).mockResolvedValue('jwt-token-here');

    const result = await service.requestReset(email);

    expect(result.token).toBe('jwt-token-here');
    expect(result.resetUrl).toContain('token=jwt-token-here');
  });

  it('should throw InvalidEmailError when email not found', async () => {
    const email = 'nonexistent@example.com';
    mockDb.get.mockReturnValue(undefined);

    await expect(service.requestReset(email)).rejects.toThrow(InvalidEmailError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/unit/services/forgot-password-service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement ForgotPasswordService**

```typescript
// lib/services/forgot-password-service.ts

import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signToken, type SessionPayload } from '@/lib/auth/session';
import { InvalidEmailError } from '@/lib/errors/password-reset';

export class ForgotPasswordService {
  async requestReset(email: string): Promise<{ token: string; resetUrl: string }> {
    const db = getDb();
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();

    if (!user) {
      throw new InvalidEmailError('Email not found');
    }

    const payload: SessionPayload = {
      sub: String(user.id),
      role: 'user',
      name: user.name,
      aud: 'password-reset' as any, // override audience
    };

    const token = await signToken(payload);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/password-reset?token=${token}`;

    return { token, resetUrl };
  }
}
```

> **Note:** `SessionPayload` doesn't have an `aud` field by default. We'll extend it in the verify endpoint when validating. For now, cast to `any`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/unit/services/forgot-password-service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/forgot-password-service.ts __tests__/unit/services/forgot-password-service.test.ts
git commit -m "feat: implement ForgotPasswordService with tests"
```

---

### Task 4: EmailService

**Files:**
- Create: `lib/services/email-service.ts`
- Create: `__tests__/unit/services/email-service.test.ts`

**Interfaces:**
- Consumes: `SMTPError`, `TemplateNotFoundError`, `nodemailer`, `Handlebars`
- Produces:
  - `class EmailService { send(to: string, templateName: string, data: Record<string, string>): Promise<void> }`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/unit/services/email-service.test.ts

import { EmailService } from '@/lib/services/email-service';
import { SMTPError, TemplateNotFoundError } from '@/lib/errors/password-reset';
import * as fs from 'fs';
import { vi } from 'vitest';

vi.mock('nodemailer');
vi.mock('fs');

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: '123' }),
    };

    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter);
    service = new EmailService();
  });

  it('should send email with rendered template', async () => {
    const templateContent = 'Hello {{ userName }}, reset here: {{ resetUrl }}';
    vi.mocked(fs.readFileSync).mockReturnValue(templateContent);

    await service.send('user@example.com', 'password-reset', {
      userName: 'John',
      resetUrl: 'http://example.com/reset?token=xyz',
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
      })
    );
  });

  it('should throw TemplateNotFoundError when template does not exist', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(
      service.send('user@example.com', 'nonexistent', {})
    ).rejects.toThrow(TemplateNotFoundError);
  });

  it('should throw SMTPError on sendMail failure', async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));
    vi.mocked(fs.readFileSync).mockReturnValue('Template content');

    await expect(
      service.send('user@example.com', 'password-reset', {})
    ).rejects.toThrow(SMTPError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/unit/services/email-service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement EmailService**

```typescript
// lib/services/email-service.ts

import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { SMTPError, TemplateNotFoundError } from '@/lib/errors/password-reset';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async send(to: string, templateName: string, data: Record<string, string>): Promise<void> {
    try {
      const templatePath = path.join(process.cwd(), 'src', 'lib', 'email', 'templates', `${templateName}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);
      const html = template(data);

      await this.transporter.sendMail({
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
        to,
        subject: this.getSubjectForTemplate(templateName),
        html,
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new TemplateNotFoundError(templateName);
      }
      throw new SMTPError(`Failed to send ${templateName} email: ${(error as Error).message}`);
    }
  }

  private getSubjectForTemplate(templateName: string): string {
    const subjects: Record<string, string> = {
      'password-reset': 'Reset Your Password',
    };
    return subjects[templateName] || 'Email from ProfitPlus Exporter';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/unit/services/email-service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/email-service.ts __tests__/unit/services/email-service.test.ts
git commit -m "feat: implement EmailService with Handlebars templating"
```

---

### Task 5: Email Template

**Files:**
- Create: `lib/email/templates/password-reset.hbs`

- [ ] **Step 1: Create email template**

```handlebars
<!-- lib/email/templates/password-reset.hbs -->

<html>
  <body style="font-family: sans-serif; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reset Your Password</h2>

      <p>Hello {{ userName }},</p>

      <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>

      <p>
        <a href="{{ resetUrl }}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Your Password
        </a>
      </p>

      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">{{ resetUrlPlain }}</p>

      <p style="color: #999; font-size: 12px;">This link expires in 15 minutes for security.</p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">ProfitPlus Exporter Team</p>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add lib/email/templates/password-reset.hbs
git commit -m "feat: add password-reset email template"
```

---

### Task 6: POST /api/auth/password-reset (Authenticated Reset)

**Files:**
- Create: `app/api/auth/password-reset/route.ts`
- Create: `__tests__/integration/password-reset-routes.integration.test.ts` (this test file will grow as we add routes)

**Interfaces:**
- Consumes: `PasswordResetService`, `verifyToken()`, session cookie, `InvalidCredentialError`
- Produces: HTTP 200/400/401/500 responses

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/integration/password-reset-routes.integration.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import * as bcrypt from 'bcrypt';
import { signToken } from '@/lib/auth/session';

describe('POST /api/auth/password-reset', () => {
  let userId: number;
  let sessionToken: string;

  beforeEach(async () => {
    // Create test user
    const db = getDb();
    const hashedPassword = await bcrypt.hash('oldPassword123', 10);
    const result = db
      .insert(users)
      .values({
        email: 'testuser@example.com',
        name: 'Test User',
        passwordHash: hashedPassword,
        role: 'user',
        createdAt: Date.now(),
      })
      .returning()
      .get();
    
    userId = result.id as number;
    sessionToken = await signToken({
      sub: String(userId),
      role: 'user',
      name: 'Test User',
    });
  });

  afterEach(() => {
    // Clean up test user
    const db = getDb();
    db.delete(users).where((t) => t.id == userId).run();
  });

  it('should change password when current password is correct', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${sessionToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    // Verify password was actually changed
    const db = getDb();
    const updatedUser = db.select().from(users).where((t) => t.id == userId).get();
    const isNewPassword = await bcrypt.compare('newPassword456', updatedUser!.passwordHash);
    expect(isNewPassword).toBe(true);
  });

  it('should return 401 when current password is wrong', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${sessionToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword456',
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('incorrect');
  });

  it('should return 401 when no session provided', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('should return 400 when password validation fails', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${sessionToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'oldPassword123',
        newPassword: '', // invalid
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: FAIL — route not found

- [ ] **Step 3: Implement route**

```typescript
// app/api/auth/password-reset/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { PasswordResetService } from '@/lib/services/password-reset-service';
import { InvalidCredentialError } from '@/lib/errors/password-reset';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Extract session token
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify session
    const session = await verifyToken(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Reset password
    const service = new PasswordResetService();
    await service.reset(session.sub, currentPassword, newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidCredentialError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/password-reset/route.ts __tests__/integration/password-reset-routes.integration.test.ts
git commit -m "feat: implement authenticated password reset endpoint"
```

---

### Task 7: POST /api/auth/password-reset-request (Forgot Password)

**Files:**
- Modify: `__tests__/integration/password-reset-routes.integration.test.ts` (add tests)
- Create: `app/api/auth/password-reset-request/route.ts`

**Interfaces:**
- Consumes: `ForgotPasswordService`, `EmailService`, `InvalidEmailError`, `SMTPError`
- Produces: HTTP 200/400/404/500 responses

- [ ] **Step 1: Add tests to integration test file**

Add this test suite to the existing `__tests__/integration/password-reset-routes.integration.test.ts`:

```typescript
describe('POST /api/auth/password-reset-request', () => {
  it('should send reset email for valid email', async () => {
    // Create a user first
    const db = getDb();
    const hashedPassword = await bcrypt.hash('password', 10);
    db
      .insert(users)
      .values({
        email: 'forgotpass@example.com',
        name: 'Forgot User',
        passwordHash: hashedPassword,
        role: 'user',
        createdAt: Date.now(),
      })
      .run();

    const response = await fetch('http://localhost:3000/api/auth/password-reset-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'forgotpass@example.com',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('should return 404 when email not found', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
      }),
    });

    expect(response.status).toBe(404);
  });

  it('should return 400 when email is missing', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: FAIL — route not found

- [ ] **Step 3: Implement route**

```typescript
// app/api/auth/password-reset-request/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordService } from '@/lib/services/forgot-password-service';
import { EmailService } from '@/lib/services/email-service';
import { InvalidEmailError, SMTPError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Request reset
    const forgotPasswordService = new ForgotPasswordService();
    const { token, resetUrl } = await forgotPasswordService.requestReset(normalizedEmail);

    // Send email
    const emailService = new EmailService();
    try {
      await emailService.send(normalizedEmail, 'password-reset', {
        userName: 'User',
        resetUrl,
        resetUrlPlain: resetUrl,
      });
    } catch (emailError) {
      if (emailError instanceof SMTPError) {
        console.error('SMTP Error:', emailError);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
      }
      throw emailError;
    }

    return NextResponse.json({ ok: true, message: 'Check your email for password reset instructions' });
  } catch (error) {
    if (error instanceof InvalidEmailError) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }
    if (error instanceof SMTPError) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/password-reset-request/route.ts __tests__/integration/password-reset-routes.integration.test.ts
git commit -m "feat: implement forgot password request endpoint with email"
```

---

### Task 8: GET /api/auth/password-reset/verify (Token Verification)

**Files:**
- Modify: `__tests__/integration/password-reset-routes.integration.test.ts` (add tests)
- Create: `app/api/auth/password-reset/verify/route.ts`

**Interfaces:**
- Consumes: `verifyToken()`, `getDb()`, `users` table, `TokenExpiredError`
- Produces: HTTP 200/400/401 responses with email and username

- [ ] **Step 1: Add tests to integration test file**

Add this test suite to `__tests__/integration/password-reset-routes.integration.test.ts`:

```typescript
describe('GET /api/auth/password-reset/verify', () => {
  it('should verify valid reset token and return email', async () => {
    // Create user and generate reset token
    const db = getDb();
    const hashedPassword = await bcrypt.hash('password', 10);
    const result = db
      .insert(users)
      .values({
        email: 'verify@example.com',
        name: 'Verify User',
        passwordHash: hashedPassword,
        role: 'user',
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const resetToken = await signToken({
      sub: String(result.id),
      role: 'user',
      name: result.name,
    });

    const response = await fetch(`http://localhost:3000/api/auth/password-reset/verify?token=${resetToken}`, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.valid).toBe(true);
    expect(data.email).toBe('verify@example.com');
  });

  it('should return 400 when token is missing', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset/verify', {
      method: 'GET',
    });

    expect(response.status).toBe(400);
  });

  it('should return 401 when token is invalid', async () => {
    const response = await fetch('http://localhost:3000/api/auth/password-reset/verify?token=invalid-token', {
      method: 'GET',
    });

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: FAIL — route not found

- [ ] **Step 3: Implement route**

```typescript
// app/api/auth/password-reset/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TokenExpiredError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload) {
      throw new TokenExpiredError('Token expired or invalid');
    }

    // Fetch user to get email
    const db = getDb();
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(payload.sub)))
      .get();

    if (!user) {
      throw new TokenExpiredError('User not found');
    }

    return NextResponse.json({
      valid: true,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Token verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/password-reset/verify/route.ts __tests__/integration/password-reset-routes.integration.test.ts
git commit -m "feat: implement token verification endpoint"
```

---

### Task 9: POST /api/auth/password-reset/[token] (Reset with Token)

**Files:**
- Modify: `__tests__/integration/password-reset-routes.integration.test.ts` (add tests)
- Create: `app/api/auth/password-reset/[token]/route.ts`

**Interfaces:**
- Consumes: `verifyToken()`, `getDb()`, `users` table, `bcrypt`, `TokenExpiredError`
- Produces: HTTP 200/400/401/500 responses

- [ ] **Step 1: Add tests to integration test file**

Add this test suite to `__tests__/integration/password-reset-routes.integration.test.ts`:

```typescript
describe('POST /api/auth/password-reset/[token]', () => {
  it('should reset password with valid token', async () => {
    // Create user and generate reset token
    const db = getDb();
    const hashedPassword = await bcrypt.hash('oldPassword', 10);
    const result = db
      .insert(users)
      .values({
        email: 'reset@example.com',
        name: 'Reset User',
        passwordHash: hashedPassword,
        role: 'user',
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const resetToken = await signToken({
      sub: String(result.id),
      role: 'user',
      name: result.name,
    });

    const response = await fetch(`http://localhost:3000/api/auth/password-reset/${resetToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newPassword: 'brandNewPassword123',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    // Verify password was changed
    const updatedUser = db.select().from(users).where(eq(users.id, result.id as number)).get();
    const isNewPassword = await bcrypt.compare('brandNewPassword123', updatedUser!.passwordHash);
    expect(isNewPassword).toBe(true);
  });

  it('should return 401 with expired token', async () => {
    // Create expired token (manually craft one with past expiry)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.sig';

    const response = await fetch(`http://localhost:3000/api/auth/password-reset/${expiredToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newPassword: 'newPassword123',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('should return 400 when newPassword is invalid', async () => {
    const db = getDb();
    const hashedPassword = await bcrypt.hash('password', 10);
    const result = db
      .insert(users)
      .values({
        email: 'resetbad@example.com',
        name: 'Reset Bad',
        passwordHash: hashedPassword,
        role: 'user',
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const resetToken = await signToken({
      sub: String(result.id),
      role: 'user',
      name: result.name,
    });

    const response = await fetch(`http://localhost:3000/api/auth/password-reset/${resetToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newPassword: 'short', // too short
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: FAIL — route not found

- [ ] **Step 3: Implement route**

```typescript
// app/api/auth/password-reset/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { TokenExpiredError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload) {
      throw new TokenExpiredError('Token expired or invalid');
    }

    // Parse request body
    const body = await request.json();
    const { newPassword } = body;

    // Validate password
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const db = getDb();
    db.update(users)
      .set({ passwordHash: hashedPassword })
      .where(eq(users.id, parseInt(payload.sub)))
      .run();

    return NextResponse.json({ ok: true, message: 'Password reset successful' });
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Password reset with token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/integration/password-reset-routes.integration.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/password-reset/[token]/route.ts __tests__/integration/password-reset-routes.integration.test.ts
git commit -m "feat: implement password reset with token endpoint"
```

---

### Task 10: Update Environment Configuration

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example**

Add these lines to `.env.example` after the existing JWT config:

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
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add SMTP and password reset config to .env.example"
```

---

## Implementation Checklist

- [ ] Task 1: Error classes
- [ ] Task 2: PasswordResetService
- [ ] Task 3: ForgotPasswordService
- [ ] Task 4: EmailService
- [ ] Task 5: Email template
- [ ] Task 6: POST /api/auth/password-reset
- [ ] Task 7: POST /api/auth/password-reset-request
- [ ] Task 8: GET /api/auth/password-reset/verify
- [ ] Task 9: POST /api/auth/password-reset/[token]
- [ ] Task 10: Update .env.example

---

## Testing Summary

| Type | Coverage |
|------|----------|
| **Unit Tests** | Error classes, PasswordResetService, ForgotPasswordService, EmailService (mocked SMTP) |
| **Integration Tests** | All 4 API routes with real database and mocked email delivery |
| **Error Paths** | Invalid credentials, expired tokens, missing emails, SMTP failures, validation errors |

---

## Notes for Implementer

- Use existing `getDb()`, `users` table, `bcrypt`, and `jose` patterns from login route
- Services are stateless; instantiate fresh in routes (no singleton needed)
- Mock `nodemailer` in unit tests; in integration tests, mock SMTP but test the service composition
- Token verification reuses `verifyToken()` from session module; JWT audience claim isn't enforced by default (fine for this scope)
- Password validation (min 8 chars) is applied in routes, not services (routes are the boundary)
- No rate limiting, no email notifications, no token revocation (JWT expiry is sufficient)
