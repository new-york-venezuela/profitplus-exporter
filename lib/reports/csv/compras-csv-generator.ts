const HEADERS = [
  'Nº',
  'FECHA',
  'RIF',
  'NOMBRE PROVEEDOR',
  'TIPO PROVEEDOR',
  'Nº DE COMPROBANTE',
  'Nº DE FACTURA',
  'Nº DE CONTROL',
  'TIPO DE TRANSACCION',
  'Nº NOTA DE DEBITO',
  'Nº NOTA DE CREDITO',
  'Nº FACTURA AFECTADA',
  'TOTAL COMPRAS INCLUYE IVA',
  'COMPRAS SIN DERECHO A CREDITO IVA',
  'BASE IMPONIBLE',
  '% ALICUOTA',
  'IMPUESTO IVA',
  'IVA RETENIDO',
];

function escapeCsvField(value: string | number | null | undefined | unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function generateComprasCsv(rows: Record<string, unknown>[]): string {
  const lines: string[] = [];

  lines.push(HEADERS.map(h => escapeCsvField(h)).join(','));

  rows.forEach(row => {
    const values = [
      row.nro,
      row.fecha,
      row.rif,
      row.nombre_proveedor,
      row.tipo_proveedor,
      row.nro_comprobante,
      row.nro_factura,
      row.nro_control,
      row.tipo_transaccion,
      row.nro_nota_debito,
      row.nro_nota_credito,
      row.nro_factura_afectada,
      row.total_compras_incluye_iva,
      row.compras_sin_derecho_credito,
      row.base_imponible,
      row.alicuota,
      row.impuesto_iva,
      row.iva_retenido,
    ];
    lines.push(values.map(v => escapeCsvField(v)).join(','));
  });

  return lines.join('\n');
}
