export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_NAME = 80;
const MAX_CODE = 16;       // saCliente.co_cli is char(16)
const MAX_MEMBERS = 2000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function name(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Nombre requerido' };
  if (v.trim().length > MAX_NAME) return { ok: false, error: `Nombre demasiado largo (máximo ${MAX_NAME})` };
  return { ok: true, value: v.trim() };
}

function sellerCode(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Vendedor requerido' };
  if (v.trim().length > MAX_CODE) return { ok: false, error: 'Código de vendedor inválido' };
  return { ok: true, value: v.trim() };
}

export function parseRouteCreate(body: unknown): Parsed<{ name: string; sellerCode: string }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const n = name(body.name); if (!n.ok) return n;
  const s = sellerCode(body.sellerCode); if (!s.ok) return s;
  return { ok: true, value: { name: n.value, sellerCode: s.value } };
}

export function parseRoutePatch(body: unknown): Parsed<{ name?: string; sellerCode?: string; customerCodes?: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const out: { name?: string; sellerCode?: string; customerCodes?: string[] } = {};
  if ('name' in body) { const n = name(body.name); if (!n.ok) return n; out.name = n.value; }
  if ('sellerCode' in body) { const s = sellerCode(body.sellerCode); if (!s.ok) return s; out.sellerCode = s.value; }
  if ('customerCodes' in body) {
    const list = body.customerCodes;
    if (!Array.isArray(list)) return { ok: false, error: 'customerCodes debe ser una lista' };
    if (list.length > MAX_MEMBERS) return { ok: false, error: `Demasiados clientes (máximo ${MAX_MEMBERS})` };
    const codes: string[] = [];
    for (const c of list) {
      if (typeof c !== 'string' || !c.trim() || c.trim().length > MAX_CODE) return { ok: false, error: 'Código de cliente inválido' };
      if (!codes.includes(c.trim())) codes.push(c.trim());
    }
    out.customerCodes = codes;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, value: out };
}
