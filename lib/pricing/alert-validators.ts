import type { Valid } from './validators';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 50;
const MAX_EMAIL_LENGTH = 120;
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function validateAlertSettingsBody(
  body: unknown,
): Valid<{ enabled: boolean; daysAhead: number; recipients: string[] | null }> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('Solicitud inválida');
  const b = body as Record<string, unknown>;
  if (typeof b.enabled !== 'boolean') return fail('Indica si las alertas están activadas');
  if (typeof b.daysAhead !== 'number' || !Number.isInteger(b.daysAhead) || b.daysAhead < 1 || b.daysAhead > 60) {
    return fail('Los días de anticipación deben ser un entero entre 1 y 60');
  }
  let recipients: string[] | null = null;
  if (b.recipients !== null && b.recipients !== undefined) {
    if (!Array.isArray(b.recipients) || b.recipients.length > MAX_RECIPIENTS) {
      return fail(`Los destinatarios deben ser una lista de hasta ${MAX_RECIPIENTS} correos`);
    }
    const seen = new Set<string>();
    for (const r of b.recipients) {
      const e = typeof r === 'string' ? r.trim().toLowerCase() : '';
      if (e.length === 0 || e.length > MAX_EMAIL_LENGTH || !EMAIL.test(e)) return fail('Hay un correo de destinatario inválido');
      seen.add(e);
    }
    recipients = [...seen];
  }
  return { ok: true, value: { enabled: b.enabled, daysAhead: b.daysAhead, recipients } };
}
