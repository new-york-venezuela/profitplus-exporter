import { parseCsv } from '@/lib/customer-mapping/csv';
import {
  CREDIT_DAYS, CREDIT_SOURCES, CREDIT_TERM_COLUMNS,
  type CreditDays, type CreditSource, type CreditTermRow,
} from './types';

export function parseCreditTermsCsv(text: string): { rows: CreditTermRow[]; errors: string[] } {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map(h => h.trim());
  if (header.join(',') !== CREDIT_TERM_COLUMNS.join(',')) {
    return { rows: [], errors: [`Encabezado inválido; se esperaba: ${CREDIT_TERM_COLUMNS.join(',')}`] };
  }
  const rows: CreditTermRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const [coCli, nombre, dias, source, note] = CREDIT_TERM_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    if (!coCli) { errors.push(`línea ${line}: co_cli vacío`); return; }
    if (seen.has(coCli)) { errors.push(`línea ${line}: co_cli duplicado ${coCli}`); return; }
    seen.add(coCli);
    if (!(CREDIT_SOURCES as readonly string[]).includes(source)) {
      errors.push(`línea ${line}: source inválido "${source}"`); return;
    }
    const noDays = source === 'skip' || source === 'review';
    let diasCred: CreditDays | null = null;
    if (dias) {
      if (source === 'skip') { errors.push(`línea ${line}: una fila skip no lleva dias_cred`); return; }
      if (!(CREDIT_DAYS as readonly number[]).includes(Number(dias))) {
        errors.push(`línea ${line}: dias_cred inválido "${dias}" (7, 15, 21 o 35)`); return;
      }
      diasCred = Number(dias) as CreditDays;
    } else if (!noDays) {
      errors.push(`línea ${line}: dias_cred vacío para source ${source}`); return;
    }
    rows.push({ coCli, nombre, diasCred, source: source as CreditSource, note });
  });
  return { rows, errors };
}
