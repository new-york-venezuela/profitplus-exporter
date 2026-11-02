import { LISTS_COLUMNS, parseListsCsv, parsePricesCsv, type ListDef, type PriceCell } from '@/lib/pricing/list-import/csv';
import { PROMO_COLUMNS, parsePromotionsCsv, type PromoDef } from '@/lib/pricing/promo-import/csv';
import { parseTipoClienteCsv, type TipoClienteRow } from '@/lib/pricing/tipo-cliente-apply/csv';
import { DISCOUNT_COLUMNS, parseDiscountsCsv, type DiscountRow } from '@/lib/pricing/xlsx/discounts';
import { scopeViolations, type ScopedArticle } from '@/lib/pricing/xlsx/scope';
import { readWorkbookRows, SHEET, type WorkbookRows } from '@/lib/pricing/xlsx/workbook';

export interface ParsedWorkbook {
  lists: ListDef[];
  cells: PriceCell[];
  promos: PromoDef[];
  discounts: DiscountRow[];
  customers: TipoClienteRow[];
  errors: string[];
}

/** Customers whose target is a list defined in `Listas` (not in Profit yet) carry this prefix; Task 6 resolves it at apply time. */
export const NEW_LIST_SENTINEL = 'L:@';

const norm = (s: string) => s.trim().toUpperCase();
const csvField = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Rewrites the CSV file names used by the existing parsers into the sheet names the user sees. */
export function relabel(msg: string): string {
  return msg
    .replace(/lists\.csv/g, 'la hoja Listas')
    .replace(/prices\.csv/g, 'la hoja Precios')
    .replace(/promotions\.csv/g, 'la hoja Promociones');
}

function loadSheet(buf: Buffer, sheet: string, required: string[], errors: string[]): WorkbookRows | null {
  let data: WorkbookRows | null;
  try {
    data = readWorkbookRows(buf, sheet);
  } catch {
    errors.push('No se pudo leer el archivo como libro de Excel (.xlsx)');
    return null;
  }
  if (!data) { errors.push(`Falta la hoja «${sheet}»`); return null; }
  const missing = required.filter(c => !data!.header.includes(c));
  if (missing.length) {
    errors.push(`Falta${missing.length > 1 ? 'n las columnas' : ' la columna'} ${missing.map(m => `«${m}»`).join(', ')} en «${sheet}»`);
    return null;
  }
  return data;
}

/** CSV of the given columns (by header position); lines that are entirely empty after the selection are dropped. */
function csvOf(data: WorkbookRows, idx: number[], header: string[], keep: (row: string[]) => boolean = () => true): string {
  const lines = data.rows
    .filter(keep)
    .map(r => idx.map(i => r[i] ?? ''))
    .filter(cells => cells.some(c => c !== ''))
    .map(cells => cells.map(csvField).join(','));
  return [header.map(csvField).join(','), ...lines].join('\n');
}

const selectBy = (data: WorkbookRows, cols: readonly string[]) => cols.map(c => data.header.indexOf(c));

export function parseWorkbook(buf: Buffer, inScope: ScopedArticle[]): ParsedWorkbook {
  const errors: string[] = [];
  const canonical = new Map(inScope.map(a => [norm(a.coArt), a.coArt]));
  const canon = (coArt: string) => canonical.get(norm(coArt)) ?? coArt.trim();
  const out: ParsedWorkbook = { lists: [], cells: [], promos: [], discounts: [], customers: [], errors };

  // Listas: only `nueva` = SI rows are lists to create; the rest is context.
  const listas = loadSheet(buf, SHEET.listas, [...LISTS_COLUMNS, 'nueva'], errors);
  if (listas) {
    const iNueva = listas.header.indexOf('nueva');
    const csv = csvOf(listas, selectBy(listas, LISTS_COLUMNS), [...LISTS_COLUMNS], r => norm(r[iNueva] ?? '') === 'SI');
    if (csv.includes('\n')) {
      const p = parseListsCsv(csv);
      out.lists = p.lists;
      errors.push(...p.errors.map(relabel));
    }
  }

  // Precios: co_art plus one column per NEW list key; everything else is ignored.
  const precios = loadSheet(buf, SHEET.precios, ['co_art'], errors);
  if (precios && out.lists.length) {
    const keyCols: { key: string; idx: number }[] = [];
    for (const l of out.lists) {
      const idx = precios.header.findIndex(h => norm(h) === norm(l.key));
      if (idx >= 0) keyCols.push({ key: l.key, idx });
    }
    const idxs = [precios.header.indexOf('co_art'), ...keyCols.map(c => c.idx)];
    const p = parsePricesCsv(csvOf(precios, idxs, ['co_art', ...keyCols.map(c => c.key)]), out.lists.map(l => l.key));
    errors.push(...p.errors.map(relabel));
    out.cells = p.cells.map(c => ({ ...c, coArt: canon(c.coArt) }));
    errors.push(...scopeViolations([...new Set(out.cells.map(c => c.coArt))], inScope, 'Precios'));
  }

  // Promociones: only rows nobody has processed yet (blank estado).
  const promos = loadSheet(buf, SHEET.promociones, [...PROMO_COLUMNS, 'estado'], errors);
  if (promos) {
    const iEstado = promos.header.indexOf('estado');
    const csv = csvOf(promos, selectBy(promos, PROMO_COLUMNS), [...PROMO_COLUMNS], r => (r[iEstado] ?? '') === '');
    if (csv.includes('\n')) {
      const p = parsePromotionsCsv(csv);
      out.promos = p.promos;
      errors.push(...p.errors.map(relabel));
      errors.push(...scopeViolations([...new Set(p.promos.flatMap(x => x.items.map(i => i.coArt)))], inScope, 'Promociones'));
    }
  }

  const desc = loadSheet(buf, SHEET.descuentos, [...DISCOUNT_COLUMNS], errors);
  if (desc) {
    const p = parseDiscountsCsv(csvOf(desc, selectBy(desc, DISCOUNT_COLUMNS), [...DISCOUNT_COLUMNS]));
    out.discounts = p.rows.map(r => ({ ...r, coArt: canon(r.coArt) }));
    errors.push(...p.errors);
    errors.push(...scopeViolations([...new Set(p.rows.map(r => r.coArt))], inScope, 'Descuentos por cliente'));
  }

  const clientes = loadSheet(buf, SHEET.clientes, ['co_cli', 'nombre', 'tip_cli_nuevo'], errors);
  if (clientes) {
    const cols = ['co_cli', 'nombre', ...(clientes.header.includes('moneda_90d') ? ['moneda_90d'] : []), 'tip_cli_nuevo'];
    const p = parseTipoClienteCsv(csvOf(clientes, selectBy(clientes, cols), cols));
    errors.push(...p.errors.map(e => `Clientes: ${e}`));
    const newLists = new Map<string, string>();
    for (const l of out.lists) { newLists.set(norm(l.key), l.key); newLists.set(norm(l.nombre), l.key); }
    out.customers = p.rows.map(r => {
      const key = newLists.get(norm(r.target));
      return key ? { ...r, target: `${NEW_LIST_SENTINEL}${key}` } : r;
    });
  }

  return out;
}
