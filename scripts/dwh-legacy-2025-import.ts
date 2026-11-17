import sql from 'mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';

// One-time historical backfill, NOT part of the tracked migrations/
// system (unlike migrations/dwh/*.sql, this never re-runs and has no
// dwh.__dwh_migrations entry) — same "standalone operational script"
// framing as scripts/dwh-backfill.ts. Loads Jan 2025-Feb 2026 sales/
// returns data from the pre-March-2026-cutover Profit Plus server into
// the _Legacy dimension/fact tables created by
// migrations/dwh/0034_legacy_2025_schema.sql. See
// docs/superpowers/specs/2026-09-23-legacy-2025-import-design.md for
// why this can't reuse the existing Load_Dim_*/Load_Fact_* machinery
// (different server, one-time load, unmapped customer/product/rep
// identities across the cutover).
//
// The legacy server is expected to be decommissioned after this script
// runs successfully — LEGACY_DB_* env vars are read ONLY here, never by
// the running app.

// 2020-01-01: the Analítica histórica section covers 2020 onwards (originally
// 2025-01-01). Re-running requires emptying the _Legacy tables first
// (migrations/dwh/0042_truncate_legacy_tables.sql).
export const IMPORT_START_DATE = '2020-01-01';
// 2026 is not a leap year (not divisible by 4) — the actual end boundary
// is Feb 28, not Feb 29. Do not "fix" this to 02-29 without re-checking
// the year.
export const IMPORT_END_DATE = '2026-02-28';

function legacyEnv(name: string): string {
  const value = process.env[`LEGACY_DB_${name}`];
  if (value === undefined) {
    throw new Error(`LEGACY_DB_${name} is not set — required to run the Histórico 2025 import`);
  }
  return value;
}

export function buildLegacyConfig(): sql.config {
  return {
    server: legacyEnv('SERVER'),
    port: parseInt(process.env.LEGACY_DB_PORT ?? '1433'),
    database: legacyEnv('NAME'),
    user: legacyEnv('USER'),
    password: legacyEnv('PASSWORD'),
    options: {
      encrypt: (process.env.LEGACY_DB_ENCRYPT ?? 'false') === 'true',
      trustServerCertificate: (process.env.LEGACY_DB_TRUST_SERVER_CERT ?? 'true') !== 'false',
    },
  };
}

export async function getLegacyPool(): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool(buildLegacyConfig()).connect();
}

const BULK_BATCH_SIZE = 5000;

type BulkColumn = { name: string; type: sql.ISqlTypeFactoryWithNoParams | sql.ISqlType; nullable: boolean };

// Batched bulk insert (one round trip per BULK_BATCH_SIZE rows instead of one
// per row): six years of facts is far too many rows for row-by-row INSERTs.
async function bulkInsert(
  dwhPool: sql.ConnectionPool, tableName: string, columns: BulkColumn[], rows: unknown[][],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BULK_BATCH_SIZE) {
    const table = new sql.Table(tableName);
    table.create = false;
    for (const c of columns) table.columns.add(c.name, c.type, { nullable: c.nullable });
    for (const row of rows.slice(i, i + BULK_BATCH_SIZE)) table.rows.add(...(row as (string | number | boolean | null)[]));
    await dwhPool.request().bulk(table);
  }
}

export interface RateRow { dateKey: number; rateBuy: number | null; rateSell: number }
export interface FilledRateRow extends RateRow { isCarriedForward: boolean }

