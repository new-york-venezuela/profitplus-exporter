export interface ComprasRawRow {
  nro_doc: string;
  fecha_emis: string; // ISO string or Date
  r: string;
  prov_des: string;
  tipo_prov: string;
  num_comprobante: string;
  nro_orig: string;
  n_control: string;
  anulado: number; // 0 or 1
  co_tipo_doc: string; // 'FACT', 'N/DB', 'N/CR', etc.
  doc_orig: string;
  doc_afec: string;
  total_neto: number;
  compras_exentas: number;
  base_imp: number;
  tasa: number;
  monto_imp: number;
  monto_ret_imp: number;
}

export interface ComprasExportRow {
  nro: number;
  fecha: string;
  rif: string;
  nombre_proveedor: string;
  tipo_proveedor: string;
  nro_comprobante: string;
  nro_factura: string;
  nro_control: string;
  tipo_transaccion: string;
  nro_nota_debito: string;
  nro_nota_credito: string;
  nro_factura_afectada: string;
  total_compras_incluye_iva: number;
  compras_sin_derecho_credito: number;
  base_imponible: number;
  alicuota: number;
  impuesto_iva: number;
  iva_retenido: number;
}

export function mapComprasData(
  mainRows: ComprasRawRow[]
): ComprasExportRow[] {
  return mainRows
    .filter(row => row.total_neto !== 0) // Filter out zero-total rows
    .map((row, index) => {
      // Determine tipo_transaccion: 0 -> '01-reg', 1 -> '03-anu'
      const tipo_transaccion = row.anulado === 1 ? '03-anu' : '01-reg';

      // Determine nro_factura, nro_nota_debito, nro_nota_credito based on co_tipo_doc
      let nro_factura = '';
      let nro_nota_debito = '';
      let nro_nota_credito = '';
      let nro_factura_afectada = '';

      if (row.co_tipo_doc === 'FACT') {
        nro_factura = row.nro_orig;
        nro_factura_afectada = row.doc_afec || '';
      } else if (row.co_tipo_doc === 'N/DB') {
        nro_nota_debito = row.doc_orig;
        nro_factura_afectada = row.doc_afec || '';
      } else if (row.co_tipo_doc === 'N/CR') {
        nro_nota_credito = row.doc_orig;
        nro_factura_afectada = row.doc_afec || '';
      }

      // Format fecha_emis as YYYY-MM-DD
      const fecha = new Date(row.fecha_emis);
      const fecha_formatted = fecha.toISOString().split('T')[0];

      return {
        nro: index + 1,
        fecha: fecha_formatted,
        rif: row.r,
        nombre_proveedor: row.prov_des,
        tipo_proveedor: row.tipo_prov,
        nro_comprobante: row.num_comprobante,
        nro_factura,
        nro_control: row.n_control,
        tipo_transaccion,
        nro_nota_debito,
        nro_nota_credito,
        nro_factura_afectada,
        total_compras_incluye_iva: row.total_neto,
        compras_sin_derecho_credito: row.compras_exentas,
        base_imponible: row.base_imp,
        alicuota: row.tasa,
        impuesto_iva: row.monto_imp,
        iva_retenido: row.monto_ret_imp,
      };
    });
}
