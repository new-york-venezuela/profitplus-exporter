import type { Ring } from './geometry';
import type { Parsed } from './route-validation';

const MAX_NAME = 80;
const MAX_VERTICES = 500;
const MAX_SELLERS = 100;
const MAX_CODE = 16;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function name(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Nombre requerido' };
  if (v.trim().length > MAX_NAME) return { ok: false, error: `Nombre demasiado largo (máximo ${MAX_NAME})` };
  return { ok: true, value: v.trim() };
}

function color(v: unknown): Parsed<string> {
  return typeof v === 'string' && COLOR_RE.test(v) ? { ok: true, value: v } : { ok: false, error: 'Color inválido (use #RRGGBB)' };
}

function ring(v: unknown): Parsed<Ring> {
  if (!Array.isArray(v)) return { ok: false, error: 'La zona debe ser una lista de puntos' };
  if (v.length > MAX_VERTICES) return { ok: false, error: `Demasiados puntos (máximo ${MAX_VERTICES})` };
  const out: Ring = [];
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number') {
      return { ok: false, error: 'Cada punto debe ser [longitud, latitud]' };
    }
    out.push([p[0], p[1]]);
  }
  return { ok: true, value: out };
}

function sellers(v: unknown): Parsed<string[]> {
  if (!Array.isArray(v)) return { ok: false, error: 'sellerCodes debe ser una lista' };
  if (v.length > MAX_SELLERS) return { ok: false, error: `Demasiados vendedores (máximo ${MAX_SELLERS})` };
  const out: string[] = [];
  for (const c of v) {
    if (typeof c !== 'string' || !c.trim() || c.trim().length > MAX_CODE) return { ok: false, error: 'Código de vendedor inválido' };
    if (!out.includes(c.trim())) out.push(c.trim());
  }
  return { ok: true, value: out };
}

export function parseAreaCreate(body: unknown): Parsed<{ name: string; color: string; ring: Ring; sellerCodes: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const n = name(body.name); if (!n.ok) return n;
  const c = color(body.color); if (!c.ok) return c;
  const r = ring(body.ring); if (!r.ok) return r;
  const s = sellers(body.sellerCodes ?? []); if (!s.ok) return s;
  return { ok: true, value: { name: n.value, color: c.value, ring: r.value, sellerCodes: s.value } };
}

export function parseAreaPatch(body: unknown): Parsed<{ name?: string; color?: string; ring?: Ring; sellerCodes?: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const out: { name?: string; color?: string; ring?: Ring; sellerCodes?: string[] } = {};
  if ('name' in body) { const n = name(body.name); if (!n.ok) return n; out.name = n.value; }
  if ('color' in body) { const c = color(body.color); if (!c.ok) return c; out.color = c.value; }
  if ('ring' in body) { const r = ring(body.ring); if (!r.ok) return r; out.ring = r.value; }
  if ('sellerCodes' in body) { const s = sellers(body.sellerCodes); if (!s.ok) return s; out.sellerCodes = s.value; }
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, value: out };
}
