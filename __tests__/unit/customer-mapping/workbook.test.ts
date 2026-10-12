import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { readTrackingWorkbook, TRACKING_SHEET } from '../../../lib/customer-mapping/workbook';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'mapping-workbook-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// the sheet utils always widen '!ref' to A1, so the used range is narrowed by hand to mimic workbooks
// whose <dimension> starts below row 1 (sheet_to_json then numbers rows from the range start).
function writeSheet(path: string, aoa: unknown[][], origin: string): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.sheet_add_aoa(XLSX.utils.aoa_to_sheet([]), aoa, { origin });
  const range = XLSX.utils.decode_range(ws['!ref']!);
  range.s = XLSX.utils.decode_cell(origin);
  ws['!ref'] = XLSX.utils.encode_range(range);
  XLSX.utils.book_append_sheet(wb, ws, TRACKING_SHEET);
  writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

describe('readTrackingWorkbook row numbers', () => {
  const aoa = [
    ['Cod Cliente', 'Codigo de Ruta', 'Frecuencia de Visita'],
    ['J-1', 3, 'Semanal'],
    ['J-2', 4, 'Mensual'],
  ];
  test('fila is the 1-based Excel row when the sheet starts at A1', () => {
    const p = join(dir, 'a1.xlsx');
    writeSheet(p, aoa, 'A1');
    expect(readTrackingWorkbook(p).tracking.map(t => [t.codigo, t.fila])).toEqual([['J-1', 2], ['J-2', 3]]);
  });
  test('fila accounts for a used range that does not start at row 1', () => {
    const p = join(dir, 'a4.xlsx');
    writeSheet(p, aoa, 'A4'); // !ref starts at row 4: header on Excel row 4, data on rows 5 and 6
    expect(readTrackingWorkbook(p).tracking.map(t => [t.codigo, t.fila])).toEqual([['J-1', 5], ['J-2', 6]]);
  });
});
