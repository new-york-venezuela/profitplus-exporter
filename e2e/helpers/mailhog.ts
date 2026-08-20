interface MailhogMessage {
  Content: {
    Headers: { To?: string[] };
    Body: string;
  };
}

interface MailhogResponse {
  items: MailhogMessage[];
}

const MAILHOG_API = 'http://localhost:8025/api/v2';

export async function clearMailhog(): Promise<void> {
  await fetch(`${MAILHOG_API}/messages`, { method: 'DELETE' });
}

export async function waitForResetEmail(to: string, timeoutMs = 10_000): Promise<{ resetUrl: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${MAILHOG_API}/messages`);
    const data = (await res.json()) as MailhogResponse;

    const match = data.items.find(m => (m.Content.Headers.To ?? []).some(h => h.includes(to)));
    if (match) {
      // Quoted-printable soft-wraps a line by ending it with a bare `=`
      // immediately before the CRLF; strip those first so an encoded byte
      // (or the URL itself) that got wrapped mid-token is rejoined.
      const unwrapped = match.Content.Body.replace(/=\r?\n/g, '');
      // Decode quoted-printable `=XX` hex escapes (e.g. `=3D` -> `=`), then
      // Handlebars' default HTML-escaping of `{{resetUrl}}` (`&#x3D;` -> `=`,
      // `&amp;` -> `&`) — both must resolve before the href regex can match
      // a literal `?token=`.
      const decoded = unwrapped
        .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#x3D;/gi, '=')
        .replace(/&amp;/g, '&');
      const hrefMatch = decoded.match(/href="([^"]*\/password-reset\?token=[^"]*)"/);
      if (!hrefMatch) throw new Error('Reset email found but no reset link in body');
      return { resetUrl: hrefMatch[1] };
    }

    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(`Timed out waiting for reset email to ${to} after ${timeoutMs}ms`);
}
