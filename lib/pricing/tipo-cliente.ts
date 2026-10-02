// lib/pricing/tipo-cliente.ts
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

export interface SegmentRow {
  tipCli: string;
  desTipo: string;
  coPrecio: string;
  desPrecio: string | null;
  customerCount: number;
  /** saTipoCliente.validador as '0x…' hex (16 digits). */
  validador: string;
}

const SEGMENT_SELECT = `
  SELECT RTRIM(t.tip_cli)    AS tipCli,
         RTRIM(t.des_tipo)   AS desTipo,
         RTRIM(t.co_precio)  AS coPrecio,
         RTRIM(p.des_precio) AS desPrecio,
         (SELECT COUNT(*) FROM saCliente c WHERE c.tip_cli = t.tip_cli) AS customerCount,
         CONVERT(VARCHAR(18), CONVERT(VARBINARY(8), t.validador), 1) AS validador
  FROM saTipoCliente t
  LEFT JOIN saTipoPrecio p ON p.co_precio = t.co_precio`;

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/i, ''), 'hex');
}

export async function listSegmentRows(pool: ConnectionPool): Promise<SegmentRow[]> {
  const r = await pool.request().query(`${SEGMENT_SELECT} ORDER BY t.des_tipo`);
  return r.recordset as SegmentRow[];
}

export async function getSegmentRow(pool: ConnectionPool, tipCli: string): Promise<SegmentRow | null> {
  const r = await pool.request()
    .input('tipCli', sql.Char(6), tipCli)
    .query(`${SEGMENT_SELECT} WHERE RTRIM(t.tip_cli) = RTRIM(@tipCli)`);
  return (r.recordset[0] as SegmentRow | undefined) ?? null;
}

export async function listTipCliCodes(pool: ConnectionPool): Promise<string[]> {
  const r = await pool.request().query(`SELECT RTRIM(tip_cli) AS tipCli FROM saTipoCliente`);
  return r.recordset.map((x: { tipCli: string }) => x.tipCli);
}

export async function createSegmentErp(
  pool: ConnectionPool,
  p: { tipCli: string; desTipo: string; coPrecio: string; user: string },
): Promise<void> {
  await pool.request()
    .input('sTip_Cli', sql.Char(6), p.tipCli)
    .input('sDes_Tipo', sql.VarChar(60), p.desTipo)
    .input('sCo_Precio', sql.Char(6), p.coPrecio)
    .input('sCo_Us_In', sql.Char(6), p.user.slice(0, 6))
    .input('sRevisado', sql.Char(1), null)
    .input('sTrasnfe', sql.Char(1), null)
    .input('sCo_Sucu_In', sql.Char(6), null)
    .execute('pInsertarTipoCliente');
}

export async function updateSegmentErp(
  pool: ConnectionPool,
  p: { tipCli: string; desTipo: string | null; coPrecio: string | null; validador: string; user: string },
): Promise<'success' | 'conflict'> {
  const r = await pool.request()
    .input('sTipCli', sql.Char(6), p.tipCli)
    .input('sDesTipo', sql.VarChar(60), p.desTipo)
    .input('sCoPrecio', sql.Char(6), p.coPrecio)
    .input('tsValidador', sql.Binary, hexToBuffer(p.validador))
    .input('sCoUsMo', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiActualizarTipoCliente');
  return r.recordset?.[0]?.updated === 1 ? 'success' : 'conflict';
}
