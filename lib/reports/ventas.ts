import type { ReportConfig } from './registry';

export const VENTAS_CONFIG: ReportConfig = {
  id:         'ventas',
  label:      'Libro de Ventas',
  queryType:  'procedure',
  sourceName: 'dbo.sp_GetVentasByDateRange',
  columns: [
    { key: 'fecha',               label: 'Fecha',              defaultVisible: true,  defaultOrder: 0, alwaysVisible: true },
    { key: 'numero_comprobante',  label: 'Número Comprobante', defaultVisible: true,  defaultOrder: 1 },
    { key: 'tipo_comprobante',    label: 'Tipo Comprobante',   defaultVisible: true,  defaultOrder: 2 },
    { key: 'ruc_cliente',         label: 'RUC Cliente',        defaultVisible: true,  defaultOrder: 3 },
    { key: 'nombre_cliente',      label: 'Nombre Cliente',     defaultVisible: true,  defaultOrder: 4 },
    { key: 'monto_neto',          label: 'Monto Neto',         defaultVisible: true,  defaultOrder: 5 },
    { key: 'monto_impuesto',      label: 'Monto Impuesto',     defaultVisible: true,  defaultOrder: 6 },
    { key: 'monto_total',         label: 'Monto Total',        defaultVisible: true,  defaultOrder: 7 },
    { key: 'descripcion',         label: 'Descripción',        defaultVisible: false, defaultOrder: 8 },
    { key: 'id',                  label: 'ID',                 defaultVisible: false, defaultOrder: 9 },
    { key: 'created_at',          label: 'Creado',             defaultVisible: false, defaultOrder: 10 },
  ],
};
