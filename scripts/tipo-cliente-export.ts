// bun run tipo-cliente:export [--out <file>]
// Read-only. One row per active customer with its current tip_cli (segment) and price list, plus the list
// its recent invoice lines actually used, and a blank `tip_cli_nuevo` column to fill in by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getPool } from '../lib/db/mssql';
import { buildCsv } from '../lib/csv';
import { trimStrings } from '../lib/trim-strings';

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
  const { recordset } = await pool.request().query(`
    SELECT RTRIM(c.co_cli) AS co_cli, RTRIM(c.cli_des) AS nombre, RTRIM(c.co_ven) AS co_ven,
           RTRIM(c.tip_cli) AS tip_cli_actual, RTRIM(t.des_tipo) AS des_tipo_actual, RTRIM(t.co_precio) AS lista_actual,
           u.lista_usada_90d, u.moneda_90d, ISNULL(u.lineas_90d, 0) AS lineas_90d
    FROM saCliente c
    LEFT JOIN saTipoCliente t ON t.tip_cli = c.tip_cli
    OUTER APPLY (
      SELECT TOP 1 RTRIM(r.co_precio) AS lista_usada_90d, RTRIM(f.co_mone) AS moneda_90d, COUNT(*) AS lineas_90d
      FROM saFacturaVenta f JOIN saFacturaVentaReng r ON r.doc_num = f.doc_num
      WHERE f.co_cli = c.co_cli AND f.anulado = 0 AND f.fec_emis >= DATEADD(day, -90, GETDATE())
      GROUP BY r.co_precio, f.co_mone ORDER BY COUNT(*) DESC
    ) u
    WHERE c.inactivo = 0
    ORDER BY RTRIM(c.cli_des)`);
  const rows = trimStrings(recordset).map((r: Record<string, unknown>) => ({ ...r, tip_cli_nuevo: '' }));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildCsv(COLUMNS, rows));
  console.log(`${rows.length} customers -> ${out}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
