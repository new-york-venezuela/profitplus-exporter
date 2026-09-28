import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// One-time-resolved mapping from the file's store names to the existing
// dim.Dim_Customer child rows under the Gama matriz (CustomerKey 29,
// LegalEntityKey 26) -- see
// docs/superpowers/specs/2026-09-27-consignment-store-deliveries-design.md
// Section 1's mapping table. Resolved by hand against a live query, not
// fuzzy-matched at runtime. "Gama La Joya" has no ERP row yet, so it
// points at the new row Task 1's migration inserts (J-301420608-24).
export const STORE_MAP: Record<string, string> = {
  'Gama Express Santa Eduvigis': 'J-301420608-1',
  'Gama Plus Santa Eduvigis': 'J-301420608-2',
  'Gama Vizcaya': 'J-301420608-10',
  'Gama Express Santa Monica': 'J-301420608-11',
  'Gama La India': 'J-301420608-12',
  'Gama La Tahona': 'J-301420608-13',
  'Gama Express Sebucan Norte': 'J-301420608-14',
  'Gama La Urbina': 'J-301420608-15',
  'Gama Express San Bernardino': 'J-301420608-16',
  'Gama Express Macaracuay Plaza': 'J-301420608-17',
  'Gama Express Caurimare': 'J-301420608-18',
  'Gama Panamericana': 'J-301420608-19',
  'Gama Express La Castellana': 'J-301420608-20',
  'Gama Express Chuao': 'J-301420608-21',
  'Gama Los Palos Grandes': 'J-301420608-22',
  'Gama Express Los Palos Grandes': 'J-301420608-3',
  'Gama Express Las Mercedes': 'J-301420608-4',
  'Gama Express Santa Fe': 'J-301420608-5',
  'Gama Plus La Trinidad': 'J-301420608-6',
  'Gama Express La Trinidad': 'J-301420608-7',
  'Gama Express El Paraiso': 'J-301420608-8',
  'Gama Santa Fe': 'J-301420608-9',
  'Gama La Joya': 'J-301420608-24',
};

const SUMMARY_ROW_STORE_NAMES = new Set(['Total Unidades', 'Total $']);

const PRODUCT_COLUMNS = [
  '4 Granos 500gr', '7 Cereales 600gr', 'Miel y pasas 600gr', 'Pan Blanco 600gr',
  'Magdalena', 'Molido 300gr', 'Baguette 220gr', 'cheese Cake fresa',
  'cheese Cake Choco', 'Pizza Margarita 270', 'Pizza Magarita Cj',
  'Pizza New York Cj', 'Pizza Americana Cj',
] as const;

export type ParsedRow = {
  storeName: string;
  // Constructed via Date.UTC(y, m-1, d) from the workbook's raw Excel date
  // serial (see parseWorkbook) -- never from a locale-sensitive Date
  // constructor or from SheetJS's `cellDates: true` mode, both of which are
  // timezone-dependent. Always read this back with UTC getters (toDateKey
  // does) so the round-trip is stable regardless of the host TZ.
  date: Date;
  notaEntregaNum: string | null;
  productName: string;
  quantity: number;
};

export function parseWorkbook(filePath: string): ParsedRow[] {
  const buffer = readFileSync(filePath);
  // cellDates is intentionally omitted (raw serial numbers are the
  // default) -- SheetJS's cellDates: true mode constructs Date objects
  // representing local midnight of the spreadsheet's date serial, which
  // makes any later reading of that Date with UTC getters (as toDateKey
  // must, to be host-TZ-independent) produce a different calendar day
  // depending on the timezone of the machine running the import. Parsing
  // the raw serial number directly via XLSX.SSF.parse_date_code sidesteps
  // Date construction entirely and is timezone-independent.
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const parsed: ParsedRow[] = [];
  for (const raw of rawRows) {
    const storeName = raw['Nombre de Cliente'];
    if (typeof storeName !== 'string' || storeName.trim() === '') continue;
    if (SUMMARY_ROW_STORE_NAMES.has(storeName)) continue;

    const dateSerial = raw['Fecha de Despacho'];
    if (typeof dateSerial !== 'number') continue;
    const { y, m, d } = XLSX.SSF.parse_date_code(dateSerial);
    const date = new Date(Date.UTC(y, m - 1, d));

    const notaRaw = raw['Orden de Compra'];
    const notaEntregaNum = notaRaw === null || notaRaw === undefined ? null : String(notaRaw).trim();

    for (const productName of PRODUCT_COLUMNS) {
      const cell = raw[productName];
      if (typeof cell !== 'number' || cell <= 0) continue; // blank/zero cell -- no delivery of this product on this row
      parsed.push({ storeName: storeName.trim(), date, notaEntregaNum, productName, quantity: cell });
    }
  }
  return parsed;
}

