import type { Conflict, CustomerType, MappingRow } from './types';
import { trimCode } from './codes';

export interface MasterRow { codigo: string; cliente: string; grupo: string; tipo: string; principal: string }
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
  opts: { effectiveFrom: string },
): { rows: MappingRow[]; conflicts: Conflict[] } {
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

  const rows: MappingRow[] = [];
  const conflicts: Conflict[] = [];
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
    const tipo = trimCode(r.tipo);
    if (tipo !== 'Cadena' && tipo !== 'Independiente') {
      conflicts.push({ coCli, nombre, kind: 'invalid_type', detail: `Tipo cliente '${tipo}' no es Cadena/Independiente` });
      continue;
    }
    const last = latest.get(coCli);
    let coVen = '';
    let sourceNote = 'sin facturas en el libro';
    if (last) {
      coVen = last.coVen;
      sourceNote = `última factura ${last.numero} ${last.fecha}`;
      const all = sellers.get(coCli)!;
      if (all.size > 1) {
        conflicts.push({ coCli, nombre, kind: 'multi_seller', detail: `vendedores ${[...all].sort().join(',')} → se usa ${coVen} (${last.numero} ${last.fecha})` });
      }
    } else {
      conflicts.push({ coCli, nombre, kind: 'no_invoices', detail: 'sin facturas; vendedor en blanco (solo se actualiza el grupo)' });
    }
    rows.push({
      coCli, nombre, coVen, grupo: trimCode(r.grupo), tipoCliente: tipo as CustomerType,
      clientePrincipal: trimCode(r.principal), effectiveFrom: opts.effectiveFrom, sourceNote,
    });
  }
  rows.sort((a, b) => a.coCli.localeCompare(b.coCli));
  return { rows, conflicts };
}
