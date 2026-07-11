import type { ReportConfig } from './registry';

export const COMPRAS_CONFIG: ReportConfig = {
  id:         'compras',
  label:      'Libro de Compras',
  queryType:  'view',
  sourceName: 'v_custom_purchases_book', // TODO: replace with actual view name
  dateColumn: 'fecha',                    // TODO: replace with actual date column alias
  columns: [
    // TODO: populate once ERP view schema is available.
  ],
};
