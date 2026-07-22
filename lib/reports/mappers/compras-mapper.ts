import {formatDate} from "@/lib/dates";

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
  mainRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return mainRows
    .filter(row => row.total_neto !== 0) // Filter out zero-total rows
    .map((row, index) => {
      // Determine tipo_transaccion: 0 -> '01-reg', 1 -> '03-anu'
      const tipo_transaccion = row.anulado === 1 ? '03-anu' : '01-reg';

      // Determine nro_factura, nro_nota_debito, nro_nota_credito based on co_tipo_doc
      let nro_factura = '';
      let nro_nota_debito = '';
      let nro_nota_credito = '';
      let nro_factura_afectada = String(row.doc_afec ?? '');

      if (row.co_tipo_doc === 'FACT') {
        nro_factura = String(row.nro_fact ?? '');
      } else if (row.co_tipo_doc === 'N/DB') {
        nro_nota_debito = String(row.nro_fact ?? '');
      } else if (row.co_tipo_doc === 'N/CR') {
        nro_nota_credito = String(row.nro_fact ?? '');
      }

      // Format fecha_emis as YYYY-MM-DD
      const fecha = formatDate(row.fecha_emis);

      return {
        nro: index + 1,
        fecha: fecha,
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
