# Task 4: EmailService

## Responsibility

Service for email templating and SMTP delivery. Loads Handlebars templates, injects data, and sends via nodemailer. No knowledge of what the email is for—just abstract delivery.

## Files

- **Create:** `lib/services/email-service.ts`
- **Create:** `__tests__/unit/services/email-service.test.ts`

## What to build

A class `EmailService` with one async method:

```typescript
send(to: string, templateName: string, data: Record<string, string>): Promise<void>
```

**Logic:**
1. Build template file path: `src/lib/email/templates/${templateName}.hbs`
2. Read file from disk using `fs.readFileSync(templatePath, 'utf-8')`
3. Compile Handlebars template: `Handlebars.compile(templateContent)`
4. Render template with data: `template(data)`
5. Send via SMTP:
   - Create nodemailer transporter with:
     - `host`: `process.env.SMTP_HOST`
     - `port`: `parseInt(process.env.SMTP_PORT || '587')`
     - `secure`: true if port is 465, false otherwise
     - `auth`: { user: `SMTP_USER`, pass: `SMTP_PASSWORD` }
   - Call `transporter.sendMail()` with:
     - `from`: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`
     - `to`: recipient email
     - `subject`: determined by template name (e.g., 'password-reset' → 'Reset Your Password')
     - `html`: rendered HTML
6. Return (no value)

**Error handling:**
- If template file not found (ENOENT): throw `TemplateNotFoundError(templateName)`
- If SMTP fails: throw `SMTPError` with the original error message appended
- Other errors: throw `SMTPError`

**Constructor:**
- Constructor should initialize transporter in `__init__` or inline
- Transporter is instance property (not static), created once per EmailService instance

## Imports needed

```typescript
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { SMTPError, TemplateNotFoundError } from '@/lib/errors/password-reset';
```

## Template Subject Mapping

Implement a private method or property to map template names to email subjects:

```typescript
private getSubjectForTemplate(templateName: string): string {
  const subjects: Record<string, string> = {
    'password-reset': 'Reset Your Password',
  };
  return subjects[templateName] || 'Email from ProfitPlus Exporter';
}
```

## Testing

Write tests that verify:
1. Email sent with rendered template when file exists
2. `TemplateNotFoundError` thrown when template file doesn't exist
3. `SMTPError` thrown when sendMail fails
4. Template is compiled with data (check html content in sendMail call)

Mock `nodemailer`, `fs.readFileSync()`, and `Handlebars.compile()` in tests.

## Success criteria

- EmailService class defined and exported
- `send()` method matches signature exactly
- Constructor initializes nodemailer transporter
- Loads template from `src/lib/email/templates/${name}.hbs`
- Compiles Handlebars with data
- Throws `TemplateNotFoundError` for missing templates
- Throws `SMTPError` for SMTP failures
- Sends via nodemailer.sendMail()
- Tests pass (verify with `npm test`)
- Commit with message: `feat: implement EmailService with Handlebars templating`

## Interfaces used from prior tasks

**Consumed:**
- `SMTPError`, `TemplateNotFoundError` from Task 1

**Produces:**
- `EmailService` class with `send(to, templateName, data)` method

## Environment variables required

- `SMTP_HOST`
- `SMTP_PORT` (default 587)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`

These will be added to `.env.example` in Task 10.

