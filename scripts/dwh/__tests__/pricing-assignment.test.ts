// scripts/dwh/__tests__/pricing-assignment.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { getPool } from '../../../lib/db/mssql';
import { assignCustomerPriceList, readFullCustomerRow, updateCustomerTipCli } from '../../../lib/pricing/sa-cliente-fields';

// Requires a real ERP test/staging connection via .env.local (DB_* vars) --
// this feature writes to the live ERP, so unlike the DWH tests elsewhere in
// this app there is no disposable-database setup/teardown here. Run this
// only against a non-production Profit Plus instance.
describe('assignCustomerPriceList', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let testCoCli: string;
  let originalTipCli: string | null;

  beforeAll(async () => {
    pool = await getPool();
    const result = await pool.request().query(`SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(tip_cli) AS tipCli FROM saCliente WHERE inactivo = 0`);
    testCoCli = result.recordset[0].coCli;
    originalTipCli = result.recordset[0].tipCli;
  });

  test('reassigns a customer to an existing price list and reflects it on re-read', async () => {
    const priceListResult = await pool.request().query(`SELECT TOP 1 RTRIM(co_precio) AS coPrecio FROM saTipoPrecio`);
    const targetCoPrecio: string = priceListResult.recordset[0].coPrecio;

    const outcome = await assignCustomerPriceList(pool, testCoCli, targetCoPrecio, 'TESTRUN');
    expect(outcome.outcome).toBe('success');

    const updated = await readFullCustomerRow(pool, testCoCli);
    const tipoClienteResult = await pool.request()
      .input('tipCli', updated!.tipCli)
      .query(`SELECT RTRIM(co_precio) AS coPrecio FROM saTipoCliente WHERE RTRIM(tip_cli) = RTRIM(@tipCli)`);
    expect(tipoClienteResult.recordset[0].coPrecio).toBe(targetCoPrecio);
  });

  test('a stale validador (concurrent edit) is reported as a conflict, not a silent success', async () => {
    const current = await readFullCustomerRow(pool, testCoCli);
    // Simulate a concurrent edit: touch the row via a second read/no-op write
    // isn't sufficient to bump validador on its own; instead call the
    // assignment twice with the SAME pre-read `current` snapshot -- the
    // second call's passed validador will be stale after the first
    // succeeds, exercising the conflict path directly rather than via a
    // second real writer.
    const priceListResult = await pool.request().query(`SELECT RTRIM(co_precio) AS coPrecio FROM saTipoPrecio ORDER BY co_precio`);
    const [firstList, secondList] = priceListResult.recordset;

    await assignCustomerPriceList(pool, testCoCli, firstList.coPrecio, 'TESTRUN');
    // current is now stale (validador in the ERP has moved on).
    const staleOutcome = await updateCustomerTipCli(pool, current!, secondList.coPrecio, 'TESTRUN');
    expect(staleOutcome).toBe('conflict');
  });

  test('assigning to a price list with no saTipoCliente row auto-creates one', async () => {
    const newCoPrecio = `TP${Date.now().toString().slice(-4)}`;
    // saTipoPrecio.co_us_in, fe_us_in, co_us_mo, fe_us_mo are all NOT NULL
    // with no default (live-verified) -- this direct test-fixture INSERT
    // (bypassing any saTipoPrecio-side native SP, since none is in scope
    // for this task) must supply them explicitly.
    await pool.request()
      .input('coPrecio', newCoPrecio)
      .input('desPrecio', `Test Price List ${newCoPrecio}`)
      .query(`INSERT INTO saTipoPrecio (co_precio, des_precio, incluye_imp, co_us_in, fe_us_in, co_us_mo, fe_us_mo)
              VALUES (@coPrecio, @desPrecio, 0, 'TESTRU', GETDATE(), 'TESTRU', GETDATE())`);

    const outcome = await assignCustomerPriceList(pool, testCoCli, newCoPrecio, 'TESTRUN');
    expect(outcome.outcome).toBe('success');

    const tipoClienteResult = await pool.request()
      .input('coPrecio', newCoPrecio)
      .query(`SELECT COUNT(*) AS cnt FROM saTipoCliente WHERE RTRIM(co_precio) = RTRIM(@coPrecio)`);
    expect(tipoClienteResult.recordset[0].cnt).toBe(1);
  });

  test('restores the test customer to their original tip_cli afterward', async () => {
    if (!originalTipCli) return;
    const current = await readFullCustomerRow(pool, testCoCli);
    await updateCustomerTipCli(pool, current!, originalTipCli, 'TESTRUN');

    const restored = await readFullCustomerRow(pool, testCoCli);
    expect(restored!.tipCli.trim()).toBe(originalTipCli.trim());
  });
});

import { POST } from '../../../app/api/pricing/assignments/route';
import { NextRequest } from 'next/server';
import { signToken } from '../../../lib/auth/session';

describe('POST /api/pricing/assignments permission boundary', () => {
  test('rejects a request with no session cookie', async () => {
    const request = new NextRequest('http://localhost/api/pricing/assignments', {
      method: 'POST',
      body: JSON.stringify({ customerCodes: ['X'], targetCoPrecio: '01' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  test('rejects a valid session with no pricing module grant', async () => {
    // A signed session for a plain 'user' role with no user_modules row at
    // all (a fabricated, very unlikely-to-collide numeric userId, so this
    // never touches a real row in the app's SQLite DB): getPricingAccessLevel
    // queries user_modules for this userId and role, finds nothing, and
    // requirePricingAccess('edit') must reject with 403 -- exercising the
    // module-grant boundary without inserting any SQLite fixture data.
    const token = await signToken({ sub: '999999999', role: 'user', name: 'No Access Test User' });
    const request = new NextRequest('http://localhost/api/pricing/assignments', {
      method: 'POST',
      headers: { cookie: `session=${token}` },
      body: JSON.stringify({ customerCodes: ['X'], targetCoPrecio: '01' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
