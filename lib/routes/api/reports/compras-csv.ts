import type { ComprasRawRow, ComprasExportRow } from '@/lib/reports/mappers/compras-mapper';
import { mapComprasData } from '@/lib/reports/mappers/compras-mapper';
import { generateComprasCsv } from '@/lib/reports/csv/compras-csv-generator';

export function needsCustomMapping(reportId: string): boolean {
  return reportId === 'compras';
}

export function mapComprasRows(rows: Record<string, unknown>[]): ComprasExportRow[] {
  const typedRows = rows as unknown as ComprasRawRow[];
  return mapComprasData(typedRows);
}

export function buildComprasCsv(cols: Array<{ key: string }>, rows: ComprasExportRow[]): string {
  return generateComprasCsv(rows);
}
