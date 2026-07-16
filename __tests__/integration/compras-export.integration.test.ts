import { describe, test, expect } from 'bun:test';
import { queryComprasData } from '@/lib/reports/queries/compras-query';
import { mapComprasData } from '@/lib/reports/mappers/compras-mapper';
import { generateComprasCsv } from '@/lib/reports/csv/compras-csv-generator';

describe('Compras Export Integration', () => {
  test('completes full pipeline: query → map → generate CSV', async () => {
    const rows = await queryComprasData('2026-06-01', '2026-06-30', '000001');
    const exportRows = mapComprasData(rows);
    const csv = generateComprasCsv(exportRows);

    expect(csv).toBeTruthy();
    expect(csv).toContain('Nº,FECHA,RIF');
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  test('filters out zero-total rows', async () => {
    const rows = await queryComprasData('2026-06-01', '2026-06-30', '000001');
    const exportRows = mapComprasData(rows);

    exportRows.forEach(row => {
      expect(row.total_compras_incluye_iva).not.toBe(0);
    });
  });
});
