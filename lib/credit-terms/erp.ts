import sql from 'mssql';
import { ERP_USER_CODE } from '@/lib/geo/erp-location';
import { CO_COND_BY_DAYS, type CreditDays, type ErpCreditCustomer } from './types';

export interface InvoiceChange {
  nroDoc: string;
  coCli: string;
  fecEmis: string;
  fecVencOld: string;
  fecVencNew: string;
  saldo: number;
}

export interface RestoreResult {
  restored: number;
  skipped: { key: string; reason: string }[];
}

export interface CreditGateway {
  listCustomers(): Promise<Map<string, ErpCreditCustomer>>;
  /** Read-only twin of pApiCorregirVencimientosFacturasCliente's selection, for a given term. */
  previewInvoiceChanges(coCli: string, diasCred: CreditDays): Promise<InvoiceChange[]>;
  setCustomerTerm(runId: string, coCli: string, coCond: string, plazPag: number): Promise<void>;
  fixInvoices(runId: string, coCli: string): Promise<InvoiceChange[]>;
  restoreCustomers(runId: string): Promise<RestoreResult>;
  restoreInvoices(runId: string): Promise<RestoreResult>;
}

interface RestoreRow { status: 'restored' | 'skipped'; key: string; reason: string }

function toRestoreResult(rows: RestoreRow[]): RestoreResult {
  return {
    restored: rows.filter(r => r.status === 'restored').length,
    skipped: rows.filter(r => r.status === 'skipped').map(r => ({ key: r.key, reason: r.reason })),
  };
}

export function mssqlCreditGateway(pool: sql.ConnectionPool): CreditGateway {
  return {
    async listCustomers() {
      const r = await pool.request().query(
        `SELECT RTRIM(co_cli) AS coCli, RTRIM(cond_pag) AS condPag, ISNULL(plaz_pag, 0) AS plazPag,
                inactivo FROM saCliente`);
      return new Map((r.recordset as { coCli: string; condPag: string; plazPag: number; inactivo: boolean }[])
        .map(x => [x.coCli, { coCli: x.coCli, condPag: x.condPag, plazPag: x.plazPag, inactivo: !!x.inactivo }]));
    },
    async previewInvoiceChanges(coCli, diasCred) {
      const r = await pool.request()
        .input('sCoCli', sql.Char(16), coCli).input('iDias', sql.Int, diasCred)
        .input('sCoCond', sql.Char(6), CO_COND_BY_DAYS[diasCred])
        .query(`
          SELECT RTRIM(d.nro_doc) AS nroDoc, RTRIM(d.co_cli) AS coCli,
                 CONVERT(char(10), d.fec_emis, 23) AS fecEmis,
                 CONVERT(char(10), d.fec_venc, 23) AS fecVencOld,
                 CONVERT(char(10), DATEADD(day, @iDias, d.fec_emis), 23) AS fecVencNew,
                 d.saldo
          FROM saDocumentoVenta d
          INNER JOIN saFacturaVenta fv ON fv.doc_num = d.nro_doc
          WHERE d.co_cli = @sCoCli AND d.co_tipo_doc = 'FACT' AND ISNULL(d.anulado, 0) = 0 AND d.saldo <> 0
            AND ( d.fec_venc <> DATEADD(day, @iDias, d.fec_emis)
                  OR fv.fec_venc <> DATEADD(day, @iDias, d.fec_emis)
                  OR fv.co_cond <> @sCoCond )
          ORDER BY d.nro_doc`);
      return r.recordset as InvoiceChange[];
    },
    async setCustomerTerm(runId, coCli, coCond, plazPag) {
      await pool.request()
        .input('sRunId', sql.VarChar(36), runId).input('sCoCli', sql.Char(16), coCli)
        .input('sCoCond', sql.Char(6), coCond).input('iPlazPag', sql.Int, plazPag)
        .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiActualizarCondicionPagoCliente');
    },
    async fixInvoices(runId, coCli) {
      const r = await pool.request()
        .input('sRunId', sql.VarChar(36), runId).input('sCoCli', sql.Char(16), coCli)
        .input('sCoUsIn', sql.Char(6), ERP_USER_CODE)
        .execute('pApiCorregirVencimientosFacturasCliente');
      return (r.recordset ?? []) as InvoiceChange[];
    },
    async restoreCustomers(runId) {
      const r = await pool.request()
        .input('sRunId', sql.VarChar(36), runId).input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiRestaurarCondicionPagoCliente');
      return toRestoreResult((r.recordset ?? []) as RestoreRow[]);
    },
    async restoreInvoices(runId) {
      const r = await pool.request()
        .input('sRunId', sql.VarChar(36), runId).input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiRestaurarVencimientosFacturas');
      return toRestoreResult((r.recordset ?? []) as RestoreRow[]);
    },
  };
}
