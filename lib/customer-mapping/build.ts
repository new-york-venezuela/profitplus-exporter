import type { Conflict, MappingRow } from './types';
import { looseCustomerKey, trimCode } from './codes';
import { DEFAULT_VISIT_FREQUENCY, parseVisitFrequency, type VisitFrequency } from './frequency';
import { applyRouteOwners, type RouteOwner } from './route-owners';
import { parseRouteNumber } from './route-zones';

export interface MasterRow { codigo: string; cliente: string; grupo: string }
export interface TrackingRow { codigo: string; ruta: unknown; frecuencia: unknown; fila: number }
export interface InvoiceLine {
  numero: string; renglon: number; fecha: string; coCli: string; coVen: string; tipoDocumento: string;
}

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Workbook dates are a mix of Excel datetimes and dd/mm/yyyy text.
export function parseSaleDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'string') {
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(v);
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const probe = new Date(y, mo - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
    return iso(y, mo, d);
  }
  return null;
}

// Latest = greatest (fecha, numero, renglon). Deterministic on same-day ties.
function isLater(a: InvoiceLine, b: InvoiceLine): boolean {
  if (a.fecha !== b.fecha) return a.fecha > b.fecha;
  if (a.numero !== b.numero) return a.numero > b.numero;
  return a.renglon > b.renglon;
}

