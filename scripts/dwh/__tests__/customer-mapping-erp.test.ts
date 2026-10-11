// WRITES to the live ERP then restores. Run only against a NON-PRODUCTION Profit Plus instance.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '../../../lib/db/mssql';

describe('customer-mapping pApi procs', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let invoice: { docNum: string; coVen: string; coCli: string };
  let otherSeller: string;
  let customer: { coCli: string; coSeg: string };
  let otherSeg: string;

  beforeAll(async () => {
    pool = await getPool();
    const inv = await pool.request().query(`
      SELECT TOP 1 RTRIM(doc_num) AS docNum, RTRIM(co_ven) AS coVen, RTRIM(co_cli) AS coCli
      FROM saFacturaVenta WHERE anulado = 0 ORDER BY fec_emis DESC`);
    invoice = inv.recordset[0];
    const sel = await pool.request().input('v', sql.VarChar(6), invoice.coVen).query(
      `SELECT TOP 1 RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0 AND RTRIM(co_ven) <> @v`);
    otherSeller = sel.recordset[0].coVen;
    const cus = await pool.request().query(
      `SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(co_seg) AS coSeg FROM saCliente WHERE inactivo = 0 AND co_seg IS NOT NULL`);
    customer = cus.recordset[0];
    const seg = await pool.request().input('s', sql.VarChar(6), customer.coSeg).query(
      `SELECT TOP 1 RTRIM(co_seg) AS coSeg FROM saSegmento WHERE RTRIM(co_seg) <> @s`);
    otherSeg = seg.recordset[0].coSeg;
  });

  afterAll(async () => {
    await pool.request()
      .input('sTipo', sql.VarChar(4), 'FACT').input('sNroDoc', sql.Char(20), invoice.docNum)
      .input('sCoVen', sql.Char(6), invoice.coVen).input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiCorregirVendedorDocumento');
    await pool.request()
      .input('sCoCli', sql.Char(16), customer.coCli).input('sCoSeg', sql.Char(6), customer.coSeg).input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiActualizarSegmentoCliente');
    await pool.request().query(`DELETE FROM saSegmento WHERE RTRIM(co_seg) = 'ZZTST1'`);
  });

  test('pApiCorregirVendedorDocumento updates the invoice header and its ledger row', async () => {
    await pool.request()
      .input('sTipo', sql.VarChar(4), 'FACT').input('sNroDoc', sql.Char(20), invoice.docNum)
      .input('sCoVen', sql.Char(6), otherSeller).input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiCorregirVendedorDocumento');
    const hdr = await pool.request().input('d', sql.Char(20), invoice.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saFacturaVenta WHERE doc_num = @d`);
    expect(hdr.recordset[0].coVen).toBe(otherSeller);
    const led = await pool.request().input('d', sql.Char(20), invoice.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saDocumentoVenta WHERE co_tipo_doc = 'FACT' AND nro_doc = @d`);
    if (led.recordset.length) expect(led.recordset[0].coVen).toBe(otherSeller);
  });

  test('unknown seller and unknown document are rejected', async () => {
    const call = (d: string, v: string) => pool.request()
      .input('sTipo', sql.VarChar(4), 'FACT').input('sNroDoc', sql.Char(20), d)
      .input('sCoVen', sql.Char(6), v).input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiCorregirVendedorDocumento');
    await expect(call(invoice.docNum, 'NOPE99')).rejects.toThrow(/Vendedor .* no encontrado/);
    await expect(call('NO-SUCH-DOC', otherSeller)).rejects.toThrow(/Documento .* no encontrado/);
  });

  test('pApiActualizarSegmentoCliente moves a customer; unknown segment is rejected', async () => {
    await pool.request()
      .input('sCoCli', sql.Char(16), customer.coCli).input('sCoSeg', sql.Char(6), otherSeg).input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiActualizarSegmentoCliente');
    const r = await pool.request().input('c', sql.Char(16), customer.coCli)
      .query(`SELECT RTRIM(co_seg) AS coSeg FROM saCliente WHERE co_cli = @c`);
    expect(r.recordset[0].coSeg).toBe(otherSeg);
    await expect(pool.request()
      .input('sCoCli', sql.Char(16), customer.coCli).input('sCoSeg', sql.Char(6), 'NOSEG9').input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiActualizarSegmentoCliente')).rejects.toThrow(/Segmento .* no encontrado/);
  });

  test('pApiInsertarSegmento creates a segment once and rejects a duplicate', async () => {
    const ins = () => pool.request()
      .input('sCoSeg', sql.Char(6), 'ZZTST1').input('sSegDes', sql.VarChar(60), 'Grupo de prueba').input('sCoUsIn', sql.Char(6), 'TESTRN')
      .execute('pApiInsertarSegmento');
    await ins();
    await expect(ins()).rejects.toThrow(/ya existe/);
  });
});