function nextDateKey(key: number): number {
  const d = new Date(Date.UTC(Math.floor(key / 10000), Math.floor((key % 10000) / 100) - 1, key % 100 + 1));
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// One entry per calendar day from startKey to endKey. A day with no real rate
// repeats the last real one (isCarriedForward = true) -- same rule as
// dwh.Load_Fact_ExchangeRate (migrations/dwh/0036). Real rows before startKey
// seed the carry but are not emitted; days before the first real rate are
// omitted entirely (no rate -> USD stays NULL downstream, never 0).
export function fillRatesCarryForward(rows: RateRow[], startKey: number, endKey: number): FilledRateRow[] {
  const byKey = new Map(rows.map(r => [r.dateKey, r]));
  let last: RateRow | null = null;
  for (const r of [...rows].sort((a, b) => a.dateKey - b.dateKey)) {
    if (r.dateKey < startKey) last = r;
  }
  const out: FilledRateRow[] = [];
  for (let key = startKey; key <= endKey; key = nextDateKey(key)) {
    const real = byKey.get(key);
    if (real) {
      last = real;
      out.push({ ...real, isCarriedForward: false });
    } else if (last) {
      out.push({ dateKey: key, rateBuy: last.rateBuy, rateSell: last.rateSell, isCarriedForward: true });
    }
  }
  return out;
}

// USD rates from the OLD ERP's own saTasa (not the current ERP's), so legacy
// USD figures use the rates that were actually in force then.
export async function loadFactExchangeRateLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT CONVERT(int, CONVERT(char(8), fecha, 112)) AS DateKey, RTRIM(co_mone) AS Currency,
           tasa_c AS RateBuy, tasa_v AS RateSell, fecha
    FROM dbo.saTasa
    WHERE RTRIM(co_mone) IN ('USD', 'US$') AND tasa_v IS NOT NULL AND tasa_v > 0
    ORDER BY fecha
  `);
  // One real rate per day: prefer 'USD' over 'US$', then the latest timestamp.
  const byDay = new Map<number, { rate: RateRow; isUsd: boolean }>();
  for (const r of result.recordset as { DateKey: number; Currency: string; RateBuy: number | null; RateSell: number }[]) {
    const isUsd = r.Currency === 'USD';
    const prev = byDay.get(r.DateKey);
    if (prev && prev.isUsd && !isUsd) continue;
    byDay.set(r.DateKey, { rate: { dateKey: r.DateKey, rateBuy: r.RateBuy, rateSell: Number(r.RateSell) }, isUsd });
  }
  // Idempotent after a partly failed earlier run: assertNotAlreadyImported only
  // guards the sales table, and this table is keyed by DateKey.
  await dwhPool.request().query('DELETE FROM fact.Fact_ExchangeRate_Legacy');
  const startKey = parseInt(IMPORT_START_DATE.replace(/-/g, ''));
  const endKey = parseInt(IMPORT_END_DATE.replace(/-/g, ''));
  const filled = fillRatesCarryForward([...byDay.values()].map(v => v.rate), startKey, endKey);
  await bulkInsert(dwhPool, 'fact.Fact_ExchangeRate_Legacy', [
    { name: 'DateKey', type: sql.Int, nullable: false },
    { name: 'RateBuy', type: sql.Decimal(21, 8), nullable: true },
    { name: 'RateSell', type: sql.Decimal(21, 8), nullable: false },
    { name: 'IsCarriedForward', type: sql.Bit, nullable: false },
  ], filled.map(r => [r.dateKey, r.rateBuy, r.rateSell, r.isCarriedForward]));
  return filled.length;
}

// Copies saCliente.matriz of the legacy server into the already-loaded
// dim.Dim_Customer_Legacy rows and rebuilds the casa matriz roll-up, without reloading
// any fact (`--matriz-only`, for a legacy load made before migration 0044).
export async function loadLegacyMatriz(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT RTRIM(co_cli) AS Code, NULLIF(RTRIM(matriz), '') AS Matriz FROM dbo.saCliente
  `);
  let count = 0;
  for (const row of result.recordset as { Code: string; Matriz: string | null }[]) {
    await dwhPool.request()
      .input('code', sql.Char(16), row.Code)
      .input('matriz', sql.Char(16), row.Matriz)
      .query('UPDATE dim.Dim_Customer_Legacy SET MatrizCode = @matriz WHERE RTRIM(CustomerCode) = RTRIM(@code)');
    count++;
  }
  await dwhPool.request().query('EXEC dwh.Load_Dim_LegalEntity_Legacy');
  return count;
}

export interface ImportArgs { reset: boolean; confirmDb: string | null; matrizOnly: boolean }

export function parseImportArgs(argv: string[]): ImportArgs {
  const i = argv.indexOf('--confirm-db');
  return { reset: argv.includes('--reset'), confirmDb: i >= 0 && argv[i + 1] ? argv[i + 1] : null, matrizOnly: argv.includes('--matriz-only') };
}

