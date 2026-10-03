import { isValidIsoDate } from './dates';
import type { Valid } from './validators';

export type CreatePromotionInput =
  | { kind: 'overlay'; name: string; reason: string | null; coPrecio: string; startsOn: string; endsOn: string; items: { coArt: string; monto: number }[] }
  | { kind: 'segment'; name: string; reason: string | null; baseCoPrecio: string; customerCodes: string[]; startsOn: string; endsOn: string; items: { coArt: string; monto: number }[] };
export type PatchPromotionInput = { action: 'cancel' } | { action: 'change_end'; endsOn: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const obj = (b: unknown): b is Record<string, unknown> => typeof b === 'object' && b !== null && !Array.isArray(b);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null);

export function validateCreatePromotionBody(body: unknown, today: string): Valid<CreatePromotionInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  if (body.kind !== 'overlay' && body.kind !== 'segment') return fail('Tipo de promoción inválido');
  const name = str(body.name, 40);
  if (!name) return fail('El nombre es requerido (máx. 40 caracteres)');
  let reason: string | null = null;
  if (body.reason !== undefined && body.reason !== null && body.reason !== '') {
    if (typeof body.reason !== 'string' || body.reason.trim().length > 200) return fail('El motivo no puede exceder 200 caracteres');
    reason = body.reason.trim() || null;
  }
  if (!isValidIsoDate(body.startsOn) || body.startsOn < today) return fail('La fecha de inicio no puede ser anterior a hoy');
  if (!isValidIsoDate(body.endsOn) || body.endsOn < body.startsOn) return fail('La fecha de fin no puede ser anterior al inicio');
  const startsOn = body.startsOn;
  const endsOn = body.endsOn;

  if (!Array.isArray(body.items) || body.items.length === 0) return fail('Agregue al menos un artículo');
  if (body.items.length > 200) return fail('Demasiados artículos (máx. 200)');
  const seen = new Set<string>();
  const items: { coArt: string; monto: number }[] = [];
  for (const it of body.items) {
    if (!obj(it)) return fail('Artículo inválido');
    const coArt = str(it.coArt, 30);
    if (!coArt) return fail('Código de artículo inválido');
    const key = coArt.toUpperCase();
    if (seen.has(key)) return fail(`Artículo repetido: ${coArt}`);
    seen.add(key);
    const m = it.monto;
    if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0 || m > 1e9) return fail(`Precio inválido para ${coArt}`);
    if (Math.abs(Math.round(m * 1e5) / 1e5 - m) > 1e-9) return fail(`Demasiados decimales para ${coArt} (máx. 5)`);
    items.push({ coArt, monto: m });
  }

  if (body.kind === 'overlay') {
    const coPrecio = str(body.coPrecio, 6);
    if (!coPrecio) return fail('Lista de precios requerida');
    return { ok: true, value: { kind: 'overlay', name, reason, coPrecio, startsOn, endsOn, items } };
  }
  const baseCoPrecio = str(body.baseCoPrecio, 6);
  if (!baseCoPrecio) return fail('Lista base requerida');
  if (!Array.isArray(body.customerCodes) || body.customerCodes.length === 0) return fail('Seleccione al menos un cliente');
  if (body.customerCodes.length > 500) return fail('Demasiados clientes (máx. 500)');
  const seenC = new Set<string>();
  const customerCodes: string[] = [];
  for (const c of body.customerCodes) {
    const code = str(c, 16);
    if (!code) return fail('Código de cliente inválido');
    const key = code.toUpperCase();
    if (seenC.has(key)) return fail(`Cliente repetido: ${code}`);
    seenC.add(key);
    customerCodes.push(code);
  }
  return { ok: true, value: { kind: 'segment', name, reason, baseCoPrecio, customerCodes, startsOn, endsOn, items } };
}

export function validatePatchPromotionBody(body: unknown, today: string): Valid<PatchPromotionInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  if (body.action === 'cancel') return { ok: true, value: { action: 'cancel' } };
  if (body.action === 'change_end') {
    if (!isValidIsoDate(body.endsOn) || body.endsOn < today) return fail('La fecha de fin no puede ser anterior a hoy');
    return { ok: true, value: { action: 'change_end', endsOn: body.endsOn } };
  }
  return fail('Acción inválida');
}
