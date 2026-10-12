import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

export interface FxCustomer { code: string; name: string; grupo: string }
export interface FxInvoice { numero: string; fecha: string; code: string; seller: string } // fecha: dd/mm/yyyy
export interface FxTracking { code: string; ruta: number | string | null; frecuencia: string | null }

function save(path: string, sheets: Record<string, unknown[][]>): void {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// Same sheet names and header labels as 2026-bbdd-profit.xlsx (extra columns are present on purpose:
// the reader must ignore Tipo cliente / Nombre Cliente Principal).
export function writeMasterWorkbook(path: string, customers: FxCustomer[], invoices: FxInvoice[]): void {
  save(path, {
    'Maestro Clientes': [
      ['Código', 'Cliente', 'R.I.F.', 'Teléfono', 'Tipo', 'Grupo de Cliente', 'Tipo cliente', 'Nombre Cliente Principal', 'Ruta', 'Nombre Vendedor'],
      ...customers.map(c => [c.code, c.name, null, null, null, c.grupo, 'Independiente', c.name, null, null]),
    ],
    'Ventas Diarias (Profit)': [
      ['Número', 'Reng', 'Fecha', 'Codigo Cliente', 'Codigo Vendedor', 'Tipo Documento'],
      ...invoices.map(i => [i.numero, 1, i.fecha, i.code, i.seller, 'Factura']),
    ],
  });
}

// Same layout as 10-2026-ventas-seguimiento-por-ruta.xlsx: a title row, then the header on the
// second row, customers below, then total rows without a customer code.
export function writeTrackingWorkbook(path: string, rows: FxTracking[]): void {
  save(path, {
    'Ventas Asesor - Categoria': [
      [null, null, null, null, null, null, null, null, null, null, null, 'UNIDADES'],
      [null, 'Codigo Vendedor', 'Vendedor / Despachador', 'Cod Cliente', 'Nombre Cliente', 'Tipo cliente', 'Grupo de clientes',
        'Codigo de Ruta', 'Zona', 'Frecuencia de Visita', 'Dia \nde \nvisita', 'Venta Unidades Sugeridas'],
      ...rows.map(r => [null, null, 'Vendedor X', r.code, `Cliente ${r.code}`, 'Patrimonio', 'Abasto', r.ruta, 'Zona', r.frecuencia, null, 0]),
      [null, null, null, null, 'TOTAL CLIENTES ACTIVOS', null, null, null, null, null],
    ],
  });
}
