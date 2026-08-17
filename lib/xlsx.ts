import * as XLSX from 'xlsx';
import type { ColumnDef } from './reports/registry';

export function buildXlsx(
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
): Buffer {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();

  // Build data: header + rows with typed cells
  const data: unknown[][] = [
    // Header row
    columns.map(c => c.label),
    // Data rows with cell typing
    ...rows.map(row =>
      columns.map(col => {
        const value = row[col.key];

        // Handle null/undefined as empty string
        if (value == null) {
          return '';
        }

        // Preserve numbers only if column is marked as numeric type
        // (avoids losing leading zeros / going scientific on identifiers)
        if (typeof value === 'number' && col.type === 'number') {
          return value;
        }

        // Preserve booleans
        if (typeof value === 'boolean') {
          return value;
        }

        // Preserve dates (will be formatted by Excel based on locale)
        if (value instanceof Date) {
          return value;
        }

        // Everything else (default text, including numeric-looking strings): convert to string
        return String(value);
      }),
    ),
  ];

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for readability
  const colWidths = columns.map(() => 18);
  worksheet['!cols'] = colWidths.map(width => ({ wch: width }));

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}
