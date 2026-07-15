function formatDate(date: unknown): string {
  if (!date) return '';
  const d = new Date(date as string | number);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function mapVentasRows(
  ventasRows: Record<string, unknown>[],
): Record<string, unknown>[] {
  let itemCounter = 0;
  return ventasRows.map(venta => {
    itemCounter++;

    const coTipoDoc = String(venta.co_tipo_doc ?? '').trim();
    let numeroFactura = '';
    let nroFacturaAfectada = '';
    let nroNotaCredito = '';
    let nroNotaDebito = '';

    if (coTipoDoc === 'FACT') {
      numeroFactura = String(venta.nro_orig ?? '');
    } else if (coTipoDoc === 'N/CR') {
      nroNotaCredito = String(venta.nro_orig ?? '');
      nroFacturaAfectada = String(venta.doc_afec ?? '');
    } else if (coTipoDoc === 'N/DB') {
      nroNotaDebito = String(venta.nro_orig ?? '');
      nroFacturaAfectada = String(venta.doc_afec ?? '');
    }

    const anulado = venta.anulado ? 1 : 0;
    const tipoTransaccion = anulado === 1 ? '03-anu' : '01-reg';

    return {
      item: itemCounter,
      fecha_emis: formatDate(venta.fecha_emis),
      r: venta.r,
      cli_des: venta.cli_des,
      numero_factura: numeroFactura,
      n_control: venta.n_control,
      tipo_transaccion: tipoTransaccion,
      ventas_exentas: venta.ventas_exentas ?? 0,
      base_imp: venta.base_imp ?? 0,
      tasa: venta.tasa ? Math.round(Number(venta.tasa)) : 0,
      monto_imp: venta.monto_imp ?? 0,
      total_neto: venta.total_neto ?? 0,
      monto_ret_imp: venta.monto_ret_imp ?? 0,
      monto_igtf: venta.monto_igtf ?? 0,
      num_comprobante_retencion: venta.num_comprobante ?? '',
      nro_factura_afectada: nroFacturaAfectada,
      nro_nota_credito: nroNotaCredito,
      nro_nota_debito: nroNotaDebito,
    };
  });
}