const LEGACY_TABLES = [
  'fact.Fact_Sales_Legacy', 'fact.Fact_Returns_Legacy', 'fact.Fact_ExchangeRate_Legacy',
  'dim.Dim_Customer_Legacy', 'dim.Dim_LegalEntity_Legacy', 'dim.Dim_Product_Legacy', 'dim.Dim_SalesRep_Legacy',
] as const;

// Empties the six legacy tables (same effect as migration 0042, plus the rates table) so
// an import that failed half way can be re-run: facts and rates first, then the dims
// (referenced by FKs, so DELETE + reseed instead of TRUNCATE). Only *_Legacy tables.
export async function resetLegacyTables(dwhPool: sql.ConnectionPool): Promise<void> {
  for (const t of ['fact.Fact_Returns_Legacy', 'fact.Fact_Sales_Legacy', 'fact.Fact_ExchangeRate_Legacy']) {
    await dwhPool.request().query(`TRUNCATE TABLE ${t}`);
  }
  for (const t of ['dim.Dim_Customer_Legacy', 'dim.Dim_LegalEntity_Legacy', 'dim.Dim_Product_Legacy', 'dim.Dim_SalesRep_Legacy']) {
    await dwhPool.request().query(`DELETE FROM ${t}`);
    await dwhPool.request().query(`DBCC CHECKIDENT ('${t}', RESEED, 0) WITH NO_INFOMSGS`);
  }
}

export async function assertNotAlreadyImported(dwhPool: sql.ConnectionPool): Promise<void> {
  for (const table of LEGACY_TABLES) {
    const result = await dwhPool.request().query(`SELECT COUNT(*) AS TotalRows FROM ${table}`);
    const rowCount = Number(result.recordset[0].TotalRows);
    if (rowCount > 0) {
      throw new Error(
        `${table} already has ${rowCount} row(s) — refusing to import over existing legacy data. ` +
        `To start over (e.g. after a failed run), re-run with: --reset --confirm-db <DW_NAME>, ` +
        `which empties the seven legacy tables (the same effect as migrations/dwh/0042_truncate_legacy_tables.sql, plus fact.Fact_ExchangeRate_Legacy and dim.Dim_LegalEntity_Legacy).`
      );
    }
  }
}

// Straight loads from the legacy server — no cross-referencing against
// the current-era Dim_Customer/Dim_Product/Dim_SalesRep (see spec's "Why
// fully independent product/sales-rep matching" section: codes may have
// changed at the cutover for any of these three, not just customers, and
// there's no way to verify which without live access to the old server).
// Each is a plain INSERT (not a MERGE/upsert) since this is a one-time
// load into an empty table, guarded by assertNotAlreadyImported.

