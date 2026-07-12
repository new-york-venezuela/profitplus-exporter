import type { ReportConfig } from './registry';

export const VENTAS_CONFIG: ReportConfig = {
  id:         'ventas',
  label:      'Libro de Ventas',
  queryType:  'view',
  sourceName: 'v_custom_sales_book',   // TODO: replace with actual view name
  dateColumn: 'fecha',                  // TODO: replace with actual date column alias
  columns: [
    // TODO: populate once ERP view schema is available.
    // Example entry:
    { key: 'fecha',       label: 'Fecha',        defaultVisible: true,  defaultOrder: 0, alwaysVisible: true },
    { key: 'ruc',         label: 'RUC',           defaultVisible: true,  defaultOrder: 1 },
    { key: 'razon_social',label: 'Razón Social',  defaultVisible: true,  defaultOrder: 2 },
    { key: 'monto_total', label: 'Monto Total',   defaultVisible: true,  defaultOrder: 3 },
  ],
};
