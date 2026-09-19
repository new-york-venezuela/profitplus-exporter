import { getPool } from '../lib/db/mssql';

export interface FixOptions {
  customer: string;
  from: string;
  to: string;
  apply: boolean;
}

export function parseArgs(argv: string[]): FixOptions {
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    const match = /^--([a-z]+)=(.+)$/.exec(arg);
    if (match) flags.set(match[1], match[2]);
  }

  const customer = flags.get('customer');
  if (!customer) throw new Error('Missing required flag: --customer=<co_cli>');
  const from = flags.get('from');
  if (!from) throw new Error('Missing required flag: --from=YYYY-MM-DD');
  const to = flags.get('to');
  if (!to) throw new Error('Missing required flag: --to=YYYY-MM-DD');

  return { customer, from, to, apply };
}

interface PreviewRow {
  nro_doc: string;
  fec_venc_old: Date;
  fec_venc_new: Date;
  saldo: number;
}

async function checkGuardrail(pool: Awaited<ReturnType<typeof getPool>>, customer: string): Promise<void> {
  const result = await pool.request()
    .input('coCli', customer)
    .query(`SELECT cond_pag FROM saCliente WHERE co_cli = @coCli`);
  const row = result.recordset[0] as { cond_pag: string | null } | undefined;
  if (!row) throw new Error(`Cliente ${customer} no encontrado`);
  if (!row.cond_pag || row.cond_pag === '000001') {
    throw new Error(
      `Cliente ${customer} tiene condición de pago Contado (000001) — corrija el cliente en Profit Plus antes de ejecutar esta reparación`
    );
  }

  const condResult = await pool.request()
    .input('coCond', row.cond_pag)
    .query(`SELECT dias_cred FROM saCondicionPago WHERE co_cond = @coCond`);
  const condRow = condResult.recordset[0] as { dias_cred: number | null } | undefined;
  if (!condRow) {
    throw new Error(`Condición de pago ${row.cond_pag} del cliente ${customer} no existe en saCondicionPago`);
  }
}

async function preview(pool: Awaited<ReturnType<typeof getPool>>, options: FixOptions): Promise<PreviewRow[]> {
  const result = await pool.request()
    .input('coCli', options.customer)
    .input('fecDesde', options.from)
    .input('fecHasta', options.to)
    .query(`
      SELECT
        d.nro_doc,
        d.fec_venc AS fec_venc_old,
        DATEADD(day, cp.dias_cred, d.fec_emis) AS fec_venc_new,
        d.saldo
      FROM saDocumentoVenta d
      INNER JOIN saCliente c ON c.co_cli = d.co_cli
      INNER JOIN saCondicionPago cp ON cp.co_cond = c.cond_pag
      WHERE d.co_cli = @coCli
        AND d.co_tipo_doc = 'FACT'
        AND ISNULL(d.anulado, 0) = 0
        AND d.saldo <> 0
        AND CAST(d.fec_emis AS date) BETWEEN @fecDesde AND @fecHasta
        AND d.fec_venc = d.fec_emis
      ORDER BY d.nro_doc
    `);
  return result.recordset as PreviewRow[];
}

function printPreview(rows: PreviewRow[]): void {
  if (rows.length === 0) {
    console.log('No invoices match — nothing to fix in this range.');
    return;
  }
  console.table(
    rows.map(r => ({
      nro_doc: r.nro_doc,
      fec_venc_old: r.fec_venc_old,
      fec_venc_new: r.fec_venc_new,
      saldo: r.saldo,
    }))
  );
}

export async function runFix(options: FixOptions): Promise<void> {
  const pool = await getPool();
  try {
    await checkGuardrail(pool, options.customer);

    const previewRows = await preview(pool, options);
    printPreview(previewRows);

    if (!options.apply) {
      console.log(`\n${previewRows.length} invoice(s) would change. Re-run with --apply to write these changes.`);
      return;
    }

    if (previewRows.length === 0) {
      return;
    }

    // .input() labels here bind BY NAME over the TDS RPC wire protocol
    // (mssql/tedious write "@<label>" for every parameter on .execute()) —
    // unlike .query(), where the label is just the placeholder text you
    // write into the SQL string yourself. These four labels must match the
    // stored procedure's actual declared parameter names exactly (no
    // leading @, the driver adds it), or SQL Server rejects the call before
    // any statement runs.
    //
    // result.recordset resolves to the stored procedure's OUTPUT clause (the
    // only result-producing statement it runs, since SET NOCOUNT ON
    // suppresses the rest) — if a future edit to the procedure adds another
    // result-producing statement before that OUTPUT, this would silently
    // start reporting the wrong rows.
    const result = await pool.request()
      .input('sCoCli', options.customer)
      .input('dFecDesde', options.from)
      .input('dFecHasta', options.to)
      .input('sCoUsIn', 'SYSTEM')
      .execute('pApiCorregirFechaVencimientoFactura');

    console.log(`\nApplied. ${result.recordset.length} invoice(s) updated:`);
    console.table(result.recordset);
    console.log(`\nRun 'bun run scripts/dwh-snapshot-load.ts' to refresh the CxC dashboard.`);
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  try {
    const options = parseArgs(process.argv.slice(2));
    runFix(options)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('[fix-invoice-due-dates] fatal error:', err instanceof Error ? err.message : err);
        process.exit(1);
      });
  } catch (err) {
    console.error('[fix-invoice-due-dates]', err instanceof Error ? err.message : err);
    console.error('Usage: bun run scripts/fix-invoice-due-dates.ts --customer=<co_cli> --from=YYYY-MM-DD --to=YYYY-MM-DD [--apply]');
    process.exit(1);
  }
}