export function toDateKey(date: Date): number {
  // Safe to read with UTC getters specifically because ParsedRow.date (the
  // only intended input) is always constructed via Date.UTC(y, m-1, d) --
  // see parseWorkbook. Do not pass a Date built from a locale-sensitive
  // constructor (e.g. `new Date(y, m, d)`) here, or this becomes
  // timezone-dependent again.
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return Number(`${y}${m}${d}`);
}

export function computeRowKey(
  sourceClientTag: string, customerCode: string, dateKey: number,
  notaEntregaNum: string | null, productKey: number,
): string {
  const identity = [sourceClientTag, customerCode, dateKey, notaEntregaNum ?? '', productKey].join('|');
  return createHash('sha256').update(identity).digest('hex');
}

export function computeContentHash(quantity: number): string {
  return createHash('sha256').update(String(quantity)).digest('hex');
}

import sql from 'mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';

export type ImportReport = {
  inserted: number;
  updated: { rowKey: string; oldQuantity: number; newQuantity: number }[];
  unmappedStores: string[];
  unmappedProducts: string[];
  unresolvedCustomerCodes: string[];
  pricesNotFound: { productKey: number; dateKey: number }[];
};

export async function resolveProductMap(
  pool: sql.ConnectionPool, sourceClientTag: string,
): Promise<Map<string, { productKey: number; isBoxUnit: boolean }>> {
  const result = await pool.request()
    .input('tag', sql.VarChar(40), sourceClientTag)
    .query(`SELECT ExcelProductName, ProductKey, IsBoxUnit FROM dwh.ConsignmentProductMap WHERE SourceClientTag = @tag`);
  return new Map(result.recordset.map((r: { ExcelProductName: string; ProductKey: number; IsBoxUnit: boolean }) =>
    [r.ExcelProductName, { productKey: r.ProductKey, isBoxUnit: r.IsBoxUnit }]));
}

export async function resolveCustomerKeys(
  pool: sql.ConnectionPool, customerCodes: string[],
): Promise<Map<string, number>> {
  if (customerCodes.length === 0) return new Map();
  const result = await pool.request().query(`
    SELECT RTRIM(CustomerCode) AS CustomerCode, CustomerKey
    FROM dim.Dim_Customer WHERE IsCurrent = 1
  `);
  const byCode = new Map(result.recordset.map((r: { CustomerCode: string; CustomerKey: number }) => [r.CustomerCode, r.CustomerKey]));
  const filtered = new Map<string, number>();
  for (const code of customerCodes) {
    const key = byCode.get(code);
    if (key !== undefined) filtered.set(code, key);
  }
  return filtered;
}

// As-of price lookup against Gama's own Fact_Sales history -- see spec
// Section 4. Includes every Gama CustomerKey (matriz + dormant per-store
// codes), not just the matriz, since Gama is billed one consolidated
// price regardless of which store received the goods. USD conversion
// uses the transaction's own DocumentExchangeRate, per the historical-
// USD-conversion design (2026-09-23-historical-usd-conversion-design.md)
// -- never a blanket current rate.
export async function lookupAsOfPrice(
  pool: sql.ConnectionPool, productKey: number, dateKey: number,
): Promise<number | null> {
  const result = await pool.request()
    .input('productKey', sql.Int, productKey)
    .input('dateKey', sql.Int, dateKey)
    .query(`
      SELECT TOP 1 (fs.NetAmount / NULLIF(fs.DocumentExchangeRate, 0)) / NULLIF(fs.QuantitySold, 0) AS UnitPriceUsd
      FROM fact.Fact_Sales fs
      WHERE fs.ProductKey = @productKey
        AND fs.CustomerKey IN (SELECT CustomerKey FROM dim.Dim_Customer WHERE LegalEntityKey = 26 AND IsCurrent = 1)
        AND fs.DateKey <= @dateKey
        AND fs.IsVoided = 0
      ORDER BY fs.DateKey DESC
    `);
  const price = result.recordset[0]?.UnitPriceUsd;
  return price === undefined || price === null ? null : Number(price);
}

// One resolved-but-not-yet-written row from PASS 1, carrying everything
// PASS 2 needs so it never has to re-run the STORE_MAP/productMap/
// customerKeyByCode lookups.
type ResolvedRow = {
  row: ParsedRow;
  customerCode: string;
  productKey: number;
  customerKey: number;
  dateKey: number;
  rowKey: string;
};

