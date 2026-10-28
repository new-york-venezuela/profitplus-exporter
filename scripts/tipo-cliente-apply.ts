import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { assertConfirmedDb } from '@/lib/customer-mapping/diff-csv';
import { realRatesErp } from '@/lib/pricing/rates-erp-adapter';
import { realSegmentErp } from '@/lib/pricing/segment-erp';
import { parseTipoClienteCsv } from '@/lib/pricing/tipo-cliente-apply/csv';
import { applyTipoCliente, planTipoCliente, rollbackTipCliente } from '@/lib/pricing/tipo-cliente-apply/run';

const DEFAULT_FILE = 'data/tipo-cliente/2026-10-export.csv';
const RUNS_DIR = 'data/tipo-cliente/runs';

const USAGE = `Uso (el archivo es el que escribe tipo-cliente:export; --file lo reemplaza):
  bun run tipo-cliente:apply                                              # simulación (por defecto)
  bun run tipo-cliente:apply -- --apply --confirm-db <DB_NAME>            # mueve los clientes
  bun run tipo-cliente:apply -- --rollback <runId> --confirm-db <DB_NAME> # devuelve los clientes de una corrida
  --out <ruta>   CSV de simulación con antes → después (por defecto tmp/tipo-cliente-dry-run.csv)
En la columna tip_cli_nuevo: un código de segmento, o un código de lista de precios (L:09 fuerza «lista»). Vacío = no tocar.`;

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

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
  try {
    const deps = { segments: realSegmentErp(pool), rates: realRatesErp(pool), db: getDb() };
    const actor = { id: 'tipo-cliente-apply', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' };

    if (values.rollback) {
      const r = await rollbackTipCliente(deps, `${RUNS_DIR}/${values.rollback}.jsonl`, actor);
      console.log(`Clientes devueltos: ${r.restored} | omitidos: ${r.skipped.length}`);
      for (const s of r.skipped.slice(0, 30)) console.log(`  ⚠ ${s.coCli}: ${s.reason}`);
      process.exitCode = r.skipped.length ? 1 : 0;
      return;
    }

    const parsed = parseTipoClienteCsv(await readFile(values.file ?? DEFAULT_FILE, 'utf8'));
    if (parsed.errors.length) throw new Error(`CSV inválido:\n${parsed.errors.map(e => `  ✗ ${e}`).join('\n')}`);
    const plan = await planTipoCliente(deps, parsed.rows);

    console.log(`Base de datos: ${process.env.DB_SERVER}/${process.env.DB_NAME}`);
    console.log(`Clientes a mover: ${plan.moves.length} | ya en su segmento: ${plan.unchanged} | sin asignar (vacío): ${plan.blank}`);
    for (const s of plan.segmentsToCreate) console.log(`Se creará un segmento «${s.desTipo}» para la lista ${s.coPrecio}`);
    const byTarget = new Map<string, number>();
    for (const m of plan.moves) byTarget.set(`lista ${m.coPrecio}`, (byTarget.get(`lista ${m.coPrecio}`) ?? 0) + 1);
    for (const [k, n] of [...byTarget].sort()) console.log(`  → ${k}: ${n} clientes`);
    for (const w of plan.warnings.slice(0, 40)) console.log(`  ⚠ ${w}`);
    if (plan.warnings.length > 40) console.log(`  ⚠ ... y ${plan.warnings.length - 40} avisos más`);

    if (plan.problems.length) {
      for (const p of plan.problems) console.log(`  ✗ ${p}`);
      process.exitCode = 1;
      return;
    }
    if (!values.apply) {
      const out = values.out ?? 'tmp/tipo-cliente-dry-run.csv';
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `﻿co_cli,nombre,tip_cli_antes,tip_cli_despues,lista\r\n${plan.moves.map(m =>
        [m.coCli, q(m.nombre), m.fromTipCli, m.toTipCli ?? '(nuevo)', m.coPrecio].join(',')).join('\r\n')}\r\n`);
      console.log(`\nSimulación: no se escribió nada en Profit. Detalle en ${out}. Use --apply --confirm-db <DB_NAME> para aplicar.`);
      return;
    }

    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const runFile = `${RUNS_DIR}/${runId}.jsonl`;
    mkdirSync(RUNS_DIR, { recursive: true });
    const r = await applyTipoCliente(deps, plan, actor, runFile);
    for (const s of r.createdSegments) console.log(`Segmento ${s.tipCli} creado para la lista ${s.coPrecio}`);
    const ok = r.moves.filter(m => m.outcome === 'success').length;
    console.log(`Movidos: ${ok} de ${r.moves.length} | corrida: ${runId}`);
    const bad = r.moves.filter(m => m.outcome !== 'success');
    for (const m of bad) console.log(`  ✗ ${m.coCli} ${m.nombre}: ${m.outcome}${m.message ? ` — ${m.message}` : ''}`);
    if (ok > 0) console.log(`Para revertir: bun run tipo-cliente:apply -- --rollback ${runId} --confirm-db ${process.env.DB_NAME}`);
    if (bad.length) { console.log('Los que fallaron se pueden reintentar volviendo a ejecutar (los ya movidos se omiten).'); process.exitCode = 1; }
  } finally {
    await pool.close();
  }
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
