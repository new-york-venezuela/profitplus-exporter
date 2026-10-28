import { parseCsv } from '@/lib/customer-mapping/csv';
import { isValidIsoDate } from '../dates';

export const LISTS_COLUMNS = ['lista', 'nombre', 'moneda', 'desde'] as const;

export interface ListDef { key: string; nombre: string; coMone: string; desde: string }
export interface PriceCell { line: number; coArt: string; key: string; monto: number }

const MAX_NAME = 60;
const MAX_DECIMALS = 5;

/** A price as typed in a CSV: dot decimal, no thousands separator or symbol, > 0, at most 5 decimals. */
export function parsePrice(raw: string): { ok: true; monto: number } | { ok: false; error: string } {
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: `«${raw}» no es un precio; use punto decimal, sin separador de miles ni símbolo` };
  const monto = Number(raw);
  if (monto <= 0 || monto > 1e9) return { ok: false, error: 'precio fuera de rango' };
  if (Math.abs(Math.round(monto * 10 ** MAX_DECIMALS) / 10 ** MAX_DECIMALS - monto) > 1e-9) return { ok: false, error: `máximo ${MAX_DECIMALS} decimales` };
  return { ok: true, monto };
}

export function semicolonHint(table: string[][]): string | null {
  const first = table[0] ?? [];
  return first.length === 1 && first[0].includes(';')
    ? 'El archivo usa ";" como separador; guárdelo como «CSV UTF-8 (delimitado por comas)»'
    : null;
}

export function parseListsCsv(text: string): { lists: ListDef[]; errors: string[] } {
  const table = parseCsv(text);
  const hint = semicolonHint(table);
  if (hint) return { lists: [], errors: [hint] };
  const header = (table[0] ?? []).map(h => h.trim());
  if (header.join(',') !== LISTS_COLUMNS.join(',')) {
    return { lists: [], errors: [`lists.csv: encabezado inválido; se esperaba: ${LISTS_COLUMNS.join(',')}`] };
  }
  const lists: ListDef[] = [];
  const errors: string[] = [];
  const keys = new Set<string>();
  const names = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const [key, nombre, moneda, desde] = LISTS_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    if (!key || !nombre || !moneda || !desde) { errors.push(`lists.csv línea ${line}: faltan campos`); return; }
    if (keys.has(key.toUpperCase())) { errors.push(`lists.csv línea ${line}: lista repetida «${key}»`); return; }
    keys.add(key.toUpperCase());
    if (nombre.length > MAX_NAME) { errors.push(`lists.csv línea ${line}: nombre de más de ${MAX_NAME} caracteres`); return; }
    if (names.has(nombre.toUpperCase())) { errors.push(`lists.csv línea ${line}: nombre repetido «${nombre}»`); return; }
    names.add(nombre.toUpperCase());
    if (!isValidIsoDate(desde)) { errors.push(`lists.csv línea ${line}: «desde» debe ser AAAA-MM-DD`); return; }
    lists.push({ key, nombre, coMone: moneda.toUpperCase(), desde });
  });
  if (lists.length === 0 && errors.length === 0) errors.push('lists.csv no tiene listas');
  return { lists, errors };
}

/** Wide format: `co_art`, optional `nombre` (ignored), then one column per list key. A blank cell = not priced in that list. */
export function parsePricesCsv(text: string, listKeys: string[]): { cells: PriceCell[]; errors: string[] } {
  const table = parseCsv(text);
  const hint = semicolonHint(table);
  if (hint) return { cells: [], errors: [hint] };
  const header = (table[0] ?? []).map(h => h.trim());
  if (header[0] !== 'co_art') return { cells: [], errors: ['prices.csv: la primera columna debe ser co_art'] };
  const known = new Map(listKeys.map(k => [k.toUpperCase(), k]));
  const errors: string[] = [];
  const priceCols: { idx: number; key: string }[] = [];
  header.forEach((h, idx) => {
    if (idx === 0 || h === 'nombre') return;
    const key = known.get(h.toUpperCase());
    if (!key) errors.push(`prices.csv: la columna «${h}» no es una lista de lists.csv`);
    else priceCols.push({ idx, key });
  });
  for (const k of listKeys) {
    if (!priceCols.some(c => c.key === k)) errors.push(`prices.csv: falta la columna de la lista «${k}»`);
  }
  if (errors.length) return { cells: [], errors };

  const cells: PriceCell[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((row, i) => {
    const line = i + 2;
    const coArt = (row[0] ?? '').trim();
    if (!coArt) { errors.push(`prices.csv línea ${line}: co_art vacío`); return; }
    if (seen.has(coArt.toUpperCase())) { errors.push(`prices.csv línea ${line}: artículo repetido ${coArt}`); return; }
    seen.add(coArt.toUpperCase());
    for (const { idx, key } of priceCols) {
      const raw = (row[idx] ?? '').trim();
      if (raw === '') continue;
      const parsed = parsePrice(raw);
      if (!parsed.ok) { errors.push(`prices.csv línea ${line} (${coArt}, ${key}): ${parsed.error}`); continue; }
      const monto = parsed.monto;
      cells.push({ line, coArt, key, monto });
    }
  });
  return { cells, errors };
}
