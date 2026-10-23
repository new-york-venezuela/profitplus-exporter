// WRITES to the live ERP then restores. Run only against a NON-PRODUCTION Profit Plus instance.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { getPool } from '../../../lib/db/mssql';
import { mssqlCreditGateway, type CreditGateway } from '../../../lib/credit-terms/erp';

describe('credit-terms pApi procs', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let gw: CreditGateway;
  let coCli: string;
  let before: { condPag: string; plazPag: number };
  let openDocs: string[];
  let paidDoc: { nroDoc: string; fecVenc: string } | undefined;
  const runId = crypto.randomUUID();

  const dueDates = async (docs: string[]) => {
    const r = await pool.request().query(`
      SELECT RTRIM(d.nro_doc) AS nroDoc, CONVERT(char(10), d.fec_emis, 23) AS fecEmis,
             CONVERT(char(10), d.fec_venc, 23) AS docVenc, CONVERT(char(10), fv.fec_venc, 23) AS fvVenc,
             RTRIM(fv.co_cond) AS fvCond
      FROM saDocumentoVenta d JOIN saFacturaVenta fv ON fv.doc_num = d.nro_doc
      WHERE RTRIM(d.nro_doc) IN (${docs.map(d => `'${d}'`).join(',')})`);
    return r.recordset as { nroDoc: string; fecEmis: string; docVenc: string; fvVenc: string; fvCond: string }[];
  };
  const plus7 = (iso: string) => new Date(Date.parse(iso) + 7 * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    pool = await getPool();
    gw = mssqlCreditGateway(pool);
    const c = await pool.request().query(`
      SELECT TOP 1 RTRIM(c.co_cli) AS coCli, RTRIM(c.cond_pag) AS condPag, c.plaz_pag AS plazPag
      FROM saCliente c
      WHERE c.inactivo = 0 AND c.cond_pag = '000001'
        AND EXISTS (SELECT 1 FROM saDocumentoVenta d WHERE d.co_cli = c.co_cli AND d.co_tipo_doc = 'FACT'
                    AND ISNULL(d.anulado,0) = 0 AND d.saldo <> 0)
        AND EXISTS (SELECT 1 FROM saDocumentoVenta d WHERE d.co_cli = c.co_cli AND d.co_tipo_doc = 'FACT'
                    AND ISNULL(d.anulado,0) = 0 AND d.saldo = 0)
      ORDER BY c.co_cli`);
    coCli = c.recordset[0].coCli;
    before = { condPag: c.recordset[0].condPag, plazPag: c.recordset[0].plazPag };
    const docs = await pool.request().input('c', coCli).query(`
      SELECT RTRIM(nro_doc) AS nroDoc, CONVERT(char(10), fec_venc, 23) AS fecVenc, saldo
      FROM saDocumentoVenta WHERE co_cli = @c AND co_tipo_doc = 'FACT' AND ISNULL(anulado,0) = 0`);
    openDocs = docs.recordset.filter((d: { saldo: number }) => d.saldo !== 0).map((d: { nroDoc: string }) => d.nroDoc);
    paidDoc = docs.recordset.find((d: { saldo: number }) => d.saldo === 0);
  });

  afterAll(async () => {
    await gw.restoreInvoices(runId);
    await gw.restoreCustomers(runId);
    await pool.close();
  });

  test('listCustomers returns trimmed codes', async () => {
    const all = await gw.listCustomers();
    expect(all.get(coCli)).toEqual({ coCli, condPag: '000001', plazPag: before.plazPag, inactivo: false });
  });

  test('fixInvoices refuses a Contado customer', async () => {
    await expect(gw.fixInvoices(runId, coCli)).rejects.toThrow(/Contado/);
  });

  test('setCustomerTerm then fixInvoices rewrites only unpaid invoices', async () => {
    const preview = await gw.previewInvoiceChanges(coCli, 7);
    expect(preview.length).toBeGreaterThan(0);

    await gw.setCustomerTerm(runId, coCli, '000002', 7);
    const c = (await gw.listCustomers()).get(coCli)!;
    expect(c.condPag).toBe('000002');
    expect(c.plazPag).toBe(7);

    const changed = await gw.fixInvoices(runId, coCli);
    expect(changed.map(x => x.nroDoc).sort()).toEqual(preview.map(x => x.nroDoc).sort());
    for (const row of await dueDates(openDocs)) {
      expect(row.docVenc).toBe(plus7(row.fecEmis));
      expect(row.fvVenc).toBe(plus7(row.fecEmis));
      expect(row.fvCond).toBe('000002');
    }
    if (paidDoc) {
      const [p] = await dueDates([paidDoc.nroDoc]);
      expect(p.docVenc).toBe(paidDoc.fecVenc);
    }
  });

  test('a second fixInvoices changes nothing', async () => {
    expect(await gw.fixInvoices(runId, coCli)).toEqual([]);
    expect(await gw.previewInvoiceChanges(coCli, 7)).toEqual([]);
  });

  test('restore returns customer and invoices to the original values', async () => {
    const inv = await gw.restoreInvoices(runId);
    expect(inv.restored).toBeGreaterThan(0);
    expect(inv.skipped).toEqual([]);
    const cust = await gw.restoreCustomers(runId);
    expect(cust.restored).toBe(1);
    const c = (await gw.listCustomers()).get(coCli)!;
    expect({ condPag: c.condPag, plazPag: c.plazPag }).toEqual(before);
    expect((await gw.previewInvoiceChanges(coCli, 7)).length).toBeGreaterThan(0);
  });

  test('restore skips a row edited after the run', async () => {
    await gw.setCustomerTerm(runId, coCli, '000002', 7);
    await pool.request().input('c', coCli).query(`UPDATE saCliente SET plaz_pag = 9 WHERE co_cli = @c`);
    const r = await gw.restoreCustomers(runId);
    expect(r.restored).toBe(0);
    expect(r.skipped.length).toBe(1);
    await pool.request().input('c', coCli).input('p', before.plazPag)
      .query(`UPDATE saCliente SET cond_pag = '000001', plaz_pag = @p WHERE co_cli = @c`);
  });
});
