import {formatDate} from "@/lib/dates";

function trimString(value: unknown): string {
  return String(value ?? '').trim();
}

export function mapVentasRows(
  ventasRows: Record<string, unknown>[],
): Record<string, unknown>[] {
  let itemCounter = 0;
  return ventasRows.map(venta => {
    itemCounter++;

    const coTipoDoc = trimString(venta.co_tipo_doc);
    let numeroFactura = '';
    let nroFacturaAfectada = '';
    let nroNotaCredito = '';
    let nroNotaDebito = '';

    if (coTipoDoc === 'FACT') {
      numeroFactura = trimString(venta.nro_orig);
      // FACT with num_comprobante is a retention record (shows affected invoice)
      nroFacturaAfectada = trimString(venta.doc_afec);
    } else if (coTipoDoc === 'N/CR') {
      nroNotaCredito = trimString(venta.nro_orig);
      nroFacturaAfectada = trimString(venta.doc_afec);
    } else if (coTipoDoc === 'N/DB') {
      nroNotaDebito = trimString(venta.nro_orig);
      nroFacturaAfectada = trimString(venta.doc_afec);
    }

    const anulado = venta.anulado ? 1 : 0;
    const tipoTransaccion = anulado === 1 ? '03-anu' : '01-reg';

    return {
      item: itemCounter,
      fecha_emis: formatDate(venta.fecha_emis),
      r: trimString(venta.r),
      cli_des: trimString(venta.cli_des),
      numero_factura: numeroFactura,
      n_control: trimString(venta.n_control),
      tipo_transaccion: tipoTransaccion,
      ventas_exentas: venta.ventas_exentas ?? 0,
      base_imp: venta.base_imp ?? 0,
      tasa: venta.tasa ? Math.round(Number(venta.tasa)) : 0,
      monto_imp: venta.monto_imp ?? 0,
      total_neto: venta.total_neto ?? 0,
      monto_ret_imp: venta.monto_ret_imp ?? 0,
      monto_igtf: venta.monto_igtf ?? 0,
      num_comprobante_retencion: trimString(venta.num_comprobante),
      nro_factura_afectada: nroFacturaAfectada,
      nro_nota_credito: nroNotaCredito,
      nro_nota_debito: nroNotaDebito,
    };
  });
}
