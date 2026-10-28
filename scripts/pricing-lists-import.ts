import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { assertConfirmedDb } from '@/lib/customer-mapping/diff-csv';
import { todayIso } from '@/lib/pricing/dates';
import { realRatesErp } from '@/lib/pricing/rates-erp-adapter';
import { parseListsCsv, parsePricesCsv } from '@/lib/pricing/list-import/csv';
import { applyImport, currentPrices, planImport } from '@/lib/pricing/list-import/run';

const DIR = 'data/pricing-lists';

const USAGE = `Uso (archivos en ${DIR}/; ver ${DIR}/README.md):
  bun run pricing:import-lists                                    # simulación (por defecto)
  bun run pricing:import-lists -- --apply --confirm-db <DB_NAME>  # crea las listas y carga los precios
  --template        escribe prices.csv con todos los artículos y una columna por lista de lists.csv (no sobrescribe)
  --lists <ruta>    reemplaza ${DIR}/lists.csv
  --prices <ruta>   reemplaza ${DIR}/prices.csv`;

const fmt = (n: number) => n.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');

async function main() {
  const { values } = parseArgs({
    options: {
      lists: { type: 'string' }, prices: { type: 'string' }, apply: { type: 'boolean', default: false },
      'confirm-db': { type: 'string' }, template: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
    },
  });
  if (values.help) { console.log(USAGE); return; }
  if (values.apply) assertConfirmedDb(values['confirm-db'], process.env.DB_NAME);

  const listsParsed = parseListsCsv(await readFile(values.lists ?? `${DIR}/lists.csv`, 'utf8'));
  if (values.template) {
    if (listsParsed.errors.length) throw new Error(`lists.csv inválido:\n${listsParsed.errors.map(e => `  ✗ ${e}`).join('\n')}`);
    const out = values.prices ?? `${DIR}/prices.csv`;
    if (existsSync(out)) throw new Error(`${out} ya existe; no se sobrescribe`);
    const pool = await getPool();
    try {
      const articles = await realRatesErp(pool).listArticles({ limit: 5000 });
      const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const keys = listsParsed.lists.map(l => l.key);
      const lines = [['co_art', 'nombre', ...keys].join(','), ...articles.map(a => [q(a.coArt), q(a.artDes), ...keys.map(() => '')].join(','))];
      await writeFile(out, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
      console.log(`${articles.length} artículos -> ${out}`);
    } finally { await pool.close(); }
    return;
  }
  const pricesParsed = parsePricesCsv(await readFile(values.prices ?? `${DIR}/prices.csv`, 'utf8'), listsParsed.lists.map(l => l.key));
  const csvErrors = [...listsParsed.errors, ...pricesParsed.errors];
  if (csvErrors.length) throw new Error(`CSV inválido:\n${csvErrors.map(e => `  ✗ ${e}`).join('\n')}`);

  const pool = await getPool();
  try {
    const deps = { erp: realRatesErp(pool), db: getDb() };
    const plan = await planImport(deps, listsParsed.lists, pricesParsed.cells, todayIso());
    console.log(`Base de datos: ${process.env.DB_SERVER}/${process.env.DB_NAME}`);
    for (const l of plan.lists) {
      const before = await currentPrices(deps, l);
      console.log(`\n${l.key} «${l.nombre}» ${l.coMone}, desde ${l.desde} — ${l.existingCoPrecio ? `existe (${l.existingCoPrecio})` : 'SE CREARÁ'} — ${l.changes.length} precios`);
      if (!values.apply) {
        for (const c of l.changes) {
          const b = before.get(c.coArt);
          console.log(`  ${c.coArt.padEnd(14)} ${c.artDes.slice(0, 34).padEnd(34)} ${b === undefined ? '(nuevo)'.padStart(10) : fmt(b).padStart(10)} → ${fmt(c.monto)}`);
        }
      }
    }
    if (plan.problems.length) {
      console.log('');
      for (const p of plan.problems) console.log(`  ✗ ${p}`);
      process.exitCode = 1;
      return;
    }
    if (!values.apply) { console.log('\nSimulación: no se escribió nada. Use --apply --confirm-db <DB_NAME> para aplicar.'); return; }

    const outcomes = await applyImport(deps, plan, { id: 'import-lists', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' });
    let bad = 0;
    for (const o of outcomes) {
      const count = (k: string) => o.results.filter(r => r.outcome === k).length;
      console.log(`${o.key} → lista ${o.coPrecio}${o.created ? ' (creada)' : ''}: ${count('success')} aplicados, ${count('skipped')} sin cambio, ${o.results.length - count('success') - count('skipped')} con problema`);
      for (const r of o.results.filter(x => x.outcome !== 'success' && x.outcome !== 'skipped')) { bad++; console.log(`  ✗ ${r.coArt}: ${r.outcome}${r.message ? ` — ${r.message}` : ''}`); }
    }
    if (bad) process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
