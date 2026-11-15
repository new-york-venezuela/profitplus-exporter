import sql from 'mssql';
import type { QueryFilters } from '../query-reports';

// NOTE: column names (saSegmento.seg_des, saVendedor.ven_des, saCliente.contrib,
// saDocumentoVenta.monto_imp, ...) are sourced from the Profit Plus knowledge base
// and have NOT been verified against the live ERP (it was unreachable when written).
export async function fetchRetenciones(
  pool: sql.ConnectionPool,
  filters: QueryFilters,
): Promise<Record<string, unknown>[]> {
  const request = pool.request();
  let dateClause = '';
  if (filters.startDate && filters.endDate) {
    request.input('startDate', sql.Date, new Date(`${filters.startDate}T00:00:00Z`));
    request.input('endDate', sql.Date, new Date(`${filters.endDate}T00:00:00Z`));
    dateClause = 'AND d.fec_emis >= @startDate AND d.fec_emis < DATEADD(day, 1, @endDate)';
  }
  const result = await request.query(`
    SELECT d.co_tipo_doc, d.nro_doc, d.fec_emis, d.co_cli, c.cli_des,
           v.ven_des AS vendedor, s.seg_des AS tipo_cliente,
           d.monto_imp, d.saldo
    FROM saDocumentoVenta d
    INNER JOIN saCliente c ON c.co_cli = d.co_cli
    LEFT JOIN saVendedor v
      ON v.co_ven = COALESCE(NULLIF(RTRIM(d.co_ven), ''), RTRIM(c.co_ven))
    LEFT JOIN saSegmento s ON s.co_seg = c.co_seg
    WHERE d.saldo <> 0
      AND ISNULL(d.anulado, 0) = 0
      AND c.contrib = 1
      AND d.co_tipo_doc IN ('FACT', 'N/CR', 'N/DB')
      ${dateClause}
    ORDER BY c.cli_des, d.fec_emis, d.nro_doc
  `);
  return result.recordset;
}
