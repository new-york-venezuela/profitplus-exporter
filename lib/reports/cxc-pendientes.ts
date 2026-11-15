import type { ReportConfig, ColumnDef } from './registry';
import type { QueryReport } from './query-reports';
import { fetchCxcPendientes } from './queries/cxc-pendientes-query';
import { mapCxcPendientesRows } from './cxc-pendientes-mapper';

const cols: [string, string, ColumnDef['type']][] = [
  ['vendedor', 'Vendedor', 'text'],
  ['tipo_cliente', 'Tipo de cliente', 'text'],
  ['cli_des', 'Cliente', 'text'],
  ['nro_factura', 'Nº factura', 'text'],
  ['fec_emis', 'Fecha de emisión', 'date'],
  ['fec_venc', 'Fecha de vencimiento', 'date'],
  ['dias_credito', 'Días de crédito', 'number'],
  ['base_imp', 'Base imponible', 'number'],
  ['exento', 'Monto exento', 'number'],
  ['iva', 'IVA', 'number'],
];

export const CXC_PENDIENTES_CONFIG: ReportConfig = {
  id: 'cxc-pendientes',
  label: 'Facturas pendientes por cobrar',
  queryType: 'query',
  snapshot: true,
  columns: cols.map(([key, label, type], i) => ({
    key, label, type, defaultVisible: true, defaultOrder: i,
  })),
};

export const CXC_PENDIENTES_REPORT: QueryReport = {
  fetch: fetchCxcPendientes,
  map: mapCxcPendientesRows,
};
