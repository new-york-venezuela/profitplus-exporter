import { daysBetweenIso, isValidIsoDate } from './dates';

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type CreateSegmentInput =
  | { kind: 'group'; desTipo: string; coPrecio: string }
  | { kind: 'special'; customerCoCli: string; reason: string; expiresOn: string; coPrecio: string; fallbackTipCli?: string };

export interface PatchSegmentInput { desTipo?: string; coPrecio?: string; expiresOn?: string | null; validador?: string }
export interface AssignmentInput { customerCodes: string[]; targetTipCli: string }

const VALIDADOR = /^0x[0-9a-fA-F]{16}$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

function isObject(b: unknown): b is Record<string, unknown> {
  return typeof b === 'object' && b !== null && !Array.isArray(b);
}

function futureDate(v: unknown, today: string): string | null {
  return isValidIsoDate(v) && daysBetweenIso(today, v) > 0 ? v : null;
}

export function validateCreateSegmentBody(body: unknown, today: string): Valid<CreateSegmentInput> {
  if (!isObject(body)) return fail('Solicitud inválida');
  const coPrecio = str(body.coPrecio, 6);
  if (!coPrecio) return fail('Lista de precio requerida');

  if (body.kind === 'group') {
    const desTipo = str(body.desTipo, 60);
    if (!desTipo) return fail('El nombre del segmento es requerido (máx. 60 caracteres)');
    return { ok: true, value: { kind: 'group', desTipo, coPrecio } };
  }
  if (body.kind === 'special') {
    const customerCoCli = str(body.customerCoCli, 16);
    if (!customerCoCli) return fail('Cliente requerido');
    const reason = str(body.reason, 40);
    if (!reason) return fail('El motivo es requerido (máx. 40 caracteres)');
    const expiresOn = futureDate(body.expiresOn, today);
    if (!expiresOn) return fail('La fecha de fin debe ser una fecha futura (AAAA-MM-DD)');
    const fallback = body.fallbackTipCli === undefined ? undefined : str(body.fallbackTipCli, 6);
    if (body.fallbackTipCli !== undefined && !fallback) return fail('Segmento de respaldo inválido');
    return { ok: true, value: { kind: 'special', customerCoCli, reason, expiresOn, coPrecio, ...(fallback ? { fallbackTipCli: fallback } : {}) } };
  }
  return fail('Tipo de segmento inválido');
}

export function validatePatchSegmentBody(body: unknown, today: string): Valid<PatchSegmentInput> {
  if (!isObject(body)) return fail('Solicitud inválida');
  const out: PatchSegmentInput = {};
  if (body.desTipo !== undefined) {
    const d = str(body.desTipo, 60);
    if (!d) return fail('Nombre inválido (máx. 60 caracteres)');
    out.desTipo = d;
  }
  if (body.coPrecio !== undefined) {
    const p = str(body.coPrecio, 6);
    if (!p) return fail('Lista de precio inválida');
    out.coPrecio = p;
  }
  if (body.expiresOn !== undefined) {
    if (body.expiresOn === null) out.expiresOn = null;
    else {
      const e = futureDate(body.expiresOn, today);
      if (!e) return fail('La fecha de fin debe ser una fecha futura (AAAA-MM-DD)');
      out.expiresOn = e;
    }
  }
  if (body.validador !== undefined) {
    if (typeof body.validador !== 'string' || !VALIDADOR.test(body.validador)) return fail('Token de concurrencia inválido');
    out.validador = body.validador;
  }
  if (out.desTipo === undefined && out.coPrecio === undefined && out.expiresOn === undefined) return fail('Nada que actualizar');
  if ((out.desTipo !== undefined || out.coPrecio !== undefined) && !out.validador) return fail('Token de concurrencia requerido');
  return { ok: true, value: out };
}

export function validateAssignmentBody(body: unknown): Valid<AssignmentInput> {
  if (!isObject(body) || !Array.isArray(body.customerCodes) || body.customerCodes.length === 0) return fail('Se requiere al menos un cliente');
  if (body.customerCodes.length > 500) return fail('Demasiados clientes en una sola solicitud (máx. 500)');
  const codes: string[] = [];
  for (const c of body.customerCodes) {
    const t = str(c, 16);
    if (!t) return fail('Códigos de cliente inválidos');
    if (!codes.includes(t)) codes.push(t);
  }
  const targetTipCli = str(body.targetTipCli, 6);
  if (!targetTipCli) return fail('Segmento destino requerido');
  return { ok: true, value: { customerCodes: codes, targetTipCli } };
}
