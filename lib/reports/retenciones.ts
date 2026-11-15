import type { ReportConfig, ColumnDef } from './registry';
import type { QueryReport } from './query-reports';
import { fetchRetenciones } from './queries/retenciones-query';
import { mapRetencionesRows } from './retenciones-mapper';

const cols: [string, string, ColumnDef['type']][] = [
  ['vendedor', 'Vendedor', 'text'],
  ['tipo_cliente', 'Tipo de cliente', 'text'],
  ['cli_des', 'Cliente', 'text'],
  ['tipo_doc', 'Tipo de documento', 'text'],
  ['nro_doc', 'Nº documento', 'text'],
  ['fec_emis', 'Fecha de emisión', 'date'],
  ['iva_total', 'IVA total', 'number'],
  ['retencion_75', '75 % del IVA (retención por conciliar)', 'number'],
  ['saldo', 'Saldo pendiente', 'number'],
];

export const RETENCIONES_CONFIG: ReportConfig = {
  id: 'retenciones',
  label: 'Comprobantes de Retenciones',
  queryType: 'query',
  snapshot: true,
  columns: cols.map(([key, label, type], i) => ({
    key, label, type, defaultVisible: true, defaultOrder: i,
  })),
};

export const RETENCIONES_REPORT: QueryReport = {
  fetch: fetchRetenciones,
  map: mapRetencionesRows,
};
