import type { ReportConfig } from './registry';

export const COMPRAS_CONFIG: ReportConfig = {
  id: 'compras',
  label: 'Libro de Compras',
  queryType: 'procedure',
  sourceName: 'dbo.RepLibroCompra',
  columns: [
    { key: 'nro', label: 'Nº', defaultVisible: true, defaultOrder: 0, alwaysVisible: true },
    { key: 'fecha', label: 'FECHA', defaultVisible: true, defaultOrder: 1, alwaysVisible: true },
    { key: 'rif', label: 'RIF', defaultVisible: true, defaultOrder: 2 },
    { key: 'nombre_proveedor', label: 'NOMBRE PROVEEDOR', defaultVisible: true, defaultOrder: 3 },
    { key: 'tipo_proveedor', label: 'TIPO PROVEEDOR', defaultVisible: true, defaultOrder: 4 },
    { key: 'nro_comprobante', label: 'Nº DE COMPROBANTE', defaultVisible: true, defaultOrder: 5 },
    { key: 'nro_factura', label: 'Nº DE FACTURA', defaultVisible: true, defaultOrder: 6 },
    { key: 'nro_control', label: 'Nº DE CONTROL', defaultVisible: true, defaultOrder: 7 },
    { key: 'tipo_transaccion', label: 'TIPO DE TRANSACCION', defaultVisible: true, defaultOrder: 8 },
    { key: 'nro_nota_debito', label: 'Nº NOTA DE DEBITO', defaultVisible: true, defaultOrder: 9 },
    { key: 'nro_nota_credito', label: 'Nº NOTA DE CREDITO', defaultVisible: true, defaultOrder: 10 },
    { key: 'nro_factura_afectada', label: 'Nº FACTURA AFECTADA', defaultVisible: false, defaultOrder: 11 },
    { key: 'total_compras_incluye_iva', label: 'TOTAL COMPRAS INCLUYE IVA', defaultVisible: true, defaultOrder: 12 },
    { key: 'compras_sin_derecho_credito', label: 'COMPRAS SIN DERECHO A CREDITO IVA', defaultVisible: true, defaultOrder: 13 },
    { key: 'base_imponible', label: 'BASE IMPONIBLE', defaultVisible: true, defaultOrder: 14 },
    { key: 'alicuota', label: '% ALICUOTA', defaultVisible: true, defaultOrder: 15 },
    { key: 'impuesto_iva', label: 'IMPUESTO IVA', defaultVisible: true, defaultOrder: 16 },
    { key: 'iva_retenido', label: 'IVA RETENIDO', defaultVisible: true, defaultOrder: 17 },
  ],
};
