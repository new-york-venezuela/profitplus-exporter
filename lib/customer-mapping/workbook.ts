import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { trimCode } from './codes';
import { parseSaleDate, type InvoiceLine, type MasterRow } from './build';

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
  const [cCod, cCli, cGrp, cTipo, cPrin] = [
    col(mst.header, 'Código'), col(mst.header, 'Cliente'), col(mst.header, 'Grupo de Cliente'),
    col(mst.header, 'Tipo cliente'), col(mst.header, 'Nombre Cliente Principal'),
  ];
  const master: MasterRow[] = mst.data
    .filter(r => r.some(v => v != null))
    .map(r => ({
      codigo: trimCode(r[cCod]), cliente: trimCode(r[cCli]), grupo: trimCode(r[cGrp]),
      tipo: trimCode(r[cTipo]), principal: trimCode(r[cPrin]),
    }));

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
