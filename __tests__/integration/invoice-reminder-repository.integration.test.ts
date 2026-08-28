process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import sql from 'mssql';
import { getInvoiceReminderData } from '@/lib/invoice-reminders/repository';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

let pool: sql.ConnectionPool;
const TEST_CLI = 'ZZTEST01';
const TEST_DOC_DUE_SOON = 'ZZDOC001';
const TEST_DOC_OVERDUE  = 'ZZDOC002';
const TEST_DOC_CREDIT   = 'ZZDOC003';

async function cleanup() {
  await pool.request().query(`DELETE FROM saDocumentoVenta WHERE co_cli IN ('${TEST_CLI}', 'ZZTEST02')`);
  await pool.request().query(`DELETE FROM saCliente WHERE co_cli IN ('${TEST_CLI}', 'ZZTEST02')`);
}

// saCliente and saDocumentoVenta carry many NOT NULL columns with no DB-level
// defaults (the real app fills them in at insert time). These helpers supply
// harmless placeholder values for those columns so the test rows insert cleanly,
// while leaving the columns the repository actually reads (co_cli, cli_des,
// email / co_tipo_doc, nro_doc, n_control, fec_venc, saldo, tasa, anulado)
// as the meaningful, test-controlled values.
async function insertCliente(coCli: string, cliDes: string, email: string | null): Promise<void> {
  const maxIdResult = await pool.request().query(`SELECT ISNULL(MAX(Id), 0) + 1 AS nextId FROM saCliente`);
  const nextId = maxIdResult.recordset[0].nextId;

  await pool.request()
    .input('id', sql.Int, nextId)
    .input('coCli', sql.Char(20), coCli)
    .input('tipCli', sql.Char(6), '000001')
    .input('cliDes', sql.VarChar(60), cliDes)
    .input('email', sql.VarChar(120), email)
    .input('fechaReg', sql.SmallDateTime, new Date())
    .input('coMone', sql.Char(6), 'BSD')
    .input('condPag', sql.Char(6), '000001')
    .input('coZon', sql.Char(6), 'CCS')
    .input('coSeg', sql.Char(6), '0023')
    .input('coVen', sql.Char(6), '000017')
    .input('coCtaIngrEgr', sql.Char(20), 'I-01')
    .input('coTab', sql.Char(20), '7')
    .input('tipoPer', sql.Char(1), '3')
    .input('coPais', sql.Char(6), 'VE')
    .input('coUsIn', sql.Char(6), '999')
    .input('feUsIn', sql.DateTime, new Date())
    .input('coUsMo', sql.Char(6), '999')
    .input('feUsMo', sql.DateTime, new Date())
    .query(`
      INSERT INTO saCliente (
        Id, co_cli, tip_cli, cli_des, inactivo, email,
        fecha_reg, puntaje, mont_cre, co_mone, cond_pag, plaz_pag, desc_ppago,
        co_zon, co_seg, co_ven, desc_glob,
        lunes, martes, miercoles, jueves, viernes, sabado, domingo,
        contrib, co_cta_ingr_egr, juridico, tipo_adi, valido, sincredito, contribu_e, rete_regis_doc, porc_esp,
        co_tab, tipo_per, co_pais,
        co_us_in, fe_us_in, co_us_mo, fe_us_mo
      ) VALUES (
        @id, @coCli, @tipCli, @cliDes, 0, @email,
        @fechaReg, 0, 0, @coMone, @condPag, 7, 0,
        @coZon, @coSeg, @coVen, 0,
        0, 0, 0, 0, 0, 0, 0,
        0, @coCtaIngrEgr, 0, 1, 0, 0, 0, 0, 0,
        @coTab, @tipoPer, @coPais,
        @coUsIn, @feUsIn, @coUsMo, @feUsMo
      )
    `);
}

