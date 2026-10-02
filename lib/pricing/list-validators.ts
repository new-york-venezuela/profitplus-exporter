import { isValidIsoDate } from './dates';
import type { Valid } from './validators';

export type CreateListInput =
  | { mode: 'create'; desPrecio: string; coMone: string }
  | { mode: 'clone'; sourceCoPrecio: string; desPrecio: string; percent: number | null; effectiveFrom: string };
export interface ApplyRatesInput { effectiveFrom: string; changes: { coArt: string; monto: number }[] }
export interface RenameListInput { desPrecio: string; validador: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const obj = (b: unknown): b is Record<string, unknown> => typeof b === 'object' && b !== null && !Array.isArray(b);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null);
const VALIDADOR = /^0x[0-9a-fA-F]{16}$/;

export function validateCreateListBody(body: unknown, today: string): Valid<CreateListInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  const desPrecio = str(body.desPrecio, 60);
  if (!desPrecio) return fail('El nombre de la lista es requerido (máx. 60 caracteres)');
  if (body.mode === 'create') {
    const coMone = str(body.coMone, 6);
    if (!coMone) return fail('Moneda requerida');
    return { ok: true, value: { mode: 'create', desPrecio, coMone } };
  }
  if (body.mode === 'clone') {
    const sourceCoPrecio = str(body.sourceCoPrecio, 6);
    if (!sourceCoPrecio) return fail('Lista de origen requerida');
    let percent: number | null = null;
    if (body.percent !== null && body.percent !== undefined) {
      if (typeof body.percent !== 'number' || !Number.isFinite(body.percent) || body.percent <= -100 || body.percent > 1000) return fail('Porcentaje inválido');
      percent = body.percent;
    }
    if (!isValidIsoDate(body.effectiveFrom) || body.effectiveFrom < today) return fail('La fecha de inicio no puede ser anterior a hoy');
    return { ok: true, value: { mode: 'clone', sourceCoPrecio, desPrecio, percent, effectiveFrom: body.effectiveFrom } };
  }
  return fail('Modo inválido');
}

export function validateApplyRatesBody(body: unknown, today: string): Valid<ApplyRatesInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  if (!isValidIsoDate(body.effectiveFrom) || body.effectiveFrom < today) return fail('La fecha de vigencia no puede ser anterior a hoy');
  if (!Array.isArray(body.changes) || body.changes.length === 0) return fail('No hay cambios para aplicar');
  if (body.changes.length > 500) return fail('Demasiados cambios en una sola solicitud (máx. 500)');
  const seen = new Set<string>();
  const changes: { coArt: string; monto: number }[] = [];
  for (const c of body.changes) {
    if (!obj(c)) return fail('Cambio inválido');
    const coArt = str(c.coArt, 30);
    if (!coArt) return fail('Código de artículo inválido');
    if (seen.has(coArt)) return fail(`Artículo repetido: ${coArt}`);
    seen.add(coArt);
    if (typeof c.monto !== 'number' || !Number.isFinite(c.monto) || c.monto <= 0 || c.monto > 1e9) return fail(`Precio inválido para ${coArt}`);
    if (Math.abs(Math.round(c.monto * 1e5) / 1e5 - c.monto) > 1e-9) return fail(`Demasiados decimales para ${coArt} (máx. 5)`);
    changes.push({ coArt, monto: c.monto });
  }
  return { ok: true, value: { effectiveFrom: body.effectiveFrom, changes } };
}

export function validateRenameListBody(body: unknown): Valid<RenameListInput> {
  if (!obj(body)) return fail('Solicitud inválida');
  const desPrecio = str(body.desPrecio, 60);
  if (!desPrecio) return fail('Nombre inválido (máx. 60 caracteres)');
  if (typeof body.validador !== 'string' || !VALIDADOR.test(body.validador)) return fail('Token de concurrencia inválido');
  return { ok: true, value: { desPrecio, validador: body.validador } };
}
