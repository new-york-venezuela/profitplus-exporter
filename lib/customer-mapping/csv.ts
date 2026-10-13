import { DEFAULT_VISIT_FREQUENCY, VISIT_FREQUENCIES, parseVisitFrequency } from './frequency';
import { parseRouteNumber } from './route-zones';
import { MAPPING_COLUMNS, type MappingRow } from './types';

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
    const [coCli, nombre, coVen, grupo, ruta, frec] = MAPPING_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    if (!coCli) { errors.push(`línea ${line}: co_cli vacío`); return; }
    if (seen.has(coCli)) errors.push(`línea ${line}: co_cli duplicado ${coCli}`);
    seen.add(coCli);
    if (!grupo) errors.push(`línea ${line}: grupo vacío (${coCli})`);
    let rutaNum: number | null = null;
    if (ruta) {
      rutaNum = parseRouteNumber(ruta);
      if (rutaNum == null) errors.push(`línea ${line}: ruta inválida '${ruta}' (${coCli}); use un número 1..999`);
    }
    const frecuencia = frec ? parseVisitFrequency(frec) : DEFAULT_VISIT_FREQUENCY;
    if (!frecuencia) errors.push(`línea ${line}: frecuencia inválida '${frec}' (${coCli}); use ${VISIT_FREQUENCIES.join('/')}`);
    rows.push({
      coCli, nombre, coVen, grupo, ruta: rutaNum, frecuencia: frecuencia ?? DEFAULT_VISIT_FREQUENCY });
  });
  return { rows, errors };
}
