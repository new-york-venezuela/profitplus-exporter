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
