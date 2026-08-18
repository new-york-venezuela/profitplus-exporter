# Task 10: Update Environment Configuration

## Responsibility

Add SMTP and password reset configuration to `.env.example` so users know what environment variables to set.

## Files

- **Modify:** `.env.example`

## What to build

Add a new section to `.env.example` after the existing JWT/Auth section:

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

**Placement:**
- Add after the JWT_EXPIRY_DAYS line
- Before any other app config

**No code changes needed** — just environment documentation.

## Testing

No tests needed for this task (it's configuration documentation).

## Success criteria

- `.env.example` file modified
- New SMTP section added with all 6 variables
- New Password Reset section added with 2 variables
- Comments explain each section
- Exact values match the brief above
- Commit with message: `chore: add SMTP and password reset config to .env.example`

## Interfaces produced

- Environment variables documented for:
  - SMTP configuration (host, port, user, password, from name/email)
  - Password reset configuration (token expiry, app URL)

