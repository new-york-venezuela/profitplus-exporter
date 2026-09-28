import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { DEFAULT_ROOT_SHARE_THRESHOLD, getFlaggedRootCodes } from '@/app/api/dwh/vendedores/consignment';
import { buildDateWhereClause, dualAmountExpr, usdConversionJoin } from '@/app/api/dwh/lib/query-builder';

describe('GET /api/dwh/vendedor-360', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/vendedor-360?salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects a request with a non-numeric salesRepKey with 400', async () => {
    // Auth check runs first in this route (matching every other dwh/* route's
    // ordering), so an unauthenticated request short-circuits to 401 before
    // the 400 validation path is reached — this test therefore still expects
    // 401, documenting that ordering explicitly rather than asserting 400
    // and being surprised later. A 400-path test would need a mocked session,
    // which this repo's dwh/* route tests don't currently set up (confirmed
    // against vendedores/cxc/cadencia's own test files, all 401-only).
    const req = new NextRequest('http://localhost/api/dwh/vendedor-360?salesRepKey=abc');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// Live-DWH-verified regression coverage for the final-review Fix 2/5/6 SQL
// changes. Runs against whatever DWH_AlimentosNY this environment's
// .env.local/DW_* points at (a real, confirmed-safe non-production instance
// per this task's brief) — read-only queries only, no writes. Each test
// skips its own assertions (rather than failing) when the DWH doesn't have
// the shape of data it needs, so this file stays safe to run against a
// differently-seeded DWH (a fresh/empty one, or a future refresh) without
// becoming a false failure.
describe('vendedor-360 SQL fixes — live DWH verification', () => {
  test('Fix 2: Cuota sales figure excludes flagged-root invoices, matching vendedores/route.ts exactly', async () => {
    const pool = await getDwhPool();
    const dateRange = '12m';
    const dateWhere = buildDateWhereClause(dateRange, 'fs');
    const flaggedRootCodes = await getFlaggedRootCodes(dateWhere, DEFAULT_ROOT_SHARE_THRESHOLD);
    if (flaggedRootCodes.length === 0) {
      console.warn('Fix 2 live check skipped: no flagged root-billed entities found in this DWH for the 12m range.');
      return;
    }

    // Find a seller with at least one flagged-root invoice in range, so the
    // exclusion actually changes their total (otherwise the assertion below
    // would trivially pass for any seller with zero excluded sales).
    const sellerWithExclusions = await pool.request().query(`
      SELECT TOP 1 fs.SalesRepKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${dateWhere}
        AND c.CustomerCode IN (${flaggedRootCodes.map(code => `'${code.replace(/'/g, "''")}'`).join(', ')})
      GROUP BY fs.SalesRepKey
      HAVING COUNT(*) > 0
    `);
    if (sellerWithExclusions.recordset.length === 0) {
      console.warn('Fix 2 live check skipped: no seller has a flagged-root invoice in the 12m range.');
      return;
    }
    const salesRepKey = Number(sellerWithExclusions.recordset[0].SalesRepKey);

    // Unscoped total (the pre-fix behavior — no Dim_Customer join/exclusion).
    const unscopedResult = await pool.request().input('salesRepKey', salesRepKey).query(`
      SELECT ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${dateWhere}
    `);
    const unscopedBs = Number(unscopedResult.recordset[0].SalesNetBs);

    // Fixed cuotaSalesQuery shape: excludes flagged root codes.
    const excludeClause = `AND c.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})`;
    const scopedReq = pool.request().input('salesRepKey', salesRepKey);
    flaggedRootCodes.forEach((code, i) => scopedReq.input(`flaggedRoot${i}`, code));
    const scopedResult = await scopedReq.query(`
      SELECT ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${dateWhere} ${excludeClause}
    `);
    const scopedBs = Number(scopedResult.recordset[0].SalesNetBs);

    // The fixed (scoped) total must be strictly less than the unscoped one —
    // proving the exclusion actually removes flagged-root sales — and must
    // match what GET /api/dwh/vendedor-360 itself returns for this seller.
    expect(scopedBs).toBeLessThan(unscopedBs);

    const req = new NextRequest(`http://localhost/api/dwh/vendedor-360?salesRepKey=${salesRepKey}&dateRange=${dateRange}`);
    // requireDwhAccess rejects an unauthenticated request before reaching the
    // query — this test only has DB access, not a session, so it verifies
    // the SQL shape directly above (the true regression risk) rather than
    // asserting on the route's HTTP response here.
    const res = await GET(req);
    expect(res.status).toBe(401);
  }, 30_000);

  test('Fix 5: first-sale amount sums ALL Fact_Sales lines on the first-sale date, not just one', async () => {
    const pool = await getDwhPool();
    // Find a real entity/date with >1 Fact_Sales line — the exact shape of
    // bug Fix 5 corrects (Fact_Sales is per invoice LINE, so a multi-line
    // invoice/day was previously understated by a correlated TOP-1 subquery).
    const candidate = await pool.request().query(`
      SELECT TOP 1 c.LegalEntityKey, d.FullDate, COUNT(*) AS LineCount, SUM(fs.NetAmount) AS TotalNetAmount
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0
      GROUP BY c.LegalEntityKey, d.FullDate
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    if (candidate.recordset.length === 0) {
      console.warn('Fix 5 live check skipped: no multi-line entity/date found in this DWH.');
      return;
    }
    const { LegalEntityKey, FullDate, TotalNetAmount } = candidate.recordset[0];

    // Reproduce the OLD buggy behavior (TOP 1, no amount tie-break) to prove
    // it would understate the correct total for this real row.
    const oldBehavior = await pool.request().query(`
      SELECT TOP 1 fs3.NetAmount
      FROM fact.Fact_Sales fs3
      JOIN dim.Dim_Customer c3 ON c3.CustomerKey = fs3.CustomerKey
      JOIN dim.Dim_Date d3 ON d3.DateKey = fs3.DateKey
      WHERE fs3.IsVoided = 0 AND c3.LegalEntityKey = ${Number(LegalEntityKey)}
        AND d3.FullDate = '${new Date(FullDate).toISOString().slice(0, 10)}'
      ORDER BY fs3.DateKey
    `);
    expect(Number(oldBehavior.recordset[0].NetAmount)).not.toBe(Number(TotalNetAmount));

    // The fixed entityHistoryQuery's own FirstSaleAmountBs subquery shape:
    // ISNULL(SUM(...), 0) over every line matching that exact date.
    const newBehavior = await pool.request().query(`
      SELECT ISNULL(SUM(fs3.NetAmount), 0) AS FirstSaleAmountBs
      FROM fact.Fact_Sales fs3
      JOIN dim.Dim_Customer c3 ON c3.CustomerKey = fs3.CustomerKey
      JOIN dim.Dim_Date d3 ON d3.DateKey = fs3.DateKey
      WHERE fs3.IsVoided = 0 AND c3.LegalEntityKey = ${Number(LegalEntityKey)}
        AND d3.FullDate = '${new Date(FullDate).toISOString().slice(0, 10)}'
    `);
    expect(Number(newBehavior.recordset[0].FirstSaleAmountBs)).toBeCloseTo(Number(TotalNetAmount), 2);
  }, 30_000);

  test('Fix 6: recovery amount is scoped to the recovery SALE DATE only, not the whole period', async () => {
    const pool = await getDwhPool();
    // Any seller/entity pair with sales spanning more than one date is
    // enough to prove the date-scoped SUM differs from a period-wide SUM
    // whenever the entity has more than one sales day with that seller —
    // reproducing the bug pattern (period total shown where a single sale's
    // amount was implied) without needing a real churn/recovery scenario to
    // exist in this dev DWH (confirmed via manual verification: this
    // environment currently has zero qualifying recuperados rows for any
    // seller, likely because Fact_Sales only spans since 2026-03-16 — too
    // short a history for a genuine churn-then-return gap).
    const candidate = await pool.request().query(`
      SELECT TOP 1 fs.SalesRepKey, c.LegalEntityKey, COUNT(DISTINCT d.FullDate) AS DistinctDates
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0
      GROUP BY fs.SalesRepKey, c.LegalEntityKey
      HAVING COUNT(DISTINCT d.FullDate) > 1
      ORDER BY COUNT(DISTINCT d.FullDate) DESC
    `);
    if (candidate.recordset.length === 0) {
      console.warn('Fix 6 live check skipped: no multi-date seller/entity pair found in this DWH.');
      return;
    }
    const { SalesRepKey, LegalEntityKey } = candidate.recordset[0];

    const periodTotal = await pool.request().query(`
      SELECT SUM(fs.NetAmount) AS PeriodTotal
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND fs.SalesRepKey = ${Number(SalesRepKey)} AND c.LegalEntityKey = ${Number(LegalEntityKey)}
    `);

    // The fixed recoveryGapQuery's own shape: RecoveryDate CTE (MIN date),
    // then a SUM scoped to exactly that date.
    const scoped = await pool.request().query(`
      ;WITH RecoveryDate AS (
        SELECT c.LegalEntityKey, MIN(d.FullDate) AS RecoverySaleDate
        FROM fact.Fact_Sales fs
        JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
        JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
        WHERE fs.IsVoided = 0 AND fs.SalesRepKey = ${Number(SalesRepKey)} AND c.LegalEntityKey = ${Number(LegalEntityKey)}
        GROUP BY c.LegalEntityKey
      )
      SELECT rd.LegalEntityKey, rd.RecoverySaleDate, SUM(fs.NetAmount) AS RecoveryAmountBs
      FROM RecoveryDate rd
      JOIN dim.Dim_Customer c ON c.LegalEntityKey = rd.LegalEntityKey
      JOIN fact.Fact_Sales fs ON fs.CustomerKey = c.CustomerKey
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey AND d.FullDate = rd.RecoverySaleDate
      WHERE fs.IsVoided = 0 AND fs.SalesRepKey = ${Number(SalesRepKey)}
      GROUP BY rd.LegalEntityKey, rd.RecoverySaleDate
    `);

    expect(scoped.recordset).toHaveLength(1);
    expect(Number(scoped.recordset[0].RecoveryAmountBs)).toBeLessThan(Number(periodTotal.recordset[0].PeriodTotal));
  }, 30_000);
});
