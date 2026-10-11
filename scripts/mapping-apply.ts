import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { applyPlan, rollbackRun } from '@/lib/customer-mapping/apply';
import { csvToMapping } from '@/lib/customer-mapping/csv';
import { assertConfirmedDb, deriveSince, diffCsv } from '@/lib/customer-mapping/diff-csv';
import { findSellerMismatches, runDwhRestateLoads, upsertDwhMapping } from '@/lib/customer-mapping/dwh';
import { mssqlGateway } from '@/lib/customer-mapping/erp';
import { buildPlan } from '@/lib/customer-mapping/plan';
import { sqliteRunStore } from '@/lib/customer-mapping/runs-repo';
import { buildConfig, dwhDatabaseName } from './migrate-dwh';

const USAGE = `Uso:
  bun run mapping:apply -- --file data/customer-mapping/2026-03.csv                       # simulación (por defecto)
  bun run mapping:apply -- --file ... --apply --confirm-db <DB_NAME> [--no-dwh]           # aplica
  bun run mapping:apply -- --rollback <runId> --confirm-db <DB_NAME>                       # revierte
  bun run mapping:apply -- --file ... --verify                                             # compara el DWH con el CSV`;

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' }, apply: { type: 'boolean', default: false },
      rollback: { type: 'string' }, 'confirm-db': { type: 'string' },
      'no-dwh': { type: 'boolean', default: false }, verify: { type: 'boolean', default: false },
    },
  });
  if (values.apply || values.rollback) assertConfirmedDb(values['confirm-db'], process.env.DB_NAME);
  if (!values.rollback && !values.file) throw new Error(USAGE);

  const erpPool = await getPool();
  let dwhPool: sql.ConnectionPool | undefined;
  const getDwh = async () => (dwhPool ??= await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect());
  const runs = sqliteRunStore(getDb());
  const erp = mssqlGateway(erpPool);
  const deps = { erp, runs, log: console.log };

  try {
    if (values.rollback) {
      const r = await rollbackRun(deps, values.rollback);
      console.log(r.failures.length ? `Reversión con ${r.failures.length} fallos:\n${r.failures.join('\n')}` : 'Reversión completa.');
      process.exitCode = r.failures.length ? 1 : 0;
      return;
    }

    const file = values.file as string;
    const { rows, errors } = csvToMapping(await readFile(file, 'utf8'));
    if (errors.length) throw new Error(`CSV inválido:\n${errors.join('\n')}`);
    const since = deriveSince(rows);

    if (values.verify) {
      const sinceKey = Number(since.replaceAll('-', ''));
      const bad = await findSellerMismatches(await getDwh(), rows, sinceKey);
      console.log(bad.length ? `${bad.length} grupos con vendedor distinto al mapeo:` : 'DWH coincide con el mapeo.');
      console.table(bad.slice(0, 30));
      process.exitCode = bad.length ? 1 : 0;
      return;
    }

    const plan = buildPlan({
      rows, since,
      customers: await erp.listCustomers(), activeSellers: await erp.listActiveSellers(),
      segments: await erp.listSegments(), docs: await erp.listSellerDocs(since),
    });
    const diffPath = file.replace(/\.csv$/, '.diff.csv');
    await writeFile(diffPath, diffCsv(plan), 'utf8');
    console.log(`Segmentos a crear: ${plan.segmentsToCreate.length} | clientes (grupo): ${plan.customerSegment.length} | ` +
      `clientes (vendedor): ${plan.customerSeller.length} | documentos: ${plan.docSeller.length} | problemas: ${plan.problems.length}`);
    for (const p of plan.problems.slice(0, 20)) console.log(`  ✗ [${p.kind}] ${p.coCli}: ${p.detail}`);
    console.log(`Diff completo: ${diffPath}`);
    if (plan.problems.length) process.exitCode = 1;

    if (!values.apply) { console.log('Simulación: no se escribió nada. Use --apply --confirm-db para aplicar.'); return; }

    const res = await applyPlan(deps, plan, { mappingFile: file });
    console.log(`Corrida ${res.runId}: ${res.failures.length ? `${res.failures.length} fallos` : 'OK'}`);
    for (const f of res.failures.slice(0, 20)) console.log(`  ✗ ${f}`);
    if (res.failures.length) { process.exitCode = 1; return; } // no DWH step on ERP failures

    if (!values['no-dwh']) {
      const dwh = await getDwh();
      await upsertDwhMapping(dwh, rows);
      await runDwhRestateLoads(dwh);
      console.log('DWH actualizado. Verifique con: bun run mapping:apply -- --file ' + file + ' --verify');
    }
  } finally {
    await dwhPool?.close();
    await erpPool.close();
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
