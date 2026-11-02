import * as XLSX from 'xlsx';

export const SHEET = {
  listas: 'Listas',
  precios: 'Precios',
  promociones: 'Promociones',
  descuentos: 'Descuentos por cliente',
  clientes: 'Clientes',
} as const;

export interface WorkbookRows {
  header: string[];
  rows: string[][];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// With cellDates SheetJS yields Dates at UTC midnight of the cell's calendar
// day (the Date's local components shift with the machine timezone, so they are
// never used). Rounding to the nearest UTC day absorbs sub-day float noise.
function dateToIso(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const day = new Date(Math.round(d.getTime() / 864e5) * 864e5);
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
}

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return dateToIso(v);
  if (typeof v === 'number') return String(Math.round(v * 1e5) / 1e5);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v).trim();
}

export function readWorkbookRows(
  buf: Buffer | Uint8Array,
  sheet: string,
): WorkbookRows | null {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[sheet];
  if (!ws) return null;
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: '',
  });
  const table = raw.map(r => r.map(cellToString));
  const header = table[0] ?? [];
  const rows = table.slice(1).filter(r => r.some(c => c !== ''));
  return { header, rows };
}

function csvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function readSheetCsv(
  buf: Buffer | Uint8Array,
  sheet: string,
  keep: string[],
): { csv: string; errors: string[] } {
  const data = readWorkbookRows(buf, sheet);
  if (!data) return { csv: '', errors: [`Falta la hoja «${sheet}»`] };
  const idx = keep.map(k => data.header.indexOf(k));
  const errors = keep
    .filter((_, i) => idx[i] < 0)
    .map(k => `Falta la columna «${k}» en «${sheet}»`);
  if (errors.length) return { csv: '', errors };
  const lines = [keep, ...data.rows.map(r => idx.map(i => r[i] ?? ''))].map(
    r => r.map(csvField).join(','),
  );
  return { csv: lines.join('\n'), errors: [] };
}
