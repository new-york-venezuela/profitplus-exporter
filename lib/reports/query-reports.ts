import type sql from 'mssql';
import { trimStrings } from '@/lib/trim-strings';
import { RETENCIONES_REPORT } from './retenciones';

export interface QueryFilters {
  startDate?: string;
  endDate?: string;
}

export interface QueryReport {
  fetch(pool: sql.ConnectionPool, filters: QueryFilters): Promise<Record<string, unknown>[]>;
  map(rows: Record<string, unknown>[]): Record<string, unknown>[];
}

export const QUERY_REPORTS: Record<string, QueryReport> = {
  retenciones: RETENCIONES_REPORT,
};

export async function runQueryReport(
  reportId: string,
  pool: sql.ConnectionPool,
  filters: QueryFilters,
): Promise<Record<string, unknown>[]> {
  if (!Object.hasOwn(QUERY_REPORTS, reportId)) throw new Error('Reporte no encontrado');
  const report = QUERY_REPORTS[reportId];
  const rows = await report.fetch(pool, filters);
  return report.map(trimStrings(rows));
}