export async function loadDimCustomerLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT RTRIM(co_cli) AS CustomerCode, cli_des AS CustomerName, co_zon AS ZoneCode, co_seg AS SegmentCode,
           NULLIF(RTRIM(matriz), '') AS MatrizCode
    FROM dbo.saCliente
  `);

  let count = 0;
  for (const row of result.recordset as { CustomerCode: string; CustomerName: string | null; ZoneCode: string | null; SegmentCode: string | null; MatrizCode: string | null }[]) {
    await dwhPool.request()
      .input('code', sql.Char(16), row.CustomerCode)
      .input('name', sql.VarChar(120), row.CustomerName)
      .input('zone', sql.Char(6), row.ZoneCode)
      .input('segment', sql.Char(6), row.SegmentCode)
      .input('matriz', sql.Char(16), row.MatrizCode)
      .query(`
        INSERT INTO dim.Dim_Customer_Legacy (CustomerCode, CustomerName, ZoneCode, SegmentCode, MatrizCode)
        VALUES (@code, @name, @zone, @segment, @matriz)
      `);
    count++;
  }
  // Roll the stores up to their casa matriz (migrations/dwh/0044).
  await dwhPool.request().query('EXEC dwh.Load_Dim_LegalEntity_Legacy');
  return count;
}

export async function loadDimProductLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT
      RTRIM(a.co_art) AS ProductCode, a.art_des AS ProductName,
      RTRIM(a.co_lin) AS LineCode, l.lin_des AS LineName,
      RTRIM(a.co_subl) AS SubLineCode, sl.subl_des AS SubLineName,
      RTRIM(a.co_cat) AS CategoryCode, c.cat_des AS CategoryName
    FROM dbo.saArticulo a
    LEFT JOIN dbo.saLineaArticulo l ON RTRIM(l.co_lin) = RTRIM(a.co_lin)
    LEFT JOIN dbo.saSubLinea sl ON RTRIM(sl.co_lin) = RTRIM(a.co_lin) AND RTRIM(sl.co_subl) = RTRIM(a.co_subl)
    LEFT JOIN dbo.saCatArticulo c ON RTRIM(c.co_cat) = RTRIM(a.co_cat)
  `);

  let count = 0;
  for (const row of result.recordset as {
    ProductCode: string; ProductName: string | null;
    LineCode: string | null; LineName: string | null;
    SubLineCode: string | null; SubLineName: string | null;
    CategoryCode: string | null; CategoryName: string | null;
  }[]) {
    await dwhPool.request()
      .input('code', sql.Char(30), row.ProductCode)
      .input('name', sql.VarChar(120), row.ProductName)
      .input('lineCode', sql.Char(6), row.LineCode)
      .input('lineName', sql.VarChar(60), row.LineName)
      .input('subLineCode', sql.Char(6), row.SubLineCode)
      .input('subLineName', sql.VarChar(60), row.SubLineName)
      .input('categoryCode', sql.Char(6), row.CategoryCode)
      .input('categoryName', sql.VarChar(60), row.CategoryName)
      .query(`
        INSERT INTO dim.Dim_Product_Legacy (
          ProductCode, ProductName, LineCode, LineName, SubLineCode, SubLineName, CategoryCode, CategoryName
        )
        VALUES (@code, @name, @lineCode, @lineName, @subLineCode, @subLineName, @categoryCode, @categoryName)
      `);
    count++;
  }
  return count;
}

