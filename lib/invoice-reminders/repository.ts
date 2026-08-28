import sql from 'mssql';
import { trimStrings } from '@/lib/trim-strings';
import type { CustomerInvoiceGroup, RawInvoiceRow, ReminderInvoice } from './types';

export function groupInvoiceRows(rows: RawInvoiceRow[]): CustomerInvoiceGroup[] {
  const byCustomer = new Map<string, CustomerInvoiceGroup>();

  for (const row of rows) {
    let group = byCustomer.get(row.co_cli);
    if (!group) {
      group = {
        coCli:    row.co_cli,
        cliDes:   row.cli_des,
        email:    row.email,
        dueSoon:  [],
        dueToday: [],
        overdue:  [],
      };
      byCustomer.set(row.co_cli, group);
    }

    const invoice: ReminderInvoice = {
      nroDoc:      row.nro_doc,
      nControl:    row.n_control,
      fecVenc:     row.fec_venc,
      saldoBs:     row.saldo,
      saldoUsd:    row.saldo_usd ?? 0,
      diasVencido: row.dias_vencido,
    };

    if (row.dias_vencido < 0)      group.dueSoon.push(invoice);
    else if (row.dias_vencido === 0) group.dueToday.push(invoice);
    else                              group.overdue.push(invoice);
  }

  return Array.from(byCustomer.values());
}

export async function getInvoiceReminderData(
  pool: sql.ConnectionPool,
  thresholdDays: number,
): Promise<CustomerInvoiceGroup[]> {
  const result = await pool.request()
    .input('thresholdDays', sql.Int, thresholdDays)
    .query(`
      SELECT
        d.co_cli, c.cli_des, c.email,
        d.nro_doc, d.n_control, d.fec_venc, d.saldo, d.tasa,
        DATEDIFF(day, d.fec_venc, GETDATE()) AS dias_vencido,
        d.saldo / NULLIF(d.tasa, 0) AS saldo_usd
      FROM saDocumentoVenta d
      INNER JOIN saCliente c ON c.co_cli = d.co_cli
      WHERE d.anulado = 0
        AND d.saldo > 0
        AND RTRIM(d.co_tipo_doc) NOT IN ('N/CR', 'NCR')
        AND d.fec_venc <= DATEADD(day, @thresholdDays, GETDATE())
        AND c.email IS NOT NULL
        AND LTRIM(RTRIM(c.email)) NOT IN ('', '-')
      ORDER BY d.co_cli, d.fec_venc
    `);

  const rows = trimStrings(result.recordset) as unknown as RawInvoiceRow[];
  return groupInvoiceRows(rows);
}
