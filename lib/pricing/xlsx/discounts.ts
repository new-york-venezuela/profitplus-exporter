import { createHash } from 'node:crypto';
import { parseCsv } from '@/lib/customer-mapping/csv';
import { isValidIsoDate } from '../dates';
import { parsePrice, semicolonHint } from '../list-import/csv';

export const DISCOUNT_COLUMNS = ['co_cli', 'co_art', 'precio', 'desde', 'hasta'] as const;

export interface DiscountRow {
  line: number;
  coCli: string;
  coArt: string;
  kind: 'price' | 'percent';
  /** Final price for 'price'; the percent magnitude (8 for «-8%») for 'percent'. */
  value: number;
  desde: string;
  hasta: string | null;
}

export interface DiscountSet {
  key: string;
  overrides: Map<string, number>;
  customers: { coCli: string; desde: string; hasta: string | null }[];
}

const PERCENT_RE = /^-(\d+(?:\.\d+)?)%$/;

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;

export function parseDiscountsCsv(csv: string): { rows: DiscountRow[]; errors: string[] } {
  const table = parseCsv(csv);
  const hint = semicolonHint(table);
  if (hint) return { rows: [], errors: [hint] };
  const header = (table[0] ?? []).map(h => h.trim());
  if (header.join(',') !== DISCOUNT_COLUMNS.join(',')) {
    return { rows: [], errors: [`Descuentos por cliente: encabezado inválido; se esperaba: ${DISCOUNT_COLUMNS.join(',')}`] };
  }
  const rows: DiscountRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const hastaByCli = new Map<string, string | null>();
  const mixedReported = new Set<string>();

  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const [coCli, coArt, precio, desde, hastaRaw] = DISCOUNT_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    if (!coCli && !coArt && !precio && !desde && !hastaRaw) return;
    if (!coCli || !coArt || !precio || !desde) { errors.push(`Descuentos por cliente línea ${line}: faltan campos`); return; }
    const dupKey = `${coCli.toUpperCase()}|${coArt.toUpperCase()}`;
    if (seen.has(dupKey)) { errors.push(`Descuentos por cliente línea ${line}: descuento repetido para ${coCli} / ${coArt}`); return; }
    seen.add(dupKey);

    let kind: DiscountRow['kind'];
    let value: number;
    if (precio.endsWith('%')) {
      const m = PERCENT_RE.exec(precio);
      const pct = m ? Number(m[1]) : NaN;
      if (!m || !(pct > 0 && pct < 100)) {
        errors.push(`Descuentos por cliente línea ${line}: «${precio}» no es un porcentaje válido; use «-8%» (mayor que 0 y menor que 100)`);
        return;
      }
      kind = 'percent';
      value = pct;
    } else {
      const parsed = parsePrice(precio);
      if (!parsed.ok) { errors.push(`Descuentos por cliente línea ${line} (${coCli}, ${coArt}): ${parsed.error}`); return; }
      kind = 'price';
      value = parsed.monto;
    }
    if (!isValidIsoDate(desde)) { errors.push(`Descuentos por cliente línea ${line}: «desde» debe ser AAAA-MM-DD`); return; }
    if (hastaRaw !== '' && !isValidIsoDate(hastaRaw)) { errors.push(`Descuentos por cliente línea ${line}: «hasta» debe ser AAAA-MM-DD`); return; }
    const hasta = hastaRaw === '' ? null : hastaRaw;
    if (hasta !== null && hasta < desde) { errors.push(`Descuentos por cliente línea ${line}: «hasta» es anterior a «desde»`); return; }

    const cliKey = coCli.toUpperCase();
    if (hastaByCli.has(cliKey)) {
      if (hastaByCli.get(cliKey) !== hasta && !mixedReported.has(cliKey)) {
        mixedReported.add(cliKey);
        errors.push(`Descuentos por cliente línea ${line}: el cliente ${coCli} tiene valores de «hasta» distintos`);
        return;
      }
    } else hastaByCli.set(cliKey, hasta);
    rows.push({ line, coCli, coArt, kind, value, desde, hasta });
  });
  return { rows, errors };
}

export function compileDiscounts(
  rows: DiscountRow[],
  typeListPrices: (coCli: string) => Map<string, number> | null,
): { sets: DiscountSet[]; errors: string[] } {
  const errors: string[] = [];
  const byCli = new Map<string, DiscountRow[]>();
  for (const r of rows) {
    const cliKey = r.coCli.trim().toUpperCase();
    const list = byCli.get(cliKey);
    if (list) list.push(r); else byCli.set(cliKey, [r]);
  }

  const sets = new Map<string, DiscountSet>();
  for (const cliRows of byCli.values()) {
    const coCli = cliRows[0].coCli;
    const base = typeListPrices(coCli);
    if (!base) { errors.push(`cliente ${coCli}: no se pudo determinar su lista de tipo`); continue; }
    const { desde, hasta } = cliRows[0];
    if (cliRows.some(r => r.desde !== desde)) { errors.push(`cliente ${coCli}: tiene valores de «desde» distintos`); continue; }

    const overrides = new Map<string, number>();
    let ok = true;
    for (const r of cliRows) {
      const basePrice = base.get(r.coArt);
      if (basePrice === undefined) {
        errors.push(`línea ${r.line}: cliente ${coCli}: el artículo ${r.coArt} no tiene precio en su lista de tipo`);
        ok = false;
        continue;
      }
      const price = r.kind === 'price' ? r.value : round5(basePrice * (1 - r.value / 100));
      if (!(price > 0)) {
        errors.push(`línea ${r.line}: cliente ${coCli}, artículo ${r.coArt}: el precio resultante es ${price}; debe ser mayor que 0`);
        ok = false;
        continue;
      }
      overrides.set(r.coArt, price);
    }
    if (!ok) continue;

    // The key (and so the special list/segment names) depends on the overrides only: `desde` is the run date, and a
    // key that changed every day would make a re-run treat already-discounted customers as being in another discount.
    const key = createHash('sha256')
      .update([...overrides].map(([a, p]) => `${a}=${p}`).sort().join(';'))
      .digest('hex')
      .slice(0, 8);
    const existing = sets.get(key);
    if (existing) existing.customers.push({ coCli, desde, hasta });
    else sets.set(key, { key, overrides, customers: [{ coCli, desde, hasta }] });
  }
  return { sets: [...sets.values()], errors };
}
