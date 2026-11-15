import sql from 'mssql';
import type { QueryFilters } from '../query-reports';
import type { LineAgg } from '../tax-buckets';

// PROVISIONAL: confirm against live ERP so that base + exento + iva = total_neto (plan Task 1/5).
// KB says reng_neto includes tax; unverified.
const lineBaseExpr = 'r.reng_neto - r.monto_imp';

// NOTE: column names (saSegmento.seg_des, saVendedor.ven_des, saFacturaVentaReng.*,
// saDocumentoVenta.fec_venc/total_neto, ...) are sourced from the Profit Plus knowledge
// base and have NOT been verified against the live ERP (it was unreachable when written).
export async function fetchCxcPendientes(
  pool: sql.ConnectionPool,
  filters: QueryFilters,
): Promise<Record<string, unknown>[]> {
  const bind = (request: sql.Request): string => {
    if (!(filters.startDate && filters.endDate)) return '';
    request.input('startDate', sql.Date, new Date(`${filters.startDate}T00:00:00Z`));
    request.input('endDate', sql.Date, new Date(`${filters.endDate}T00:00:00Z`));
    return 'AND d.fec_emis >= @startDate AND d.fec_emis < DATEADD(day, 1, @endDate)';
  };
  const openFact = `
      d.co_tipo_doc = 'FACT'
      AND d.saldo <> 0
      AND ISNULL(d.anulado, 0) = 0`;

  const hReq = pool.request();
  const hDate = bind(hReq);
  const headers = (await hReq.query(`
    SELECT d.nro_doc, d.fec_emis, d.fec_venc, d.total_neto, c.cli_des,
           v.ven_des AS vendedor, s.seg_des AS tipo_cliente
    FROM saDocumentoVenta d
    INNER JOIN saCliente c ON c.co_cli = d.co_cli
    LEFT JOIN saVendedor v
      ON v.co_ven = COALESCE(NULLIF(RTRIM(d.co_ven), ''), RTRIM(c.co_ven))
    LEFT JOIN saSegmento s ON s.co_seg = c.co_seg
    WHERE ${openFact}
      ${hDate}
    ORDER BY c.cli_des, d.fec_emis, d.nro_doc
  `)).recordset as Record<string, unknown>[];

  const lReq = pool.request();
  const lDate = bind(lReq);
  const lineRows = (await lReq.query(`
    SELECT r.doc_num, r.tipo_imp,
           SUM(${lineBaseExpr}) AS base, SUM(r.monto_imp) AS iva
    FROM saFacturaVentaReng r
    INNER JOIN saDocumentoVenta d ON d.nro_doc = r.doc_num
    WHERE ${openFact}
      ${lDate}
    GROUP BY r.doc_num, r.tipo_imp
  `)).recordset as Record<string, unknown>[];

  const byDoc = new Map<string, LineAgg[]>();
  for (const l of lineRows) {
    const key = String(l.doc_num).trim();
    const agg: LineAgg = {
      tipoImp: String(l.tipo_imp ?? '').trim(),
      base: Number(l.base ?? 0),
      iva: Number(l.iva ?? 0),
    };
    const list = byDoc.get(key);
    if (list) list.push(agg); else byDoc.set(key, [agg]);
  }
  return headers.map(h => ({ ...h, lines: byDoc.get(String(h.nro_doc).trim()) ?? [] }));
}
