import type { ColumnDef } from './reports/registry';

function escapeField(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a UTF-8 BOM + RFC 4180 CSV string.
 * The BOM (﻿) makes Excel on Spanish Windows auto-detect UTF-8
 * without requiring the Text Import Wizard.
 */
export function buildCsv(
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
): string {
  const BOM    = '﻿';
  const header = columns.map(c => escapeField(c.label)).join(',');
  const body   = rows.map(row =>
    columns.map(c => escapeField(row[c.key])).join(',')
  );
  return BOM + [header, ...body].join('\r\n');
}
