# Task 5: Email Template

## Responsibility

Create the password reset email template in Handlebars format. Used by EmailService to render and send reset link emails.

## Files

- **Create:** `lib/email/templates/password-reset.hbs`

## What to build

A Handlebars HTML email template with these placeholders (exact names):
- `{{ userName }}` — user's name
- `{{ resetUrl }}` — clickable reset link (full URL with token)
- `{{ resetUrlPlain }}` — plain text version of URL for copy/paste

**Template requirements:**
1. HTML email format (proper `<html>` tags)
2. Professional layout with clear call-to-action button
3. Include:
   - Greeting with user name
   - Explanation of the request
   - Big prominent button/link with "Reset Your Password"
   - Plain text copy of URL below button (for email clients that don't render HTML)
   - Note that link expires in 15 minutes
   - Footer with company name
4. Mobile-friendly responsive design (inline CSS OK)
5. No external CSS files or external image URLs

**Example structure (you can improve it):**

```html
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

## Template file location

Must be created at exact path: `lib/email/templates/password-reset.hbs`

The directory structure should be:
```
lib/
  email/
    templates/
      password-reset.hbs
```

Create intermediate directories if they don't exist.

## Testing

No test file needed for templates. EmailService tests already mock Handlebars template compilation and verify template loading.

## Success criteria

- Template file created at exact path `lib/email/templates/password-reset.hbs`
- Contains Handlebars placeholders: `{{ userName }}`, `{{ resetUrl }}`, `{{ resetUrlPlain }}`
- Valid HTML email format
- Includes call-to-action button
- Includes expiry disclaimer (15 minutes)
- Includes company footer
- Professional appearance
- Commit with message: `feat: add password-reset email template`

