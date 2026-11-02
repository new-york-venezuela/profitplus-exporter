import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import {
  SHEET,
  readSheetCsv,
  readWorkbookRows,
} from '../../../lib/pricing/xlsx/workbook';

function book(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }),
      name,
    );
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true });
}

describe('xlsx workbook adapter', () => {
  test('SHEET names', () => {
    expect(SHEET.descuentos).toBe('Descuentos por cliente');
  });

  test('numbers render without float noise', () => {
    const buf = book({ Precios: [['n'], [11.900000000000002], [12.4], [3]] });
    const { csv, errors } = readSheetCsv(buf, 'Precios', ['n']);
    expect(errors).toEqual([]);
    expect(csv).toBe('n\n11.9\n12.4\n3');
  });

  test('date cells become ISO', () => {
    const buf = book({
      Precios: [['d'], [new Date(Date.UTC(2026, 10, 9))], ['2026-11-09']],
    });
    const { csv } = readSheetCsv(buf, 'Precios', ['d']);
    expect(csv).toBe('d\n2026-11-09\n2026-11-09');
  });

  test('keeps only requested columns in order, drops blank rows', () => {
    const buf = book({
      Precios: [
        ['a', 'b', 'c'],
        ['1', 'x,y', 'z'],
        ['', '', ''],
        ['2', 'say "hi"', 'w'],
      ],
    });
    const { csv, errors } = readSheetCsv(buf, 'Precios', ['c', 'a', 'b']);
    expect(errors).toEqual([]);
    expect(csv).toBe('c,a,b\nz,1,"x,y"\nw,2,"say ""hi"""');
    const rows = readWorkbookRows(buf, 'Precios');
    expect(rows!.header).toEqual(['a', 'b', 'c']);
    expect(rows!.rows.length).toBe(2);
  });

  test('missing sheet and missing column report Spanish errors', () => {
    const buf = book({ Precios: [['a'], ['1']] });
    expect(readSheetCsv(buf, 'Listas', ['a']).errors).toEqual([
      'Falta la hoja «Listas»',
    ]);
    expect(readSheetCsv(buf, 'Precios', ['co_art']).errors).toEqual([
      'Falta la columna «co_art» en «Precios»',
    ]);
  });
});