export async function loadDimSalesRepLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT RTRIM(co_ven) AS SalesRepCode, ven_des AS SalesRepName, co_zon AS ZoneCode
    FROM dbo.saVendedor
  `);

  let count = 0;
  for (const row of result.recordset as { SalesRepCode: string; SalesRepName: string | null; ZoneCode: string | null }[]) {
    await dwhPool.request()
      .input('code', sql.Char(6), row.SalesRepCode)
      .input('name', sql.VarChar(60), row.SalesRepName)
      .input('zone', sql.Char(6), row.ZoneCode)
      .query(`
        INSERT INTO dim.Dim_SalesRep_Legacy (SalesRepCode, SalesRepName, ZoneCode)
        VALUES (@code, @name, @zone)
      `);
    count++;
  }
  return count;
}

// Mirrors dwh.Load_Fact_Sales (migrations/dwh/0036: NetAmount nets
// monto_desc_glob) column mapping exactly, against the legacy connection and legacy dimensions
// instead of Ncake_a/current dimensions. No MERGE/watermark logic (see
// Task 3's design notes) — a one-time INSERT into an empty table.
export async function loadFactSalesLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request()
    .input('startDate', sql.Date, IMPORT_START_DATE)
    .input('endDate', sql.Date, IMPORT_END_DATE)
    .query(`
      SELECT
        r.reng_num AS LineNumber, r.doc_num AS InvoiceNumber, r.co_art AS ProductCode,
        r.total_art AS QuantitySold,
        ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
        r.reng_neto - ISNULL(r.monto_desc_glob, 0) AS NetAmount,
        f.co_cli AS CustomerCode, f.co_ven AS SalesRepCode, f.tasa AS DocumentExchangeRate,
        CONVERT(int, CONVERT(char(8), f.fec_emis, 112)) AS DateKey,
        ISNULL(f.anulado, 0) AS IsVoided
      FROM dbo.saFacturaVenta f
      INNER JOIN dbo.saFacturaVentaReng r ON r.doc_num = f.doc_num
      WHERE f.fec_emis >= @startDate AND f.fec_emis < DATEADD(day, 1, @endDate)
    `);

  // Resolve legacy dimension keys by code, entirely within the legacy
  // server's own identity space — no lookup against current dimensions.
  const customerKeys = await dwhPool.request().query(`SELECT CustomerLegacyKey, RTRIM(CustomerCode) AS CustomerCode FROM dim.Dim_Customer_Legacy`);
  const productKeys = await dwhPool.request().query(`SELECT ProductLegacyKey, RTRIM(ProductCode) AS ProductCode FROM dim.Dim_Product_Legacy`);
  const salesRepKeys = await dwhPool.request().query(`SELECT SalesRepLegacyKey, RTRIM(SalesRepCode) AS SalesRepCode FROM dim.Dim_SalesRep_Legacy`);
  const customerKeyByCode = new Map(customerKeys.recordset.map((r: { CustomerLegacyKey: number; CustomerCode: string }) => [r.CustomerCode, r.CustomerLegacyKey]));
  const productKeyByCode = new Map(productKeys.recordset.map((r: { ProductLegacyKey: number; ProductCode: string }) => [r.ProductCode, r.ProductLegacyKey]));
  const salesRepKeyByCode = new Map(salesRepKeys.recordset.map((r: { SalesRepLegacyKey: number; SalesRepCode: string }) => [r.SalesRepCode, r.SalesRepLegacyKey]));

  const rows: unknown[][] = [];
  for (const row of result.recordset as {
    LineNumber: number; InvoiceNumber: string; ProductCode: string; QuantitySold: number;
    DiscountAmount: number; NetAmount: number; CustomerCode: string; SalesRepCode: string | null;
    DocumentExchangeRate: number | null; DateKey: number; IsVoided: boolean;
  }[]) {
    const customerLegacyKey = customerKeyByCode.get(row.CustomerCode.trim());
    const productLegacyKey = productKeyByCode.get(row.ProductCode.trim());
    if (customerLegacyKey === undefined || productLegacyKey === undefined) continue; // no matching dimension row — skip, matching Load_Fact_Sales's own WHERE cust/prod IS NOT NULL behavior
    const salesRepLegacyKey = row.SalesRepCode ? salesRepKeyByCode.get(row.SalesRepCode.trim()) ?? null : null;
    rows.push([
      row.DateKey, customerLegacyKey, productLegacyKey, salesRepLegacyKey,
      row.InvoiceNumber, row.LineNumber, row.QuantitySold, row.NetAmount, row.DocumentExchangeRate, row.IsVoided,
    ]);
  }
  await bulkInsert(dwhPool, 'fact.Fact_Sales_Legacy', [
    { name: 'DateKey', type: sql.Int, nullable: false },
    { name: 'CustomerLegacyKey', type: sql.Int, nullable: false },
    { name: 'ProductLegacyKey', type: sql.Int, nullable: false },
    { name: 'SalesRepLegacyKey', type: sql.Int, nullable: true },
    { name: 'InvoiceNumber', type: sql.Char(20), nullable: false },
    { name: 'LineNumber', type: sql.Int, nullable: false },
    { name: 'QuantitySold', type: sql.Decimal(18, 5), nullable: false },
    { name: 'NetAmount', type: sql.Decimal(18, 2), nullable: false },
    { name: 'DocumentExchangeRate', type: sql.Decimal(21, 8), nullable: true },
    { name: 'IsVoided', type: sql.Bit, nullable: false },
  ], rows);
  return rows.length;
}

// Mirrors dwh.Load_Fact_Returns (migrations/dwh/0036: global-discount-netted
// NetAmount + original-factura link), same legacy-only resolution as
// loadFactSalesLegacy above.
export async function loadFactReturnsLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request()
    .input('startDate', sql.Date, IMPORT_START_DATE)
    .input('endDate', sql.Date, IMPORT_END_DATE)
    .query(`
      -- Window the devoluciones FIRST (a derived table over the devolución
      -- header date), and only then look up each line's original factura —
      -- so the factura lookups run for the ~14 months of returns in scope,
      -- never for the whole devolución history. The factura side is a key
      -- lookup (rowguid / doc_num), not a date scan, so a factura older than
      -- the window still resolves (its date is what excludes it from the
      -- Histórico tab).
      SELECT
        w.reng_num AS LineNumber, w.doc_num AS CreditNoteNumber, w.co_art AS ProductCode,
        w.total_art AS QuantityReturned,
        w.reng_neto - ISNULL(w.monto_desc_glob, 0) AS NetAmount,
        w.co_cli AS CustomerCode, w.co_ven AS SalesRepCode, w.tasa AS DocumentExchangeRate,
        CONVERT(int, CONVERT(char(8), w.fec_emis, 112)) AS DateKey,
        ISNULL(w.anulado, 0) AS IsVoided,
        COALESCE(byLine.doc_num, byDoc.doc_num) AS OriginalInvoiceNumber,
        byLine.reng_num AS OriginalInvoiceLineNumber,
        CONVERT(int, CONVERT(char(8), COALESCE(byLine.fec_emis, byDoc.fec_emis), 112)) AS OriginalInvoiceDateKey
      FROM (
        SELECT
          r.reng_num, r.doc_num, r.co_art, r.total_art, r.reng_neto, r.monto_desc_glob,
          r.rowguid_doc, r.tipo_doc, r.num_doc,
          d.co_cli, d.co_ven, d.tasa, d.fec_emis, d.anulado
        FROM dbo.saDevolucionCliente d
        INNER JOIN dbo.saDevolucionClienteReng r ON r.doc_num = d.doc_num
        WHERE d.fec_emis >= @startDate AND d.fec_emis < DATEADD(day, 1, @endDate)
      ) w
      -- (a) exact factura line via rowguid_doc — same resolution as dwh.Load_Fact_Returns (0036)
      OUTER APPLY (
        SELECT TOP 1 fv.doc_num, fvr.reng_num, fv.fec_emis
        FROM dbo.saFacturaVentaReng fvr
        INNER JOIN dbo.saFacturaVenta fv ON fv.doc_num = fvr.doc_num
        WHERE fvr.rowguid = w.rowguid_doc
      ) byLine
      -- (b) fallback: factura header by num_doc
      OUTER APPLY (
        SELECT TOP 1 fv.doc_num, fv.fec_emis
        FROM dbo.saFacturaVenta fv
        WHERE byLine.doc_num IS NULL
          AND RTRIM(w.tipo_doc) = 'FACT'
          AND fv.doc_num = w.num_doc
      ) byDoc
    `);

  const customerKeys = await dwhPool.request().query(`SELECT CustomerLegacyKey, RTRIM(CustomerCode) AS CustomerCode FROM dim.Dim_Customer_Legacy`);
  const productKeys = await dwhPool.request().query(`SELECT ProductLegacyKey, RTRIM(ProductCode) AS ProductCode FROM dim.Dim_Product_Legacy`);
  const salesRepKeys = await dwhPool.request().query(`SELECT SalesRepLegacyKey, RTRIM(SalesRepCode) AS SalesRepCode FROM dim.Dim_SalesRep_Legacy`);
  const customerKeyByCode = new Map(customerKeys.recordset.map((r: { CustomerLegacyKey: number; CustomerCode: string }) => [r.CustomerCode, r.CustomerLegacyKey]));
  const productKeyByCode = new Map(productKeys.recordset.map((r: { ProductLegacyKey: number; ProductCode: string }) => [r.ProductCode, r.ProductLegacyKey]));
  const salesRepKeyByCode = new Map(salesRepKeys.recordset.map((r: { SalesRepLegacyKey: number; SalesRepCode: string }) => [r.SalesRepCode, r.SalesRepLegacyKey]));

  const rows: unknown[][] = [];
  for (const row of result.recordset as {
    LineNumber: number; CreditNoteNumber: string; ProductCode: string; QuantityReturned: number;
    NetAmount: number; CustomerCode: string; SalesRepCode: string | null;
    DocumentExchangeRate: number | null; DateKey: number; IsVoided: boolean;
    OriginalInvoiceNumber: string | null; OriginalInvoiceLineNumber: number | null; OriginalInvoiceDateKey: number | null;
  }[]) {
    const customerLegacyKey = customerKeyByCode.get(row.CustomerCode.trim());
    const productLegacyKey = productKeyByCode.get(row.ProductCode.trim());
    if (customerLegacyKey === undefined || productLegacyKey === undefined) continue;
    // Same fallback as 0036: no resolvable factura -> attribute to the
    // devolución's own date and flag HasInvoiceLink = 0.
    const hasInvoiceLink = row.OriginalInvoiceDateKey !== null;
    const originalInvoiceDateKey = row.OriginalInvoiceDateKey ?? row.DateKey;
    const salesRepLegacyKey = row.SalesRepCode ? salesRepKeyByCode.get(row.SalesRepCode.trim()) ?? null : null;
    rows.push([
      row.DateKey, customerLegacyKey, productLegacyKey, salesRepLegacyKey,
      row.CreditNoteNumber, row.LineNumber, row.QuantityReturned, row.NetAmount, row.DocumentExchangeRate, row.IsVoided,
      row.OriginalInvoiceNumber, row.OriginalInvoiceLineNumber, originalInvoiceDateKey, hasInvoiceLink,
    ]);
  }
  await bulkInsert(dwhPool, 'fact.Fact_Returns_Legacy', [
    { name: 'DateKey', type: sql.Int, nullable: false },
    { name: 'CustomerLegacyKey', type: sql.Int, nullable: false },
    { name: 'ProductLegacyKey', type: sql.Int, nullable: false },
    { name: 'SalesRepLegacyKey', type: sql.Int, nullable: true },
    { name: 'CreditNoteNumber', type: sql.Char(20), nullable: false },
    { name: 'LineNumber', type: sql.Int, nullable: false },
    { name: 'QuantityReturned', type: sql.Decimal(18, 5), nullable: false },
    { name: 'NetAmount', type: sql.Decimal(18, 2), nullable: false },
    { name: 'DocumentExchangeRate', type: sql.Decimal(21, 8), nullable: true },
    { name: 'IsVoided', type: sql.Bit, nullable: false },
    { name: 'OriginalInvoiceNumber', type: sql.Char(20), nullable: true },
    { name: 'OriginalInvoiceLineNumber', type: sql.Int, nullable: true },
    { name: 'OriginalInvoiceDateKey', type: sql.Int, nullable: true },
    { name: 'HasInvoiceLink', type: sql.Bit, nullable: false },
  ], rows);
  return rows.length;
}

async function main(): Promise<void> {
  const dwhPool = await getDwhPool();
  const args = parseImportArgs(process.argv.slice(2));
  if (args.matrizOnly) {
    const legacyOnly = await getLegacyPool();
    try {
      const n = await loadLegacyMatriz(legacyOnly, dwhPool);
      console.log(`✓ casa matriz: ${n} legacy customers read, legal entities rebuilt`);
    } finally {
      await legacyOnly.close();
    }
    return;
  }
  if (args.reset) {
    const dbName = process.env.DW_NAME ?? 'DWH_AlimentosNY';
    if (args.confirmDb !== dbName) {
      throw new Error(`--reset needs --confirm-db ${dbName} (the target database name) — refusing to empty the legacy tables`);
    }
    await resetLegacyTables(dwhPool);
    console.log('✓ legacy tables emptied (--reset)');
  }
  await assertNotAlreadyImported(dwhPool);

  const legacyPool = await getLegacyPool();
  try {
    const ratesCount = await loadFactExchangeRateLegacy(legacyPool, dwhPool);
    console.log(`✓ Fact_ExchangeRate_Legacy: ${ratesCount} rows loaded (0 means USD figures will show as unavailable for the whole period)`);

    const customerCount = await loadDimCustomerLegacy(legacyPool, dwhPool);
    console.log(`✓ Dim_Customer_Legacy: ${customerCount} rows loaded`);

    const productCount = await loadDimProductLegacy(legacyPool, dwhPool);
    console.log(`✓ Dim_Product_Legacy: ${productCount} rows loaded`);

    const salesRepCount = await loadDimSalesRepLegacy(legacyPool, dwhPool);
    console.log(`✓ Dim_SalesRep_Legacy: ${salesRepCount} rows loaded`);

    const salesCount = await loadFactSalesLegacy(legacyPool, dwhPool);
    console.log(`✓ Fact_Sales_Legacy: ${salesCount} rows loaded`);

    const returnsCount = await loadFactReturnsLegacy(legacyPool, dwhPool);
    console.log(`✓ Fact_Returns_Legacy: ${returnsCount} rows loaded`);
  } finally {
    await legacyPool.close();
  }
}

if (import.meta.main) {
  main()
    .then(() => {
      console.log('✓ legacy import completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('✗ Error running the legacy import:', error);
      process.exit(1);
    });
}
