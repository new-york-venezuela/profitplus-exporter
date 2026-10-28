import { parseCsv } from '@/lib/customer-mapping/csv';
import { semicolonHint } from '../list-import/csv';

export interface TipoClienteRow { line: number; coCli: string; nombre: string; moneda90d: string; target: string }

/**
 * Reads the file written by `tipo-cliente:export`. Only `co_cli` and `tip_cli_nuevo` are required; other columns are
 * context for whoever fills the file in. A blank `tip_cli_nuevo` means "leave this customer alone".
 */
export function parseTipoClienteCsv(text: string): { rows: TipoClienteRow[]; errors: string[] } {
  const table = parseCsv(text);
  const hint = semicolonHint(table);
  if (hint) return { rows: [], errors: [hint] };
  const header = (table[0] ?? []).map(h => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iCli = col('co_cli');
  const iNew = col('tip_cli_nuevo');
  if (iCli < 0 || iNew < 0) return { rows: [], errors: ['Encabezado inválido: faltan las columnas co_cli y tip_cli_nuevo'] };
  const iName = col('nombre');
  const iMone = col('moneda_90d');

  const rows: TipoClienteRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const coCli = (cells[iCli] ?? '').trim();
    if (!coCli) { errors.push(`línea ${line}: co_cli vacío`); return; }
    if (seen.has(coCli.toUpperCase())) { errors.push(`línea ${line}: co_cli repetido ${coCli}`); return; }
    seen.add(coCli.toUpperCase());
    rows.push({
      line, coCli, nombre: iName >= 0 ? (cells[iName] ?? '').trim() : '',
      moneda90d: iMone >= 0 ? (cells[iMone] ?? '').trim().toUpperCase() : '',
      target: (cells[iNew] ?? '').trim(),
    });
  });
  return { rows, errors };
}