async function insertDoc(coCli: string, tipoDoc: string, nroDoc: string, fecVenc: Date, saldo: number): Promise<void> {
  await pool.request()
    .input('tipoDoc', sql.Char(4), tipoDoc)
    .input('nroDoc', sql.Char(20), nroDoc)
    .input('coCli', sql.Char(20), coCli)
    .input('coVen', sql.Char(6), '000017')
    .input('coMone', sql.Char(6), 'BSD')
    .input('fecVenc', sql.SmallDateTime, fecVenc)
    .input('saldo', sql.Decimal(18, 2), saldo)
    .input('tasa', sql.Decimal(18, 4), 50)
    .query(`
      INSERT INTO saDocumentoVenta (
        co_tipo_doc, nro_doc, co_cli, co_ven, co_mone, tasa,
        fec_reg, fec_emis, fec_venc, anulado, aut, contrib,
        saldo, total_bruto, monto_desc_glob, monto_reca, total_neto,
        monto_imp, monto_imp2, monto_imp3, porc_imp, porc_imp2, porc_imp3,
        comis1, comis2, comis3, comis4, comis5, comis6, adicional, ven_ter,
        otros1, otros2, otros3, impresa,
        co_us_in, fe_us_in, co_us_mo, fe_us_mo
      )
      VALUES (
        @tipoDoc, @nroDoc, @coCli, @coVen, @coMone, @tasa,
        @fecVenc, @fecVenc, @fecVenc, 0, 0, 0,
        @saldo, @saldo, 0, 0, @saldo,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
        '999', GETDATE(), '999', GETDATE()
      )
    `);
}

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  await cleanup();

  await insertCliente(TEST_CLI, 'Cliente De Prueba Reminder', 'reminder-test@example.com');

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  await insertDoc(TEST_CLI, 'FACT', TEST_DOC_DUE_SOON, inTwoDays, 500);
  await insertDoc(TEST_CLI, 'FACT', TEST_DOC_OVERDUE, fiveDaysAgo, 300);
  await insertDoc(TEST_CLI, 'N/CR', TEST_DOC_CREDIT, fiveDaysAgo, 200);
});

afterEach(async () => {
  // no per-test mutation to reset — data is static across tests in this file
});

afterAll(async () => {
  await cleanup();
  if (pool?.connected) await pool.close();
});

describe('getInvoiceReminderData', () => {
  test('returns the test customer with dueSoon and overdue invoices, excluding the credit note', async () => {
    const groups = await getInvoiceReminderData(pool, 3);
    const group = groups.find(g => g.coCli === TEST_CLI);

    expect(group).toBeDefined();
    expect(group!.email).toBe('reminder-test@example.com');
    expect(group!.dueSoon.map(i => i.nroDoc)).toContain(TEST_DOC_DUE_SOON);
    expect(group!.overdue.map(i => i.nroDoc)).toContain(TEST_DOC_OVERDUE);
    expect(group!.dueSoon.map(i => i.nroDoc)).not.toContain(TEST_DOC_CREDIT);
    expect(group!.overdue.map(i => i.nroDoc)).not.toContain(TEST_DOC_CREDIT);
    expect(group!.dueToday).toHaveLength(0);
  });

  test('respects the thresholdDays window — a 0-day threshold excludes the dueSoon invoice', async () => {
    const groups = await getInvoiceReminderData(pool, 0);
    const group = groups.find(g => g.coCli === TEST_CLI);
    // dueSoon invoice is 2 days out — excluded when threshold is 0, overdue still included
    if (group) {
      expect(group.dueSoon.map(i => i.nroDoc)).not.toContain(TEST_DOC_DUE_SOON);
      expect(group.overdue.map(i => i.nroDoc)).toContain(TEST_DOC_OVERDUE);
    } else {
      // acceptable only if overdue-only customers still surface as their own group
      throw new Error('Expected test customer group with overdue invoice to still appear at threshold=0');
    }
  });

  test('excludes a customer whose email is the sentinel "-"', async () => {
    const sentinelCli = 'ZZTEST02';
    await insertCliente(sentinelCli, 'Cliente Sin Email', '-');
    await insertDoc(sentinelCli, 'FACT', 'ZZDOC004', new Date(), 100);

    const groups = await getInvoiceReminderData(pool, 3);
    expect(groups.find(g => g.coCli === sentinelCli)).toBeUndefined();

    await pool.request().query(`DELETE FROM saDocumentoVenta WHERE co_cli = '${sentinelCli}'`);
    await pool.request().query(`DELETE FROM saCliente WHERE co_cli = '${sentinelCli}'`);
  });
});
