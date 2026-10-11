import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { trimCode } from './codes';
import { parseSaleDate, type InvoiceLine, type MasterRow, type TrackingRow } from './build';

export const TRACKING_SHEET = 'Ventas Asesor - Categoria';

function sheetRows(wb: XLSX.WorkBook, name: string): { header: string[]; data: unknown[][] } {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Hoja '${name}' no encontrada`);
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  return { header: (all[0] ?? []).map(h => trimCode(h)), data: all.slice(1) };
}

function col(header: string[], startsWith: string): number {
  const i = header.findIndex(h => h.toLowerCase().startsWith(startsWith.toLowerCase()));
  if (i < 0) throw new Error(`Columna '${startsWith}' no encontrada (${header.join(' | ')})`);
  return i;
}

export function readWorkbook(path: string): { master: MasterRow[]; lines: InvoiceLine[]; badDates: number } {
  // XLSX.readFile needs a filesystem backend that the ESM build does not set up; read bytes directly.
  const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true });

  const mst = sheetRows(wb, 'Maestro Clientes');
  const [cCod, cCli, cGrp] = [col(mst.header, 'Código'), col(mst.header, 'Cliente'), col(mst.header, 'Grupo de Cliente')];
  const master: MasterRow[] = mst.data
    .filter(r => r.some(v => v != null))
    .map(r => ({ codigo: trimCode(r[cCod]), cliente: trimCode(r[cCli]), grupo: trimCode(r[cGrp]) }));

  const ven = sheetRows(wb, 'Ventas Diarias (Profit)');
  const [vNum, vReng, vFec, vCli, vVen, vTipo] = [
    col(ven.header, 'Número'), col(ven.header, 'Reng'), col(ven.header, 'Fecha'),
    col(ven.header, 'Codigo Cliente'), col(ven.header, 'Codigo Vendedor'), col(ven.header, 'Tipo Documento'),
  ];
  let badDates = 0;
  const lines: InvoiceLine[] = [];
  for (const r of ven.data) {
    if (!trimCode(r[vNum])) continue;
    const fecha = parseSaleDate(r[vFec]);
    if (!fecha) { badDates++; continue; }
    lines.push({
      numero: trimCode(r[vNum]), renglon: Number(r[vReng]) || 0, fecha,
      coCli: trimCode(r[vCli]), coVen: trimCode(r[vVen]), tipoDocumento: trimCode(r[vTipo]),
    });
  }
  return { master, lines, badDates };
}

// 10-2026-ventas-seguimiento-por-ruta.xlsx: the header is NOT on the first row (a title row sits above it),
// so it is located by its 'Cod Cliente' cell. Rows without a customer code (totals, blanks) are skipped.
export function readTrackingWorkbook(path: string): { tracking: TrackingRow[] } {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
  const ws = wb.Sheets[TRACKING_SHEET];
  if (!ws) throw new Error(`Hoja '${TRACKING_SHEET}' no encontrada`);
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  const h = all.findIndex(r => r.some(v => trimCode(v).toLowerCase().startsWith('cod cliente')));
  if (h < 0) throw new Error(`Columna 'Cod Cliente' no encontrada en '${TRACKING_SHEET}'`);
  const header = all[h].map(v => trimCode(v));
  const [cCod, cRuta, cFrec] = [col(header, 'Cod Cliente'), col(header, 'Codigo de Ruta'), col(header, 'Frecuencia')];
  const tracking: TrackingRow[] = [];
  all.slice(h + 1).forEach((r, i) => {
    const codigo = trimCode(r[cCod]);
    if (!codigo) return;
    tracking.push({ codigo, ruta: r[cRuta], frecuencia: r[cFrec], fila: h + i + 2 }); // 1-based Excel row
  });
  return { tracking };
}
