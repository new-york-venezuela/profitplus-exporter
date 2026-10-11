// WRITES to the live ERP then restores. Run only against a NON-PRODUCTION Profit Plus instance.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '../../../lib/db/mssql';
import { mssqlGateway } from '../../../lib/customer-mapping/erp';

describe('customer-mapping pApi procs', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let invoice: { docNum: string; coVen: string; coCli: string };
  let otherSeller: string;
  let customer: { coCli: string; coSeg: string };
  let otherSeg: string;
  let annulledInv: { docNum: string; coVen: string };
  let dev: { docNum: string; coVen: string };
  let annulledDev: { docNum: string; coVen: string };
  let sellerCustomer: { coCli: string; coVen: string };
  let inactiveSeller: string | undefined;

  const fixSeller = (tipo: string, doc: string, ven: string) => pool.request()
    .input('sTipo', sql.VarChar(4), tipo).input('sNroDoc', sql.Char(20), doc)
    .input('sCoVen', sql.Char(6), ven).input('sCoUsMo', sql.Char(6), 'TESTRN')
    .execute('pApiCorregirVendedorDocumento');

  beforeAll(async () => {
    pool = await getPool();
    const inv = await pool.request().query(`
      SELECT TOP 1 RTRIM(doc_num) AS docNum, RTRIM(co_ven) AS coVen, RTRIM(co_cli) AS coCli
      FROM saFacturaVenta WHERE anulado = 0 AND RTRIM(co_ven) <> '' ORDER BY fec_emis DESC`);
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
    const ai = await pool.request().query(
      `SELECT TOP 1 RTRIM(doc_num) AS docNum, RTRIM(co_ven) AS coVen FROM saFacturaVenta WHERE anulado = 1 AND RTRIM(co_ven) <> ''`);
    annulledInv = ai.recordset[0];
    const dv = await pool.request().query(
      `SELECT TOP 1 RTRIM(doc_num) AS docNum, RTRIM(co_ven) AS coVen FROM saDevolucionCliente WHERE anulado = 0 AND RTRIM(co_ven) <> '' ORDER BY fec_emis DESC`);
    dev = dv.recordset[0];
    const ad = await pool.request().query(
      `SELECT TOP 1 RTRIM(doc_num) AS docNum, RTRIM(co_ven) AS coVen FROM saDevolucionCliente WHERE anulado = 1 AND RTRIM(co_ven) <> ''`);
    annulledDev = ad.recordset[0];
    const sc = await pool.request().query(
      `SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(co_ven) AS coVen FROM saCliente WHERE inactivo = 0 AND RTRIM(co_ven) <> '' AND RTRIM(co_cli) <> '${customer.coCli}'`);
    sellerCustomer = sc.recordset[0];
    const ina = await pool.request().query(`SELECT TOP 1 RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 1`);
    inactiveSeller = ina.recordset[0]?.coVen;
  });

  // Fingerprint of every credit-note ledger row: the DEV branch must never touch saDocumentoVenta.
  const creditNoteLedger = async () => (await pool.request().query(`
    SELECT COUNT(*) AS n, CHECKSUM_AGG(CHECKSUM(co_tipo_doc, nro_doc, co_cli, co_ven)) AS chk
    FROM saDocumentoVenta WHERE co_tipo_doc IN ('N/CR', 'NCR')`)).recordset[0] as { n: number; chk: number | null };
  const restoreSeller = (coCli: string, coVen: string) => pool.request()
    .input('sCoCli', sql.Char(16), coCli).input('sCoVen', sql.Char(6), coVen).input('sCoUsMo', sql.Char(6), 'TESTRN')
    .execute('pApiRestaurarVendedorCliente');

  afterAll(async () => {
    try {
      await fixSeller('FACT', invoice.docNum, invoice.coVen);
      if (sellerCustomer) await restoreSeller(sellerCustomer.coCli, sellerCustomer.coVen);
    } finally {
      try {
        if (dev) await fixSeller('DEV', dev.docNum, dev.coVen);
      } finally {
        try {
          await pool.request()
            .input('sCoCli', sql.Char(16), customer.coCli).input('sCoSeg', sql.Char(6), customer.coSeg).input('sCoUsMo', sql.Char(6), 'TESTRN')
            .execute('pApiActualizarSegmentoCliente');
        } finally {
          await pool.request().query(`DELETE FROM saSegmento WHERE RTRIM(co_seg) = 'ZZTST1'`);
        }
      }
    }
  });

  test('pApiCorregirVendedorDocumento updates the invoice header and its ledger row', async () => {
    const otherLedger = async () => (await pool.request().input('d', sql.Char(20), invoice.docNum).input('c', sql.Char(16), invoice.coCli).query(`
      SELECT RTRIM(co_tipo_doc) AS tipo, RTRIM(co_cli) AS coCli, RTRIM(co_ven) AS coVen FROM saDocumentoVenta
      WHERE nro_doc = @d AND NOT (co_tipo_doc = 'FACT' AND co_cli = @c) ORDER BY co_tipo_doc, co_cli`)).recordset;
    const before = await otherLedger();
    await fixSeller('FACT', invoice.docNum, otherSeller);
    const hdr = await pool.request().input('d', sql.Char(20), invoice.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saFacturaVenta WHERE doc_num = @d`);
    expect(hdr.recordset[0].coVen).toBe(otherSeller);
    const led = await pool.request().input('d', sql.Char(20), invoice.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saDocumentoVenta WHERE co_tipo_doc = 'FACT' AND nro_doc = @d`);
    if (led.recordset.length) expect(led.recordset[0].coVen).toBe(otherSeller);
    // Ledger rows with the same number that are not this invoice's own (other type or other customer) stay untouched.
    expect(await otherLedger()).toEqual(before);
  });

  test('unknown seller and unknown document are rejected', async () => {
    await expect(fixSeller('FACT', invoice.docNum, 'NOPE99')).rejects.toThrow(/Vendedor .* no encontrado/);
    await expect(fixSeller('FACT', 'NO-SUCH-DOC', otherSeller)).rejects.toThrow(/Documento .* no encontrado/);
  });

  test('annulled invoice is rejected and left unchanged', async () => {
    await expect(fixSeller('FACT', annulledInv.docNum, otherSeller)).rejects.toThrow(/anulado/);
    const r = await pool.request().input('d', sql.Char(20), annulledInv.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saFacturaVenta WHERE doc_num = @d`);
    expect(r.recordset[0].coVen).toBe(annulledInv.coVen);
  });

  test('invalid document type is rejected', async () => {
    await expect(fixSeller('XXX', invoice.docNum, otherSeller)).rejects.toThrow(/Tipo de documento invalido/);
  });

  test('DEV: updates the return header and leaves every credit-note ledger row untouched', async () => {
    const o = await pool.request().input('v', sql.VarChar(6), dev.coVen).query(
      `SELECT TOP 1 RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0 AND RTRIM(co_ven) <> @v`);
    const other = o.recordset[0].coVen;
    const ledgerBefore = await creditNoteLedger();
    await fixSeller('DEV', dev.docNum, other);
    const hdr = await pool.request().input('d', sql.Char(20), dev.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saDevolucionCliente WHERE doc_num = @d`);
    expect(hdr.recordset[0].coVen).toBe(other);
    // A credit note has its own number; matching the return's doc_num could hit another customer's note.
    // The DEV branch must not write saDocumentoVenta at all (whole N/CR + NCR set is unchanged).
    expect(await creditNoteLedger()).toEqual(ledgerBefore);
  });

  test('DEV: annulled return is rejected and left unchanged', async () => {
    await expect(fixSeller('DEV', annulledDev.docNum, otherSeller)).rejects.toThrow(/anulado/);
    const r = await pool.request().input('d', sql.Char(20), annulledDev.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saDevolucionCliente WHERE doc_num = @d`);
    expect(r.recordset[0].coVen).toBe(annulledDev.coVen);
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

  test('pApiRestaurarVendedorCliente restores a customer seller (also to the same value) and stamps the row', async () => {
    const read = async () => (await pool.request().input('c', sql.Char(16), sellerCustomer.coCli)
      .query(`SELECT RTRIM(co_ven) AS coVen, RTRIM(co_us_mo) AS usMo FROM saCliente WHERE co_cli = @c`)).recordset[0];
    await restoreSeller(sellerCustomer.coCli, sellerCustomer.coVen); // same value: no-op on co_ven
    expect((await read()).coVen).toBe(sellerCustomer.coVen);
    const different = otherSeller !== sellerCustomer.coVen ? otherSeller : invoice.coVen;
    await restoreSeller(sellerCustomer.coCli, different);
    const moved = await read();
    expect(moved.coVen).toBe(different);
    expect(moved.usMo).toBe('TESTRN');
    await restoreSeller(sellerCustomer.coCli, sellerCustomer.coVen);
    expect((await read()).coVen).toBe(sellerCustomer.coVen);
  });

  test('pApiRestaurarVendedorCliente accepts an inactive seller that pApiActualizarVendedorCliente rejects', async () => {
    if (!inactiveSeller) return; // no inactive seller in this database: nothing to prove
    await expect(pool.request()
      .input('sCoCli', sql.Char(16), sellerCustomer.coCli).input('sCoVen', sql.Char(6), inactiveSeller).input('sCoUsMo', sql.Char(6), 'TESTRN')
      .execute('pApiActualizarVendedorCliente')).rejects.toThrow(/Vendedor .* no encontrado/);
    await restoreSeller(sellerCustomer.coCli, inactiveSeller);
    const r = await pool.request().input('c', sql.Char(16), sellerCustomer.coCli)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saCliente WHERE co_cli = @c`);
    expect(r.recordset[0].coVen).toBe(inactiveSeller);
    await restoreSeller(sellerCustomer.coCli, sellerCustomer.coVen);
  });

  test('pApiRestaurarVendedorCliente rejects an unknown seller or customer and leaves the row unchanged', async () => {
    await expect(restoreSeller(sellerCustomer.coCli, 'NOPE99')).rejects.toThrow(/Vendedor .* no encontrado/);
    await expect(restoreSeller('NO-SUCH-CLI', otherSeller)).rejects.toThrow(/Cliente .* no encontrado/);
    const r = await pool.request().input('c', sql.Char(16), sellerCustomer.coCli)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saCliente WHERE co_cli = @c`);
    expect(r.recordset[0].coVen).toBe(sellerCustomer.coVen);
  });
});

describe('route pApi procs', () => {
  const TEST_ZONE = 'CCS999';
  let pool: Awaited<ReturnType<typeof getPool>>;
  let cus: { coCli: string; coZon: string; frecuVist: string | null; coVen: string; coSeg: string; tipCli: string };

  const setRoute = (coCli: string, zon: string, frec: string | null) => pool.request()
    .input('sCoCli', sql.Char(16), coCli).input('sCoZon', sql.Char(6), zon)
    .input('sFrecuVist', sql.VarChar(60), frec).input('sCoUsMo', sql.Char(6), 'TESTRN')
    .execute('pApiActualizarRutaCliente');
  const restoreRoute = (coCli: string, zon: string, frec: string | null) => pool.request()
    .input('sCoCli', sql.Char(16), coCli).input('sCoZon', sql.Char(6), zon)
    .input('sFrecuVist', sql.VarChar(60), frec).input('sCoUsMo', sql.Char(6), 'TESTRN')
    .execute('pApiRestaurarRutaCliente');
  const insertZone = (zon: string, des = 'Ruta de prueba') => pool.request()
    .input('sCoZon', sql.Char(6), zon).input('sZonDes', sql.VarChar(60), des).input('sCoUsIn', sql.Char(6), 'TESTRN')
    .execute('pApiInsertarZona');
  const readCus = async () => (await pool.request().input('c', sql.Char(16), cus.coCli).query(`
    SELECT RTRIM(co_zon) AS coZon, RTRIM(frecu_vist) AS frecuVist, RTRIM(co_ven) AS coVen, RTRIM(co_seg) AS coSeg,
           RTRIM(tip_cli) AS tipCli, RTRIM(co_us_mo) AS usMo FROM saCliente WHERE co_cli = @c`)).recordset[0];

  beforeAll(async () => {
    pool = await getPool();
    const r = await pool.request().query(`
      SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(co_zon) AS coZon, RTRIM(frecu_vist) AS frecuVist,
             RTRIM(co_ven) AS coVen, RTRIM(co_seg) AS coSeg, RTRIM(tip_cli) AS tipCli
      FROM saCliente WHERE inactivo = 0 ORDER BY co_cli`);
    cus = r.recordset[0];
  });

  afterAll(async () => {
    try {
      await restoreRoute(cus.coCli, cus.coZon, cus.frecuVist);
    } finally {
      await pool.request().query(
        `DELETE FROM saZona WHERE RTRIM(co_zon) = '${TEST_ZONE}' AND NOT EXISTS (SELECT 1 FROM saCliente WHERE RTRIM(co_zon) = '${TEST_ZONE}')`);
    }
  });

  test('pApiInsertarZona creates a route zone once; a second call is a no-op that keeps the first description', async () => {
    await insertZone(TEST_ZONE, 'Ruta de prueba');
    await insertZone(TEST_ZONE, 'Otro nombre');
    const z = await pool.request().input('z', sql.Char(6), TEST_ZONE)
      .query(`SELECT COUNT(*) AS n, MAX(RTRIM(zon_des)) AS des, MAX(RTRIM(co_us_in)) AS usIn FROM saZona WHERE co_zon = @z`);
    expect(z.recordset[0]).toEqual({ n: 1, des: 'Ruta de prueba', usIn: 'TESTRN' });
  });

  test('pApiInsertarZona rejects codes that are not CCSnnn (wrong shape, hyphen, lower case)', async () => {
    for (const bad of ['CCS-03', 'ABC123', 'ccs998', 'CCS99', '001']) {
      await expect(insertZone(bad)).rejects.toThrow(/Codigo de ruta .* invalido/);
    }
    const n = await pool.request().query(`SELECT COUNT(*) AS n FROM saZona WHERE RTRIM(co_zon) IN ('CCS-03','ABC123','ccs998','CCS99')`);
    expect(n.recordset[0].n).toBe(0);
  });

  test('pApiActualizarRutaCliente sets zone and upper-cased frequency, stamps the row, touches nothing else', async () => {
    await insertZone(TEST_ZONE);
    await setRoute(cus.coCli, TEST_ZONE, ' quincenal ');
    const after = await readCus();
    expect(after).toMatchObject({ coZon: TEST_ZONE, frecuVist: 'QUINCENAL', usMo: 'TESTRN' });
    expect([after.coVen, after.coSeg, after.tipCli]).toEqual([cus.coVen, cus.coSeg, cus.tipCli]); // tip_cli/co_seg/co_ven untouched
  });

  test('unknown customer, unknown zone and bad frequency are rejected and leave the row unchanged', async () => {
    await setRoute(cus.coCli, TEST_ZONE, 'MENSUAL');
    const before = await readCus();
    await expect(setRoute('NO-SUCH-CLI', TEST_ZONE, 'SEMANAL')).rejects.toThrow(/Cliente .* no encontrado/);
    await expect(setRoute(cus.coCli, 'CCS997', 'SEMANAL')).rejects.toThrow(/Zona .* no encontrada/);
    for (const bad of ['DIARIA', '', '  ', null]) {
      await expect(setRoute(cus.coCli, TEST_ZONE, bad)).rejects.toThrow(/Frecuencia .* invalida/);
    }
    expect(await readCus()).toEqual(before);
  });

  test('pApiRestaurarRutaCliente restores a previous zone and a NULL or free-text frequency that the update proc rejects', async () => {
    await setRoute(cus.coCli, TEST_ZONE, 'SEMANAL');
    await restoreRoute(cus.coCli, cus.coZon, null);
    expect(await readCus()).toMatchObject({ coZon: cus.coZon, frecuVist: null, usMo: 'TESTRN' });
    await restoreRoute(cus.coCli, cus.coZon, 'cada dos semanas');
    expect((await readCus()).frecuVist).toBe('cada dos semanas');
    await restoreRoute(cus.coCli, cus.coZon, cus.frecuVist);
    expect((await readCus()).frecuVist).toBe(cus.frecuVist);
  });

  test('pApiRestaurarRutaCliente rejects an unknown zone or customer', async () => {
    await expect(restoreRoute(cus.coCli, 'CCS997', null)).rejects.toThrow(/Zona .* no encontrada/);
    await expect(restoreRoute('NO-SUCH-CLI', cus.coZon, null)).rejects.toThrow(/Cliente .* no encontrado/);
  });

  test('mssqlGateway: createZone is idempotent, listCustomers/listZones expose route data, set/restore round-trip', async () => {
    const gw = mssqlGateway(pool);
    await gw.createZone('CCS998', 'Ruta 998');
    await gw.createZone('CCS998', 'Ruta 998');
    try {
      expect((await gw.listZones()).has('CCS998')).toBe(true);
      await gw.setCustomerRoute(cus.coCli, 'CCS998', 'QUINCENAL');
      const moved = (await gw.listCustomers()).get(cus.coCli)!;
      expect(moved).toMatchObject({ coZon: 'CCS998', frecuVist: 'QUINCENAL', coVen: cus.coVen, coSeg: cus.coSeg });
      await gw.restoreCustomerRoute(cus.coCli, cus.coZon, cus.frecuVist);
      expect((await gw.listCustomers()).get(cus.coCli)).toMatchObject({ coZon: cus.coZon, frecuVist: cus.frecuVist });
    } finally {
      await gw.restoreCustomerRoute(cus.coCli, cus.coZon, cus.frecuVist);
      await pool.request().query(
        `DELETE FROM saZona WHERE RTRIM(co_zon) = 'CCS998' AND NOT EXISTS (SELECT 1 FROM saCliente WHERE RTRIM(co_zon) = 'CCS998')`);
    }
  });
});