export function buildMapping(
  master: MasterRow[],
  lines: InvoiceLine[],
  tracking: TrackingRow[],
  opts: { effectiveFrom: string },
): { rows: MappingRow[]; conflicts: Conflict[]; owners: RouteOwner[] } {
  const latest = new Map<string, InvoiceLine>();
  const sellers = new Map<string, Set<string>>();
  for (const line of lines) {
    // Only invoices that name a seller can decide the mapping; blank-seller lines are ignored.
    const coVen = trimCode(line.coVen);
    if (line.tipoDocumento !== 'Factura' || !coVen) continue;
    const normalized = { ...line, coVen };
    const best = latest.get(line.coCli);
    if (!best || isLater(normalized, best)) latest.set(line.coCli, normalized);
    if (!sellers.has(line.coCli)) sellers.set(line.coCli, new Set());
    sellers.get(line.coCli)!.add(coVen);
  }

  const conflicts: Conflict[] = [];

  // 1. Master customers (first row per code wins).
  const masterRows: MasterRow[] = [];
  const seen = new Map<string, string>();
  for (const r of master) {
    const coCli = trimCode(r.codigo);
    const nombre = trimCode(r.cliente);
    if (!coCli) { conflicts.push({ coCli: '', nombre, kind: 'missing_code', detail: 'fila sin código en Maestro Clientes' }); continue; }
    if (seen.has(coCli)) {
      conflicts.push({ coCli, nombre, kind: 'duplicate_code', detail: `ya existe como '${seen.get(coCli)}'; se conserva la primera fila` });
      continue;
    }
    seen.set(coCli, nombre);
    masterRows.push({ codigo: coCli, cliente: nombre, grupo: trimCode(r.grupo) });
  }

  // 2. Tracking workbook: exact (trimmed) code match only. A loose match is a hint, never a match.
  interface Route { ruta: number | null; frecuencia: VisitFrequency; fila: number }
  const routeOf = new Map<string, Route>();
  const masterLoose = [...seen].map(([coCli, nombre]) => ({ coCli, nombre, key: looseCustomerKey(coCli) }));
  for (const tr of tracking) {
    const coCli = trimCode(tr.codigo);
    if (!coCli) continue;
    if (!seen.has(coCli)) {
      const near = masterLoose.filter(x => x.key.length >= 5 && x.key === looseCustomerKey(coCli));
      const hint = near.length === 1 ? `; código parecido en el maestro: ${near[0].coCli} (${near[0].nombre})` : '';
      conflicts.push({ coCli, nombre: '', kind: 'route_code_not_in_master', detail: `fila ${tr.fila} del libro de seguimiento sin fila en Maestro Clientes${hint}` });
      continue;
    }
    const nombre = seen.get(coCli)!;
    const rawRoute = typeof tr.ruta === 'string' ? tr.ruta.trim() : tr.ruta;
    let ruta: number | null = null;
    if (rawRoute != null && rawRoute !== '') {
      ruta = parseRouteNumber(rawRoute);
      if (ruta == null) conflicts.push({ coCli, nombre, kind: 'invalid_route', detail: `fila ${tr.fila}: ruta '${String(rawRoute)}' no es un número 1..999` });
    }
    const rawFrec = tr.frecuencia == null ? '' : String(tr.frecuencia).trim();
    let frecuencia: VisitFrequency = DEFAULT_VISIT_FREQUENCY;
    if (rawFrec) {
      const parsed = parseVisitFrequency(rawFrec);
      if (parsed) frecuencia = parsed;
      else conflicts.push({ coCli, nombre, kind: 'invalid_frequency', detail: `fila ${tr.fila}: frecuencia '${rawFrec}' no válida; se usa ${DEFAULT_VISIT_FREQUENCY}` });
    }
    const prev = routeOf.get(coCli);
    if (prev) {
      if (prev.ruta !== ruta || prev.frecuencia !== frecuencia) {
        conflicts.push({ coCli, nombre, kind: 'duplicate_tracking_row', detail: `filas ${prev.fila} y ${tr.fila} difieren; ruta en blanco hasta resolver a mano` });
        prev.ruta = null;
      }
      continue;
    }
    routeOf.set(coCli, { ruta, frecuencia, fila: tr.fila });
  }

  // 3. One row per master customer present in the tracking workbook.
  const draft: MappingRow[] = [];
  for (const r of masterRows) {
    const tr = routeOf.get(r.codigo);
    if (!tr) {
      conflicts.push({ coCli: r.codigo, nombre: r.cliente, kind: 'not_in_tracking', detail: 'sin fila en el libro de seguimiento por ruta; no se incluye en el CSV' });
      continue;
    }
    if (tr.ruta == null) {
      conflicts.push({ coCli: r.codigo, nombre: r.cliente, kind: 'missing_route', detail: `fila ${tr.fila}: sin ruta válida; resolver a mano en el CSV (mapping:apply no corre sin ruta)` });
    }
    const last = latest.get(r.codigo);
    let coVen = '';
    let sourceNote = 'sin facturas en el libro';
    if (last) {
      coVen = last.coVen;
      sourceNote = `última factura ${last.numero} ${last.fecha}`;
      const all = sellers.get(r.codigo)!;
      if (all.size > 1) {
        conflicts.push({ coCli: r.codigo, nombre: r.cliente, kind: 'multi_seller', detail: `vendedores ${[...all].sort().join(',')} → se usa ${coVen} (${last.numero} ${last.fecha})` });
      }
    } else {
      conflicts.push({ coCli: r.codigo, nombre: r.cliente, kind: 'no_invoices', detail: 'sin facturas; el vendedor sale del dueño de su ruta' });
    }
    draft.push({
      coCli: r.codigo, nombre: r.cliente, coVen, grupo: r.grupo, ruta: tr.ruta, frecuencia: tr.frecuencia,
      effectiveFrom: opts.effectiveFrom, sourceNote,
    });
  }

  // 4. Route owners: the seller with most customers on a route owns it; everyone on it gets that seller.
  const { rows: owned, owners, overrides } = applyRouteOwners(draft);
  const overrideOf = new Map(overrides.map(o => [o.coCli, o]));
  const rows = owned.map(r => {
    const o = overrideOf.get(r.coCli);
    return o ? { ...r, sourceNote: `${r.sourceNote}; vendedor de la ruta ${o.ruta}: ${o.to}` } : r;
  });
  const nameOf = new Map(draft.map(r => [r.coCli, r.nombre]));
  for (const o of overrides) {
    if (!o.from) continue;
    conflicts.push({ coCli: o.coCli, nombre: nameOf.get(o.coCli) ?? '', kind: 'seller_overridden_by_route_owner', detail: `ruta ${o.ruta}: ${o.from} → ${o.to} (dueño de la ruta)` });
  }
  for (const o of owners) {
    const dist = o.bySeller.map(s => `${s.coVen}:${s.n}`).join(', ');
    if (o.tie) {
      conflicts.push({ coCli: '', nombre: `Ruta ${o.route}`, kind: 'route_owner_tie', detail: `empate entre ${dist}; deje un solo vendedor para todos los clientes de la ruta en el CSV` });
    } else if (o.owner == null) {
      conflicts.push({ coCli: '', nombre: `Ruta ${o.route}`, kind: 'route_without_owner', detail: 'ningún cliente de la ruta tiene vendedor; asigne uno en el CSV' });
    }
  }

  // Factura customers that the master sheet never lists would silently keep their ERP seller/group.
  // Suggestion only: same code ignoring punctuation/case, or one is the other plus a suffix.
  const looselyMatches = (k: string) => masterLoose.filter(x =>
    x.key.length >= 5 && k.length >= 5 && (k === x.key || k.startsWith(x.key) || x.key.startsWith(k)));
  const reported = new Set<string>();
  for (const line of lines) {
    const code = trimCode(line.coCli);
    if (line.tipoDocumento !== 'Factura' || !code || seen.has(code) || reported.has(code)) continue;
    reported.add(code);
    const near = looselyMatches(looseCustomerKey(code));
    const hint = near.length === 1 ? `; código parecido en el maestro: ${near[0].coCli} (${near[0].nombre})` : '';
    conflicts.push({ coCli: code, nombre: '', kind: 'sales_code_not_in_master', detail: `código de la hoja de ventas sin fila en Maestro Clientes${hint}` });
  }
  rows.sort((a, b) => a.coCli.localeCompare(b.coCli));
  return { rows, conflicts, owners };
}
