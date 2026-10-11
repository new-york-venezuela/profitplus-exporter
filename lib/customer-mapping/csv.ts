import { buildCsv } from '@/lib/csv';
import type { ColumnDef } from '@/lib/reports/registry';
import { MAPPING_COLUMNS, type MappingRow, type CustomerType } from './types';

export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

export const MAPPING_COLUMN_DEFS: ColumnDef[] = MAPPING_COLUMNS.map((k, i) => ({
  key: k, label: k, defaultVisible: true, defaultOrder: i,
}));

export function mappingToCsv(rows: MappingRow[]): string {
  return buildCsv(MAPPING_COLUMN_DEFS, rows.map(r => ({
    co_cli: r.coCli, nombre: r.nombre, co_ven: r.coVen, grupo: r.grupo, tipo_cliente: r.tipoCliente,
    cliente_principal: r.clientePrincipal, effective_from: r.effectiveFrom, source_note: r.sourceNote,
  })));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function csvToMapping(text: string): { rows: MappingRow[]; errors: string[] } {
  const table = parseCsv(text);
  const errors: string[] = [];
  const header = (table[0] ?? []).map(h => h.trim());
  if (header.join(',') !== MAPPING_COLUMNS.join(',')) {
    return { rows: [], errors: [`Encabezado inválido; se esperaba: ${MAPPING_COLUMNS.join(',')}`] };
  }
  const rows: MappingRow[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const [coCli, nombre, coVen, grupo, tipo, principal, eff, note] = MAPPING_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    if (!coCli) { errors.push(`línea ${line}: co_cli vacío`); return; }
    if (seen.has(coCli)) errors.push(`línea ${line}: co_cli duplicado ${coCli}`);
    seen.add(coCli);
    if (!grupo) errors.push(`línea ${line}: grupo vacío (${coCli})`);
    if (tipo !== 'Cadena' && tipo !== 'Independiente') errors.push(`línea ${line}: tipo_cliente inválido '${tipo}' (${coCli})`);
    if (!ISO.test(eff)) errors.push(`línea ${line}: effective_from debe ser YYYY-MM-DD (${coCli})`);
    rows.push({
      coCli, nombre, coVen, grupo, tipoCliente: tipo as CustomerType,
      clientePrincipal: principal, effectiveFrom: eff, sourceNote: note,
    });
  });
  return { rows, errors };
}
