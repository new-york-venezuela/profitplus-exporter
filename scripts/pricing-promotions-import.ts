import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { assertConfirmedDb } from '@/lib/customer-mapping/diff-csv';
import { todayIso } from '@/lib/pricing/dates';
import { realRatesErp } from '@/lib/pricing/rates-erp-adapter';
import { realSegmentErp } from '@/lib/pricing/segment-erp';
import { parseListsCsv, parsePricesCsv } from '@/lib/pricing/list-import/csv';
import { parsePromotionsCsv } from '@/lib/pricing/promo-import/csv';
import { applyPromoImport, planPromoImport } from '@/lib/pricing/promo-import/run';

const DIR = 'data/pricing-lists';

const USAGE = `Uso (archivos en ${DIR}/; ver ${DIR}/README.md):
  bun run pricing:import-promotions                                    # simulación (por defecto)
  bun run pricing:import-promotions -- --apply --confirm-db <DB_NAME>  # crea las promociones
  --file <ruta>     reemplaza ${DIR}/promotions.csv
  Las listas deben existir en Profit para aplicar: ejecute antes pricing:import-lists --apply.`;

/** Lists of lists.csv/prices.csv, so a dry run can check promotions against lists that are not in Profit yet. */
async function readPending() {
  const listsPath = `${DIR}/lists.csv`;
  const pricesPath = `${DIR}/prices.csv`;
  if (!existsSync(listsPath) || !existsSync(pricesPath)) return [];
  const lists = parseListsCsv(await readFile(listsPath, 'utf8'));
  if (lists.errors.length) return [];
  const prices = parsePricesCsv(await readFile(pricesPath, 'utf8'), lists.lists.map(l => l.key));
  if (prices.errors.length) return [];
  return lists.lists.map(l => ({
    key: l.key, nombre: l.nombre, desde: l.desde,
    prices: new Map(prices.cells.filter(c => c.key === l.key).map(c => [c.coArt.trim().toUpperCase(), c.monto])),
  }));
}

async function main() {
  const { values } = parseArgs({
    options: { file: { type: 'string' }, apply: { type: 'boolean', default: false }, 'confirm-db': { type: 'string' }, help: { type: 'boolean', default: false } },
  });
  if (values.help) { console.log(USAGE); return; }
  if (values.apply) assertConfirmedDb(values['confirm-db'], process.env.DB_NAME);

  const parsed = parsePromotionsCsv(await readFile(values.file ?? `${DIR}/promotions.csv`, 'utf8'));
  if (parsed.errors.length) throw new Error(`CSV inválido:\n${parsed.errors.map(e => `  ✗ ${e}`).join('\n')}`);

  const pool = await getPool();
  try {
    const deps = { rates: realRatesErp(pool), segments: realSegmentErp(pool), db: getDb() };
    const plan = await planPromoImport(deps, parsed.promos, await readPending(), todayIso());
    console.log(`Base de datos: ${process.env.DB_SERVER}/${process.env.DB_NAME}`);
    for (const p of plan.promos) {
      const where = p.target.kind === 'existing' ? `lista ${p.target.coPrecio} «${p.target.desPrecio}»` : `lista «${p.target.key}» (aún no existe en Profit)`;
      console.log(`\n«${p.name}» ${p.startsOn} → ${p.endsOn}, ${where} — ${p.alreadyExists ? 'YA EXISTE, se omite' : `${p.items.length} artículos`}`);
      if (!values.apply && !p.alreadyExists) {
        for (const i of p.items) {
          console.log(`  ${i.coArt.padEnd(14)} ${i.artDes.slice(0, 34).padEnd(34)} ${i.regular === null ? '?' : String(i.regular)} → ${i.monto}`);
        }
      }
    }
    for (const w of plan.warnings) console.log(`  ⚠ ${w}`);
    if (plan.problems.length) {
      console.log('');
      for (const p of plan.problems) console.log(`  ✗ ${p}`);
      process.exitCode = 1;
      return;
    }
    if (!values.apply) { console.log('\nSimulación: no se escribió nada. Use --apply --confirm-db <DB_NAME> para aplicar.'); return; }
    const notReady = plan.promos.filter(p => !p.alreadyExists && p.target.kind === 'pending');
    if (notReady.length) {
      console.log(`\n✗ Estas promociones apuntan a listas que aún no existen: ${notReady.map(p => `«${p.name}»`).join(', ')}. Ejecute antes pricing:import-lists --apply.`);
      process.exitCode = 1;
      return;
    }
    let bad = 0;
    for (const o of await applyPromoImport(deps, plan, { id: 'import-promotions', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' })) {
      console.log(`«${o.name}» (#${o.id}, ${o.status}): ${o.applied}/${o.items} artículos aplicados${o.warning ? ` — ⚠ ${o.warning}` : ''}`);
      for (const m of o.problems) { bad++; console.log(`  ✗ ${m}`); }
      if (o.applied < o.items || o.warning) bad++;
    }
    if (bad) process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
