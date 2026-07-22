import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';

export async function queryComprasData(
  startDate: Date | string,
  endDate: Date | string,
  sucursal: string
): Promise<Record<string, unknown>[]> {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  const pool = await getPool();
  const result = await pool
    .request()
    .input('cCo_Sucursal', sql.Char(6), sucursal)
    .input('sCo_fecha_d', sql.SmallDateTime, `${start}`)
    .input('sCo_fecha_h', sql.SmallDateTime, `${end}`)
    .execute('[dbo].[RepLibroCompra]');

  return result.recordset;
}
