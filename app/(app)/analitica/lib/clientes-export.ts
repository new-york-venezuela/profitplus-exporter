import { buildCsv } from '@/lib/csv';

export type CsvRecord = Record<string, string | number | null>;

// Client-side CSV download (UTF-8 BOM from buildCsv, so Excel opens it directly). Columns are the keys of the
// first record; null cells are written empty.
export function downloadCsv(filename: string, records: CsvRecord[]): void {
  const keys = records.length > 0 ? Object.keys(records[0]) : [];
  const csv = buildCsv(keys.map((key, i) => ({ key, label: key, defaultVisible: true, defaultOrder: i })), records);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
