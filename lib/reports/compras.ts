import type { ReportConfig } from './registry';

export const COMPRAS_CONFIG: ReportConfig = {
  id:         'compras',
  label:      'Libro de Compras',
  queryType:  'procedure',
  sourceName: 'dbo.sp_GetComprasByDateRange',
  columns: [
    { key: 'id',                    label: 'ID',                    defaultVisible: false, defaultOrder: 0 },
    { key: 'fecha',                 label: 'Fecha',                 defaultVisible: true,  defaultOrder: 1,  alwaysVisible: true },
    { key: 'numero_comprobante',    label: 'Número de Comprobante', defaultVisible: true,  defaultOrder: 2 },
    { key: 'tipo_comprobante',      label: 'Tipo de Comprobante',   defaultVisible: true,  defaultOrder: 3 },
    { key: 'ruc_proveedor',         label: 'RUC del Proveedor',     defaultVisible: true,  defaultOrder: 4 },
    { key: 'nombre_proveedor',      label: 'Nombre del Proveedor',  defaultVisible: true,  defaultOrder: 5 },
    { key: 'monto_total',           label: 'Monto Total',           defaultVisible: true,  defaultOrder: 6 },
    { key: 'monto_impuesto',        label: 'Monto de Impuesto',     defaultVisible: true,  defaultOrder: 7 },
    { key: 'monto_neto',            label: 'Monto Neto',            defaultVisible: true,  defaultOrder: 8 },
    { key: 'descripcion',           label: 'Descripción',           defaultVisible: false, defaultOrder: 9 },
    { key: 'created_at',            label: 'Creado',                defaultVisible: false, defaultOrder: 10 },
  ],
};
