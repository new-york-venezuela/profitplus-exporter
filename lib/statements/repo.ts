import sql from 'mssql';
import { trimStrings } from '@/lib/trim-strings';
import type { StatementDoc, UsdRate } from './types';

/** mssql yields UTC-midnight Dates; the builder uses local components. */
export function dbDateToLocal(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** mssql yields UTC Dates; keep the time of day, as local components (for same-day rate ordering). */
export function dbDateTimeToLocal(d: Date): Date {
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds(),
  );
}

export function mapDocRow(row: Record<string, unknown>): StatementDoc {
  const [r] = trimStrings([row]);
  return {
    coTipoDoc: String(r.co_tipo_doc ?? '').toUpperCase(),
    nroDoc: String(r.nro_doc ?? ''),
    fecEmis: dbDateToLocal(r.fec_emis as Date),
    fecVenc: r.fec_venc ? dbDateToLocal(r.fec_venc as Date) : null,
    saldoBsd: Number(r.saldo),
  };
}

export function mapRateRows(rows: Record<string, unknown>[]): UsdRate[] {
  return rows
    .filter(r => r.tasa_v != null && Number(r.tasa_v) > 0)
    .map(r => ({ fecha: dbDateTimeToLocal(r.fecha as Date), tasaV: Number(r.tasa_v) }));
}

export async function fetchOpenDocs(pool: sql.ConnectionPool, coCli: string): Promise<StatementDoc[]> {
  const result = await pool.request()
    .input('coCli', sql.VarChar, coCli)
    .query(`
      SELECT co_tipo_doc, nro_doc, fec_emis, fec_venc, saldo
      FROM saDocumentoVenta
      WHERE co_cli = @coCli AND ISNULL(anulado, 0) = 0 AND saldo <> 0
      ORDER BY fec_emis, nro_doc
    `);
  return result.recordset.map(mapDocRow);
}

export async function fetchUsdRates(pool: sql.ConnectionPool): Promise<UsdRate[]> {
  const result = await pool.request().query(`
    SELECT fecha, tasa_v FROM saTasa WHERE co_mone = 'USD' ORDER BY fecha
  `);
  return mapRateRows(result.recordset);
}

export async function fetchCustomerHeader(
  pool: sql.ConnectionPool,
  coCli: string,
): Promise<{ coCli: string; name: string; rif: string | null; address: string | null } | null> {
  const result = await pool.request()
    .input('coCli', sql.VarChar, coCli)
    .query(`SELECT co_cli, cli_des, rif, direc1 FROM saCliente WHERE co_cli = @coCli`);
  const [row] = trimStrings(result.recordset);
  if (!row) return null;
  return {
    coCli: String(row.co_cli),
    name: String(row.cli_des ?? ''),
    rif: row.rif ? String(row.rif) : null,
    address: row.direc1 ? String(row.direc1) : null,
  };
}

export async function fetchCompanyName(pool: sql.ConnectionPool): Promise<string> {
  const result = await pool.request().query(`SELECT TOP 1 emp_nom FROM par_emp`);
  const [row] = trimStrings(result.recordset);
  return row ? String(row.emp_nom ?? '') : '';
}

export async function listCustomersWithOpenDocs(pool: sql.ConnectionPool): Promise<string[]> {
  const result = await pool.request().query(`
    SELECT DISTINCT RTRIM(co_cli) AS co_cli
    FROM saDocumentoVenta
    WHERE ISNULL(anulado, 0) = 0 AND saldo <> 0
    ORDER BY co_cli
  `);
  return result.recordset.map(r => String(r.co_cli).trim());
}

export async function listCustomersForPicker(
  pool: sql.ConnectionPool,
): Promise<{ co_cli: string; cli_des: string }[]> {
  const result = await pool.request().query(`SELECT co_cli, cli_des FROM saCliente ORDER BY cli_des`);
  return trimStrings(result.recordset) as { co_cli: string; cli_des: string }[];
}