export async function importDeliveries(
  pool: sql.ConnectionPool, filePath: string, sourceClientTag: string,
): Promise<ImportReport> {
  const parsedRows = parseWorkbook(filePath);
  const productMap = await resolveProductMap(pool, sourceClientTag);

  // PASS 1 -- resolve/classify every row against the static maps and
  // dim.Dim_Customer, without writing anything to the DB yet. A row can
  // fail to resolve in three independent ways: unmapped store, unmapped
  // product, or a store that mapped to a customerCode with no matching
  // *current* Dim_Customer row. Collect all three, plus duplicate
  // SourceRowKeys among rows that did fully resolve, before deciding
  // whether the run may proceed.
  const unmappedStores = new Set<string>();
  const unmappedProducts = new Set<string>();
  const neededCustomerCodes = new Set<string>();
  for (const row of parsedRows) {
    const customerCode = STORE_MAP[row.storeName];
    if (customerCode === undefined) { unmappedStores.add(row.storeName); continue; }
    neededCustomerCodes.add(customerCode);
    if (!productMap.has(row.productName)) unmappedProducts.add(row.productName);
  }

  const customerKeyByCode = await resolveCustomerKeys(pool, [...neededCustomerCodes]);
  const unresolvedCustomerCodes = new Set<string>();

  const resolvedRows: ResolvedRow[] = [];
  const rowsByKey = new Map<string, ResolvedRow[]>();
  for (const row of parsedRows) {
    const customerCode = STORE_MAP[row.storeName];
    if (customerCode === undefined) continue; // already recorded in unmappedStores
    const productEntry = productMap.get(row.productName);
    if (productEntry === undefined) continue; // already recorded in unmappedProducts
    const customerKey = customerKeyByCode.get(customerCode);
    if (customerKey === undefined) { unresolvedCustomerCodes.add(customerCode); continue; }

    const dateKey = toDateKey(row.date);
    const rowKey = computeRowKey(sourceClientTag, customerCode, dateKey, row.notaEntregaNum, productEntry.productKey);
    const resolved: ResolvedRow = { row, customerCode, productKey: productEntry.productKey, customerKey, dateKey, rowKey };
    resolvedRows.push(resolved);
    const bucket = rowsByKey.get(rowKey);
    if (bucket) bucket.push(resolved); else rowsByKey.set(rowKey, [resolved]);
  }

  const duplicateGroups = [...rowsByKey.values()].filter(group => group.length > 1);

  if (unmappedStores.size > 0 || unmappedProducts.size > 0 || unresolvedCustomerCodes.size > 0 || duplicateGroups.length > 0) {
    const messages: string[] = [];
    if (unmappedStores.size > 0) {
      messages.push(`Unmapped stores (no STORE_MAP entry): ${[...unmappedStores].join(', ')}`);
    }
    if (unmappedProducts.size > 0) {
      messages.push(`Unmapped products (no ConsignmentProductMap entry for tag "${sourceClientTag}"): ${[...unmappedProducts].join(', ')}`);
    }
    if (unresolvedCustomerCodes.size > 0) {
      messages.push(`Customer codes with no current Dim_Customer row: ${[...unresolvedCustomerCodes].join(', ')}`);
    }
    if (duplicateGroups.length > 0) {
      const descriptions = duplicateGroups.map(group => {
        const { row } = group[0];
        const notaDesc = row.notaEntregaNum ?? '(sin nota)';
        const dateDesc = row.date.toISOString().slice(0, 10);
        return `store="${row.storeName}" date=${dateDesc} nota=${notaDesc} product="${row.productName}" (${group.length} rows)`;
      });
      messages.push(`Duplicate identity rows (same store/date/nota/product) found in the source file -- fix the file and re-run:\n  ${descriptions.join('\n  ')}`);
    }
    throw new Error(`Consignment delivery import for "${sourceClientTag}" aborted before any write:\n${messages.join('\n')}`);
  }

  // PASS 2 -- every row resolved cleanly and no duplicate identities exist;
  // safe to do the pricing lookups and upserts now.
  const report: ImportReport = {
    inserted: 0, updated: [], unmappedStores: [], unmappedProducts: [], unresolvedCustomerCodes: [], pricesNotFound: [],
  };

  const priceCache = new Map<string, number | null>();
  const fileName = filePath.split('/').pop() ?? filePath;

  for (const { row, customerCode, productKey, customerKey, dateKey, rowKey } of resolvedRows) {
    const priceCacheKey = `${productKey}|${dateKey}`;
    if (!priceCache.has(priceCacheKey)) {
      const price = await lookupAsOfPrice(pool, productKey, dateKey);
      priceCache.set(priceCacheKey, price);
      if (price === null) report.pricesNotFound.push({ productKey, dateKey });
    }
    const unitPriceUsd = priceCache.get(priceCacheKey) ?? null;
    const lineAmountUsd = unitPriceUsd === null ? null : Number((row.quantity * unitPriceUsd).toFixed(2));

    const contentHash = computeContentHash(row.quantity);

    const existing = await pool.request()
      .input('rowKey', sql.VarChar(64), rowKey)
      .query(`SELECT SourceRowContentHash, QuantityDelivered FROM fact.Fact_ConsignmentDeliveries WHERE SourceRowKey = @rowKey`);

    if (existing.recordset.length === 0) {
      await pool.request()
        .input('dateKey', sql.Int, dateKey)
        .input('customerKey', sql.Int, customerKey)
        .input('productKey', sql.Int, productKey)
        .input('nota', sql.VarChar(30), row.notaEntregaNum)
        .input('quantity', sql.Decimal(18, 5), row.quantity)
        .input('unitPrice', sql.Decimal(18, 5), unitPriceUsd)
        .input('lineAmount', sql.Decimal(18, 2), lineAmountUsd)
        .input('tag', sql.VarChar(40), sourceClientTag)
        .input('fileName', sql.VarChar(200), fileName)
        .input('rowKey', sql.VarChar(64), rowKey)
        .input('contentHash', sql.VarChar(64), contentHash)
        .query(`
          INSERT INTO fact.Fact_ConsignmentDeliveries
            (DateKey, CustomerKey, ProductKey, NotaEntregaNum, QuantityDelivered, UnitPriceUsd, LineAmountUsd, SourceClientTag, SourceFileName, SourceRowKey, SourceRowContentHash)
          VALUES (@dateKey, @customerKey, @productKey, @nota, @quantity, @unitPrice, @lineAmount, @tag, @fileName, @rowKey, @contentHash)
        `);
      report.inserted++;
    } else if (existing.recordset[0].SourceRowContentHash !== contentHash) {
      const oldQuantity = Number(existing.recordset[0].QuantityDelivered);
      await pool.request()
        .input('rowKey', sql.VarChar(64), rowKey)
        .input('quantity', sql.Decimal(18, 5), row.quantity)
        .input('unitPrice', sql.Decimal(18, 5), unitPriceUsd)
        .input('lineAmount', sql.Decimal(18, 2), lineAmountUsd)
        .input('contentHash', sql.VarChar(64), contentHash)
        .query(`
          UPDATE fact.Fact_ConsignmentDeliveries
          SET QuantityDelivered = @quantity, UnitPriceUsd = @unitPrice, LineAmountUsd = @lineAmount,
              SourceRowContentHash = @contentHash, LoadedAtUtc = SYSUTCDATETIME()
          WHERE SourceRowKey = @rowKey
        `);
      report.updated.push({ rowKey, oldQuantity, newQuantity: row.quantity });
    }
    // else: unchanged, skip
  }

  return report;
}

export async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: bun run scripts/import-consignment-deliveries.ts <path-to-xlsx> [sourceClientTag]');
  const sourceClientTag = process.argv[3] ?? 'gama';

  const pool = await getDwhPool();
  const report = await importDeliveries(pool, filePath, sourceClientTag);

  // importDeliveries throws before returning if any row was unmapped/
  // unresolved or if duplicate identity rows were found -- see PASS 1/PASS 2
  // above -- so a normal return here means every row resolved and wrote
  // cleanly. unmappedStores/unmappedProducts/unresolvedCustomerCodes are
  // therefore always empty at this point; nothing to print for them.
  console.log(`✓ Inserted: ${report.inserted}`);
  console.log(`✓ Updated: ${report.updated.length}`);
  for (const u of report.updated) console.log(`  - ${u.rowKey}: ${u.oldQuantity} → ${u.newQuantity}`);
  if (report.pricesNotFound.length > 0) console.log(`⚠ No price found for ${report.pricesNotFound.length} (productKey, dateKey) pair(s)`);
}

if (import.meta.main) {
  main()
    .then(() => { console.log('✓ Consignment delivery import completed'); process.exit(0); })
    .catch(error => { console.error('✗ Error running the consignment delivery import:', error); process.exit(1); });
}
