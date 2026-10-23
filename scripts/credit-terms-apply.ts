import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { applyPlan, previewPlan, rollbackRun } from '@/lib/credit-terms/apply';
import { parseCreditTermsCsv } from '@/lib/credit-terms/csv';
import { mssqlCreditGateway } from '@/lib/credit-terms/erp';
import { buildCreditPlan } from '@/lib/credit-terms/plan';
import { invoiceDiffCsv, summarizeReport } from '@/lib/credit-terms/report';
import { assertConfirmedDb } from '@/lib/customer-mapping/diff-csv';

const DEFAULT_FILE = 'data/credit-terms/2026-10.csv';
const DEFAULT_OUT = 'tmp/credit-terms-dry-run.csv';

const USAGE = `Uso (la tabla es el archivo versionado ${DEFAULT_FILE}; --file lo reemplaza):
  bun run credit-terms:apply                                       # simulación (por defecto)
  bun run credit-terms:apply -- --apply --confirm-db <DB_NAME>     # aplica
  bun run credit-terms:apply -- --rollback <runId> --confirm-db <DB_NAME>   # revierte una corrida
  --out <ruta>   CSV con las facturas que cambiarían (por defecto ${DEFAULT_OUT})`;

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' }, out: { type: 'string' }, apply: { type: 'boolean', default: false },
      rollback: { type: 'string' }, 'confirm-db': { type: 'string' }, help: { type: 'boolean', default: false },
    },
  });
  if (values.help) { console.log(USAGE); return; }
  if (values.apply || values.rollback) assertConfirmedDb(values['confirm-db'], process.env.DB_NAME);

  const pool = await getPool();
  const gateway = mssqlCreditGateway(pool);
  try {
    if (values.rollback) {
      const r = await rollbackRun(gateway, values.rollback);
      console.log(`Facturas restauradas: ${r.invoices.restored} | clientes restaurados: ${r.customers.restored}`);
      const skipped = [...r.invoices.skipped, ...r.customers.skipped];
      for (const s of skipped.slice(0, 30)) console.log(`  ⚠ ${s.key}: ${s.reason}`);
      process.exitCode = skipped.length ? 1 : 0;
      return;
    }

    const { rows, errors } = parseCreditTermsCsv(await readFile(values.file ?? DEFAULT_FILE, 'utf8'));
    if (errors.length) throw new Error(`CSV inválido:\n${errors.join('\n')}`);
    const plan = buildCreditPlan(rows, await gateway.listCustomers());

    const report = await previewPlan(gateway, plan);
    const s = summarizeReport(report);
    const outPath = values.out ?? DEFAULT_OUT;
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, invoiceDiffCsv(report.invoiceChanges), 'utf8');
    console.log(`Clientes por plazo: ${Object.entries(s.customersByDays).map(([d, n]) => `${d} días=${n}`).join(' | ')} | ` +
      `omitidos: ${plan.skipped.length}`);
    console.log(`Clientes a escribir: ${s.customerWrites} | facturas a corregir: ${s.invoices} | saldo afectado: ${s.saldo}`);
    for (const p of plan.problems.slice(0, 30)) console.log(`  ✗ ${p}`);
    console.log(`Diff de facturas: ${outPath}`);
    if (plan.problems.length) { process.exitCode = 1; if (values.apply) return; }

    if (!values.apply) { console.log('Simulación: no se escribió nada. Use --apply --confirm-db para aplicar.'); return; }

    const res = await applyPlan({ gateway, log: console.log, newRunId: () => crypto.randomUUID() }, plan);
    console.log(`\nCorrida ${res.runId} (${process.env.DB_SERVER}/${process.env.DB_NAME}): ` +
      `${res.customersWritten} clientes, ${res.invoicesFixed} facturas${res.failures.length ? `, ${res.failures.length} fallos` : ''}`);
    console.log(`Para revertir: bun run credit-terms:apply -- --rollback ${res.runId} --confirm-db ${process.env.DB_NAME}`);
    for (const f of res.failures.slice(0, 30)) console.log(`  ✗ ${f}`);
    console.log("Luego refresque CxC: bun run dwh:snapshot-load");
    process.exitCode = res.failures.length ? 1 : 0;
  } finally {
    await pool.close();
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
