import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { todayIso } from '@/lib/pricing/dates';
import { currentPrices } from '@/lib/pricing/list-import/run';
import { realRatesErp } from '@/lib/pricing/rates-erp-adapter';
import { realSegmentErp } from '@/lib/pricing/segment-erp';
import { assertConfirmedDb } from '@/lib/customer-mapping/diff-csv';
import { applyWorkbook, type Step as ApplyStep } from '@/lib/pricing/xlsx/apply';
import { fetchDwhProducts, partitionByScope } from '@/lib/pricing/xlsx/scope';
import { parseWorkbook, planWorkbook, type WorkbookPlan } from '@/lib/pricing/xlsx/import';

const STEPS = ['lists', 'promotions', 'customers', 'discounts'] as const;
type Step = (typeof STEPS)[number];

const USAGE = `Uso:
  bun run pricing:import-xlsx -- --file <ruta.xlsx>   # simulación (por defecto)
  --step lists|promotions|customers|discounts|all     # por defecto all: en orden, se detiene en el primer paso con problemas
  --apply --confirm-db <DB_NAME>                      # escribe en Profit (lists, promotions, customers; all = en ese orden)
  Para revertir los movimientos de clientes: bun run tipo-cliente:apply -- --rollback <runId> --confirm-db <DB_NAME>`;
const RUNS_DIR = 'data/tipo-cliente/runs';

const fmt = (n: number) => n.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
const MAX_WARN = 40;

type Deps = { rates: ReturnType<typeof realRatesErp>; segments: ReturnType<typeof realSegmentErp>; db: ReturnType<typeof getDb> };

