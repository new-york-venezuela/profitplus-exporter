function escapeCsvField(value: string | number | null | undefined | unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function generateComprasCsv(
  cols: Array<{ key: string; label: string }>,
  rows: Record<string, unknown>[],
): string {
  const lines: string[] = [];

  lines.push(cols.map(c => escapeCsvField(c.label)).join(','));

  rows.forEach(row => {
    const values = cols.map(c => row[c.key]);
    lines.push(values.map(v => escapeCsvField(v)).join(','));
  });

  return lines.join('\n');
}
