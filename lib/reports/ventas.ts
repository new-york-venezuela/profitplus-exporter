import type { ReportConfig, ColumnDef } from './registry';

export const VENTAS_CONFIG: ReportConfig = {
  id:         'ventas',
  label:      'Libro de Ventas',
  queryType:  'procedure',
  sourceName: 'dbo.RepLibroVenta',
  selectors: [
    {
      key: 'sucursal',
      label: 'Oficina',
      options: [
        { value: '000001', label: 'Oficina' },
      ],
      defaultValue: '000001',
    },
  ],
  columns: [
    { key: 'item',                        label: 'ITEM',                        defaultVisible: true,  defaultOrder: 0,  alwaysVisible: true },
    { key: 'fecha_emis',                  label: 'FECHA',                       defaultVisible: true,  defaultOrder: 1 },
    { key: 'r',                           label: 'RIF CLIENTE',                 defaultVisible: true,  defaultOrder: 2 },
    { key: 'cli_des',                     label: 'NOMBRE DE CLIENTE',           defaultVisible: true,  defaultOrder: 3 },
    { key: 'numero_factura',              label: 'Nº FACTURA/ND',               defaultVisible: true,  defaultOrder: 4 },
    { key: 'n_control',                   label: 'Nº CONTROL',                  defaultVisible: true,  defaultOrder: 5 },
    { key: 'tipo_transaccion',            label: 'Tipo de Transacción',         defaultVisible: true,  defaultOrder: 6 },
    { key: 'ventas_exentas',              label: 'Exento',                      defaultVisible: true,  defaultOrder: 7 },
    { key: 'base_imp',                    label: 'Base Imponible',              defaultVisible: true,  defaultOrder: 8 },
    { key: 'tasa',                        label: '% Alic.',                     defaultVisible: true,  defaultOrder: 9 },
    { key: 'monto_imp',                   label: 'Impuesto I.V.A.',             defaultVisible: true,  defaultOrder: 10 },
    { key: 'total_neto',                  label: 'Total ventas + IVA',          defaultVisible: true,  defaultOrder: 11 },
    { key: 'monto_ret_imp',               label: 'I.V.A Retenido',              defaultVisible: true,  defaultOrder: 12 },
    { key: 'monto_igtf',                  label: 'I.G.T.F Percibido',           defaultVisible: true,  defaultOrder: 13 },
    { key: 'num_comprobante_retencion',   label: 'Nº comprobante de retención', defaultVisible: true,  defaultOrder: 14 },
    { key: 'nro_factura_afectada',        label: 'Nº Factura Afectada',         defaultVisible: true,  defaultOrder: 15 },
    { key: 'nro_nota_credito',            label: 'Nº Nota Crédito',             defaultVisible: true,  defaultOrder: 16 },
    { key: 'nro_nota_debito',             label: 'Nº Nota Débito',              defaultVisible: true,  defaultOrder: 17 },
  ] as ColumnDef[],
};
