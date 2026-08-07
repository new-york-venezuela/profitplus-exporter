export function trimStrings(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const cleanedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      cleanedRow[key] = typeof value === 'string' ? value.trim() : value;
    }
    return cleanedRow;
  });
}
