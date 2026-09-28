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
  date: Date;
  notaEntregaNum: string | null;
  productName: string;
  quantity: number;
};

export function parseWorkbook(filePath: string): ParsedRow[] {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const parsed: ParsedRow[] = [];
  for (const raw of rawRows) {
    const storeName = raw['Nombre de Cliente'];
    if (typeof storeName !== 'string' || storeName.trim() === '') continue;
    if (SUMMARY_ROW_STORE_NAMES.has(storeName)) continue;

    const date = raw['Fecha de Despacho'];
    if (!(date instanceof Date)) continue;

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

export async function importDeliveries(
  pool: sql.ConnectionPool, filePath: string, sourceClientTag: string,
): Promise<ImportReport> {
  const parsedRows = parseWorkbook(filePath);
  const productMap = await resolveProductMap(pool, sourceClientTag);

  const unmappedStores = new Set<string>();
  const unmappedProducts = new Set<string>();
  const neededCustomerCodes = new Set<string>();
  for (const row of parsedRows) {
    const customerCode = STORE_MAP[row.storeName];
    if (customerCode === undefined) { unmappedStores.add(row.storeName); continue; }
    neededCustomerCodes.add(customerCode);
    if (!productMap.has(row.productName)) unmappedProducts.add(row.productName);
  }

  const report: ImportReport = {
    inserted: 0, updated: [], unmappedStores: [...unmappedStores], unmappedProducts: [...unmappedProducts], pricesNotFound: [],
  };

  const customerKeyByCode = await resolveCustomerKeys(pool, [...neededCustomerCodes]);
  const priceCache = new Map<string, number | null>();
  const fileName = filePath.split('/').pop() ?? filePath;

  for (const row of parsedRows) {
    const customerCode = STORE_MAP[row.storeName];
    if (customerCode === undefined) continue; // already recorded in unmappedStores
    const productEntry = productMap.get(row.productName);
    if (productEntry === undefined) continue; // already recorded in unmappedProducts
    const customerKey = customerKeyByCode.get(customerCode);
    if (customerKey === undefined) continue; // resolved code but no current Dim_Customer row -- shouldn't happen given Task 1's seed, but fail closed rather than crash

    const dateKey = toDateKey(row.date);
    const priceCacheKey = `${productEntry.productKey}|${dateKey}`;
    if (!priceCache.has(priceCacheKey)) {
      const price = await lookupAsOfPrice(pool, productEntry.productKey, dateKey);
      priceCache.set(priceCacheKey, price);
      if (price === null) report.pricesNotFound.push({ productKey: productEntry.productKey, dateKey });
    }
    const unitPriceUsd = priceCache.get(priceCacheKey) ?? null;
    const lineAmountUsd = unitPriceUsd === null ? null : Number((row.quantity * unitPriceUsd).toFixed(2));

    const rowKey = computeRowKey(sourceClientTag, customerCode, dateKey, row.notaEntregaNum, productEntry.productKey);
    const contentHash = computeContentHash(row.quantity);

    const existing = await pool.request()
      .input('rowKey', sql.VarChar(64), rowKey)
      .query(`SELECT SourceRowContentHash, QuantityDelivered FROM fact.Fact_ConsignmentDeliveries WHERE SourceRowKey = @rowKey`);

    if (existing.recordset.length === 0) {
      await pool.request()
        .input('dateKey', sql.Int, dateKey)
        .input('customerKey', sql.Int, customerKey)
        .input('productKey', sql.Int, productEntry.productKey)
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

  console.log(`✓ Inserted: ${report.inserted}`);
  console.log(`✓ Updated: ${report.updated.length}`);
  for (const u of report.updated) console.log(`  - ${u.rowKey}: ${u.oldQuantity} → ${u.newQuantity}`);
  if (report.unmappedStores.length > 0) console.log(`✗ Unmapped stores: ${report.unmappedStores.join(', ')}`);
  if (report.unmappedProducts.length > 0) console.log(`✗ Unmapped products: ${report.unmappedProducts.join(', ')}`);
  if (report.pricesNotFound.length > 0) console.log(`⚠ No price found for ${report.pricesNotFound.length} (productKey, dateKey) pair(s)`);
}

if (import.meta.main) {
  main()
    .then(() => { console.log('✓ Consignment delivery import completed'); process.exit(0); })
    .catch(error => { console.error('✗ Error running the consignment delivery import:', error); process.exit(1); });
}
