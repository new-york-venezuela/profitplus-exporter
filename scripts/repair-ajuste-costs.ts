// Repairs inflated AJUS cost layers (migrations/mssql/0020-0021). Dry-run by default.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { buildCsv } from '@/lib/csv';
import { assertConfirmedDb } from '@/lib/customer-mapping/diff-csv';
import { planAjusteCostRepair } from '@/lib/inventory/ajuste-cost-repair';
import { fixLayerCost, listOpenAjusLayers, restoreRun } from '@/lib/inventory/ajuste-cost-repair-erp';

const DEFAULT_OUT = 'tmp/ajuste-costs-dry-run.csv';
const USAGE = `Uso:
  bun run ajuste-costs:repair                                     # simulación (por defecto)
  bun run ajuste-costs:repair -- --apply --confirm-db <DB_NAME>   # aplica
  bun run ajuste-costs:repair -- --rollback <runId> --confirm-db <DB_NAME>
  --out <ruta>        CSV con las capas que cambiarían (por defecto ${DEFAULT_OUT})
  --min-ratio <n>     una capa AJUS se corrige si cuesta >= n veces o <= 1/n de su costo de compra de referencia (por defecto 1.5)`;

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' }, apply: { type: 'boolean', default: false }, rollback: { type: 'string' },
      'confirm-db': { type: 'string' }, 'min-ratio': { type: 'string' }, help: { type: 'boolean', default: false },
    },
  });
  if (values.help) { console.log(USAGE); return; }
  if (values.apply || values.rollback) assertConfirmedDb(values['confirm-db'], process.env.DB_NAME);

  const pool = await getPool();
  try {
    if (values.rollback) {
      const r = await restoreRun(pool, values.rollback);
      console.log(`Capas restauradas: ${r.restored} | omitidas (cambiaron después): ${r.skipped}`);
      if (r.restored + r.skipped === 0) {
        console.log(`⚠ La corrida ${values.rollback} no tiene cambios en ${process.env.DB_SERVER}/${process.env.DB_NAME}; revise el runId.`);
        process.exitCode = 1;
      } else if (r.skipped) process.exitCode = 1;
      return;
    }

    const minRatio = values['min-ratio'] ? Number(values['min-ratio']) : undefined;
    if (minRatio !== undefined && !(minRatio > 1)) throw new Error('--min-ratio debe ser mayor que 1');
    const plan = planAjusteCostRepair(await listOpenAjusLayers(pool), { minRatio });

    const outPath = values.out ?? DEFAULT_OUT;
    await mkdir(dirname(outPath), { recursive: true });
    const columns = [
      ['coArt', 'Artículo'], ['description', 'Descripción'], ['fecha', 'Fecha capa'],
      ['remaining', 'Cantidad restante'], ['costoOld', 'Costo actual (BSD)'], ['costoNew', 'Costo nuevo (BSD)'],
      ['refFecha', 'Fecha compra de referencia'], ['reason', 'Motivo'],
    ].map(([key, label], i) => ({ key, label, defaultVisible: true, defaultOrder: i }));
    await writeFile(outPath, buildCsv(columns, plan.fixes as unknown as Record<string, unknown>[]), 'utf8');

    console.log(`Capas AJUS abiertas a corregir: ${plan.fixes.length} | sin cambio: ${plan.untouched} | sin referencia de compra: ${plan.review.length}`);
    for (const f of plan.fixes) {
      console.log(`  ${f.coArt} ${f.description.slice(0, 32).padEnd(32)} ${f.fecha}  restante ${f.remaining}  ${f.costoOld} -> ${f.costoNew}  (x${(f.costoOld / f.costoNew).toFixed(2)}) ${f.reason}`);
    }
    if (plan.review.length) console.log(`  ${plan.review.length} capas AJUS abiertas no tienen ningún costo de compra (COMP/PROV) anterior (productos terminados, empaques): no se tocan.`);
    console.log(`Diff: ${outPath}`);

    if (!values.apply) { console.log('Simulación: no se escribió nada. Use --apply --confirm-db para aplicar.'); return; }

    const runId = crypto.randomUUID();
    console.log(`Aplicando en ${process.env.DB_SERVER}/${process.env.DB_NAME} (corrida ${runId})...`);
    let done = 0;
    const failures: string[] = [];
    for (const f of plan.fixes) {
      try { await fixLayerCost(pool, runId, f.id, f.costoNew); done++; }
      catch (e) { failures.push(`${f.coArt} ${f.id}: ${e instanceof Error ? e.message : e}`); }
    }
    console.log(`\nCapas corregidas: ${done}${failures.length ? ` | fallos: ${failures.length}` : ''}`);
    for (const m of failures) console.log(`  ✗ ${m}`);
    console.log(`Para revertir: bun run ajuste-costs:repair -- --rollback ${runId} --confirm-db ${process.env.DB_NAME}`);
    process.exitCode = failures.length ? 1 : 0;
  } finally {
    await pool.close();
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
