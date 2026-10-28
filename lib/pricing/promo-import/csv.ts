import { parseCsv } from '@/lib/customer-mapping/csv';
import { isValidIsoDate } from '../dates';
import { parsePrice, semicolonHint } from '../list-import/csv';

export const PROMO_COLUMNS = ['promocion', 'lista', 'desde', 'hasta', 'motivo', 'co_art', 'precio'] as const;

export interface PromoDef {
  name: string; lista: string; desde: string; hasta: string; reason: string | null;
  items: { line: number; coArt: string; monto: number }[];
}

const MAX_NAME = 40;
const MAX_REASON = 200;

/**
 * Long format: one row per promotion item. `promocion`, `lista`, `desde` and `hasta` must repeat identically on every row
 * of the same promotion; `motivo` may be filled on any one of them.
 */
export function parsePromotionsCsv(text: string): { promos: PromoDef[]; errors: string[] } {
  const table = parseCsv(text);
  const hint = semicolonHint(table);
  if (hint) return { promos: [], errors: [hint] };
  const header = (table[0] ?? []).map(h => h.trim());
  if (header.join(',') !== PROMO_COLUMNS.join(',')) {
    return { promos: [], errors: [`promotions.csv: encabezado inválido; se esperaba: ${PROMO_COLUMNS.join(',')}`] };
  }
  const errors: string[] = [];
  const byName = new Map<string, PromoDef & { firstLine: number }>();
  const seenItems = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const [name, lista, desde, hasta, motivo, coArt, precio] = PROMO_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    const at = `promotions.csv línea ${line}`;
    if (!name || !lista || !desde || !hasta || !coArt || !precio) { errors.push(`${at}: faltan campos (solo «motivo» es opcional)`); return; }
    if (name.length > MAX_NAME) { errors.push(`${at}: «promocion» de más de ${MAX_NAME} caracteres`); return; }
    if (motivo.length > MAX_REASON) { errors.push(`${at}: «motivo» de más de ${MAX_REASON} caracteres`); return; }
    if (!isValidIsoDate(desde) || !isValidIsoDate(hasta)) { errors.push(`${at}: «desde» y «hasta» deben ser AAAA-MM-DD`); return; }
    if (hasta < desde) { errors.push(`${at}: «hasta» es anterior a «desde»`); return; }
    const price = parsePrice(precio);
    if (!price.ok) { errors.push(`${at} (${coArt}): ${price.error}`); return; }

    const key = name.toUpperCase();
    let promo = byName.get(key);
    if (!promo) {
      promo = { name, lista, desde, hasta, reason: motivo || null, items: [], firstLine: line };
      byName.set(key, promo);
    } else if (promo.lista.toUpperCase() !== lista.toUpperCase() || promo.desde !== desde || promo.hasta !== hasta) {
      errors.push(`${at}: «${name}» tiene lista o fechas distintas a las de su línea ${promo.firstLine}`);
      return;
    } else if (motivo && !promo.reason) promo.reason = motivo;

    const itemKey = `${key}\u0000${coArt.toUpperCase()}`;
    if (seenItems.has(itemKey)) { errors.push(`${at}: artículo ${coArt} repetido en «${name}»`); return; }
    seenItems.add(itemKey);
    promo.items.push({ line, coArt, monto: price.monto });
  });
  const promos = [...byName.values()].map(({ firstLine: _f, ...p }) => p);
  if (promos.length === 0 && errors.length === 0) errors.push('promotions.csv no tiene promociones');
  return { promos, errors };
}
