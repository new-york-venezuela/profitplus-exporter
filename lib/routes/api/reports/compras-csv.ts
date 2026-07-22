import { mapComprasData } from '@/lib/reports/mappers/compras-mapper';
import { generateComprasCsv } from '@/lib/reports/csv/compras-csv-generator';

export function needsCustomMapping(reportId: string): boolean {
  return reportId === 'compras';
}

export function mapComprasRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return mapComprasData(rows);
}

export function buildComprasCsv(cols: Array<{ key: string }>, rows: Record<string, unknown>[]): string {
  return generateComprasCsv(rows);
}
