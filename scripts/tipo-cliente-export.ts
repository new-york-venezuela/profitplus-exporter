// bun run tipo-cliente:export [--out <file>]
// Read-only. One row per active customer with its current tip_cli (segment) and price list, plus the list
// its recent invoice lines actually used, and a blank `tip_cli_nuevo` column to fill in by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getPool } from '../lib/db/mssql';
import { buildCsv } from '../lib/csv';
import { fetchCustomerTypeRows } from '../lib/pricing/xlsx/customer-rows';

const outIdx = process.argv.indexOf('--out');
const out = outIdx > -1 ? process.argv[outIdx + 1] : 'data/tipo-cliente/2026-10-export.csv';
if (!out) { console.error('--out needs a path'); process.exit(2); }

const COLUMNS = [
  ['co_cli', 'co_cli'], ['nombre', 'nombre'], ['co_ven', 'co_ven'],
  ['tip_cli_actual', 'tip_cli_actual'], ['des_tipo_actual', 'des_tipo_actual'], ['lista_actual', 'lista_actual'],
  ['lista_usada_90d', 'lista_usada_90d'], ['moneda_90d', 'moneda_90d'], ['lineas_90d', 'lineas_90d'],
  ['tip_cli_nuevo', 'tip_cli_nuevo'],
].map(([key, label], i) => ({ key, label, defaultVisible: true, defaultOrder: i }));

async function main() {
  const pool = await getPool();
  const recordset = await fetchCustomerTypeRows(pool);
  const rows = recordset.map(r => ({ ...r, tip_cli_nuevo: '' }));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildCsv(COLUMNS, rows));
  console.log(`${rows.length} customers -> ${out}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
