import type { ConnectionPool } from 'mssql';
import { trimStrings } from '@/lib/trim-strings';

export interface CustomerTypeRow {
  co_cli: string; nombre: string; co_ven: string;
  tip_cli_actual: string; des_tipo_actual: string; co_seg: string | null; des_seg: string | null; lista_actual: string;
  lista_usada_90d: string | null; moneda_90d: string | null; lineas_90d: number;
}

/** One row per active customer: current segment/list plus the list its last 90 days of invoice lines used. */
export async function fetchCustomerTypeRows(pool: ConnectionPool): Promise<CustomerTypeRow[]> {
  const { recordset } = await pool.request().query(`
    SELECT RTRIM(c.co_cli) AS co_cli, RTRIM(c.cli_des) AS nombre, RTRIM(c.co_ven) AS co_ven,
           RTRIM(c.tip_cli) AS tip_cli_actual, RTRIM(t.des_tipo) AS des_tipo_actual, RTRIM(c.co_seg) AS co_seg, RTRIM(g.seg_des) AS des_seg,
           RTRIM(t.co_precio) AS lista_actual,
           u.lista_usada_90d, u.moneda_90d, ISNULL(u.lineas_90d, 0) AS lineas_90d
    FROM saCliente c
    LEFT JOIN saTipoCliente t ON t.tip_cli = c.tip_cli
    LEFT JOIN saSegmento g ON g.co_seg = c.co_seg
    OUTER APPLY (
      SELECT TOP 1 RTRIM(r.co_precio) AS lista_usada_90d, RTRIM(f.co_mone) AS moneda_90d, COUNT(*) AS lineas_90d
      FROM saFacturaVenta f JOIN saFacturaVentaReng r ON r.doc_num = f.doc_num
      WHERE f.co_cli = c.co_cli AND f.anulado = 0 AND f.fec_emis >= DATEADD(day, -90, GETDATE())
      GROUP BY r.co_precio, f.co_mone ORDER BY COUNT(*) DESC
    ) u
    WHERE c.inactivo = 0
    ORDER BY RTRIM(c.cli_des)`);
  return trimStrings(recordset) as unknown as CustomerTypeRow[];
}