/** Prints one step the way the three single-purpose scripts do; returns that step's problems. */
async function printStep(step: Step, plan: WorkbookPlan, deps: Deps): Promise<string[]> {
  if (step === 'lists') {
    console.log(`\n== Listas (${plan.lists.lists.length}) ==`);
    for (const l of plan.lists.lists) {
      const before = await currentPrices({ erp: deps.rates, db: deps.db }, l);
      console.log(`\n${l.key} «${l.nombre}» ${l.coMone}, desde ${l.desde} — ${l.existingCoPrecio ? `existe (${l.existingCoPrecio})` : 'SE CREARÁ'} — ${l.changes.length} precios`);
      for (const c of l.changes) {
        const b = before.get(c.coArt);
        console.log(`  ${c.coArt.padEnd(14)} ${c.artDes.slice(0, 34).padEnd(34)} ${b === undefined ? '(nuevo)'.padStart(10) : fmt(b).padStart(10)} → ${fmt(c.monto)}`);
      }
    }
    return plan.lists.problems;
  }
  if (step === 'promotions') {
    console.log(`\n== Promociones (${plan.promos.promos.length}) ==`);
    for (const p of plan.promos.promos) {
      const where = p.target.kind === 'existing' ? `lista ${p.target.coPrecio} «${p.target.desPrecio}»` : `lista «${p.target.key}» (aún no existe en Profit)`;
      console.log(`\n«${p.name}» ${p.startsOn} → ${p.endsOn}, ${where} — ${p.alreadyExists ? 'YA EXISTE, se omite' : `${p.items.length} artículos`}`);
      if (!p.alreadyExists) {
        for (const i of p.items) console.log(`  ${i.coArt.padEnd(14)} ${i.artDes.slice(0, 34).padEnd(34)} ${i.regular === null ? '?' : String(i.regular)} → ${i.monto}`);
      }
    }
    for (const w of plan.promos.warnings) console.log(`  ⚠ ${w}`);
    return plan.promos.problems;
  }
  if (step === 'customers') {
    console.log('\n== Clientes ==');
    const c = plan.customers;
    if (!c) {
      console.log('  Sin planificar: hay clientes asignados a listas que aún no existen en Profit (se asignan después de crearlas).');
      return [];
    }
    console.log(`Clientes a mover: ${c.moves.length} | ya en su segmento: ${c.unchanged} | sin asignar (vacío): ${c.blank}`);
    for (const s of c.segmentsToCreate) console.log(`Se creará un segmento «${s.desTipo}» para la lista ${s.coPrecio}`);
    const byTarget = new Map<string, number>();
    for (const m of c.moves) byTarget.set(`lista ${m.coPrecio}`, (byTarget.get(`lista ${m.coPrecio}`) ?? 0) + 1);
    for (const [k, n] of [...byTarget].sort()) console.log(`  → ${k}: ${n} clientes`);
    return c.problems;
  }
  console.log(`\n== Descuentos por cliente (${plan.discounts.sets.length} listas especiales) ==`);
  for (const s of plan.discounts.sets) {
    for (const c of s.customers) console.log(`  ${c.coCli} → lista especial ${s.key} (${s.overrides.size} artículos distintos)`);
  }
  return plan.discounts.errors.map(e => `Descuentos por cliente: ${e}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' }, apply: { type: 'boolean', default: false }, 'confirm-db': { type: 'string' },
      step: { type: 'string', default: 'all' }, help: { type: 'boolean', default: false },
    },
  });
  if (values.help) { console.log(USAGE); return; }
  if (!values.file) { console.error(`Falta --file <ruta.xlsx>\n${USAGE}`); process.exit(2); }
  const step = values.step ?? 'all';
  if (step !== 'all' && !(STEPS as readonly string[]).includes(step)) { console.error(`--step inválido: ${step}\n${USAGE}`); process.exit(2); }

  if (values.apply && step === 'discounts') { console.error('el paso discounts aún no está implementado'); process.exit(2); }
  if (values.apply) assertConfirmedDb(values['confirm-db'], process.env.DB_NAME);

  let buf: Buffer;
  try { buf = readFileSync(values.file); } catch { console.error(`No se pudo leer ${values.file}`); process.exit(1); }

  const erp = await getPool();
  const dwh = await getDwhPool();
  try {
    const deps: Deps = { rates: realRatesErp(erp), segments: realSegmentErp(erp), db: getDb() };
    const { inScope } = partitionByScope(await deps.rates.listArticles({ limit: 5000 }), await fetchDwhProducts(dwh));
    console.log(`Base de datos: ${process.env.DB_SERVER}/${process.env.DB_NAME}`);

    const parsed = parseWorkbook(buf, inScope);
    if (parsed.errors.length) {
      console.log('');
      for (const e of parsed.errors) console.log(`  ✗ ${e}`);
      process.exitCode = 1;
      return;
    }
    const today = todayIso();
    const plan = await planWorkbook(deps, parsed, today);

    if (values.apply) {
      if (plan.problems.length) {
        console.log('');
        for (const p of plan.problems) console.log(`  ✗ ${p}`);
        console.log('\nEl plan tiene problemas: no se escribió nada.');
        process.exitCode = 1;
        return;
      }
      for (const w of plan.warnings.slice(0, MAX_WARN)) console.log(`  ⚠ ${w}`);
      const runId = new Date().toISOString().replace(/[:.]/g, '-');
      const actor = { id: 'import-xlsx', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' };
      const runFile = `${RUNS_DIR}/${runId}.jsonl`;
      const outcomes = await applyWorkbook({ ...deps, today }, plan, parsed, step as ApplyStep, actor, runFile);
      for (const o of outcomes) {
        console.log(`\n== ${o.step} — ${o.status === 'ok' ? 'listo' : o.status === 'skipped' ? 'omitido' : 'CON PROBLEMAS'} ==`);
        for (const l of o.lines) console.log(l);
      }
      if (existsSync(runFile)) {
        console.log(`\nCorrida de clientes: ${runId}`);
        console.log(`Para revertir: bun run tipo-cliente:apply -- --rollback ${runId} --confirm-db ${process.env.DB_NAME}`);
      }
      if (outcomes.some(o => o.status === 'failed')) {
        console.log('\nAlgún paso falló; los pasos siguientes se omitieron. Se puede volver a ejecutar: lo ya aplicado se omite.');
        process.exitCode = 1;
      }
      return;
    }

    let failed = false;
    for (const s of step === 'all' ? STEPS : [step as Step]) {
      const problems = await printStep(s, plan, deps);
      if (problems.length) {
        console.log('');
        for (const p of problems) console.log(`  ✗ ${p}`);
        failed = true;
        break;
      }
    }
    for (const w of plan.warnings.slice(0, MAX_WARN)) console.log(`  ⚠ ${w}`);
    if (plan.warnings.length > MAX_WARN) console.log(`  ⚠ ... y ${plan.warnings.length - MAX_WARN} avisos más`);
    if (failed) { process.exitCode = 1; return; }
    console.log('\nSimulación: no se escribió nada.');
  } finally {
    await erp.close();
    await dwh.close();
  }
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
