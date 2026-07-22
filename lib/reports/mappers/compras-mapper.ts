import {formatDate} from "@/lib/dates";

function toExportRow(row: Record<string, unknown>): Record<string, unknown> {
  let nro_factura = '';
  let nro_nota_debito = '';
  let nro_nota_credito = '';

  if (row.co_tipo_doc === 'FACT') {
    nro_factura = String(row.nro_fact ?? '');
  } else if (row.co_tipo_doc === 'N/DB') {
    nro_nota_debito = String(row.nro_fact ?? '');
  } else if (row.co_tipo_doc === 'N/CR') {
    nro_nota_credito = String(row.nro_fact ?? '');
  }

  return {
    nro: 0,
    fecha: formatDate(row.fecha_emis),
    rif: row.r,
    nombre_proveedor: row.prov_des,
    tipo_proveedor: row.tipo_prov,
    nro_comprobante: row.num_comprobante,
    nro_factura,
    nro_control: row.n_control,
    tipo_transaccion: row.anulado === 1 ? '03-anu' : '01-reg',
    nro_nota_debito,
    nro_nota_credito,
    nro_factura_afectada: String(row.doc_afec ?? ''),
    total_compras_incluye_iva: row.total_neto,
    compras_sin_derecho_credito: row.compras_exentas,
    base_imponible: row.base_imp,
    alicuota: row.tasa,
    impuesto_iva: row.monto_imp,
    iva_retenido: row.monto_ret_imp,
  };
}

function documentKey(coProv: unknown, docNumber: unknown): string {
  return `${String(coProv ?? '')}::${String(docNumber ?? '')}`;
}

function matchIvanRows(
  rawRows: Record<string, unknown>[],
  exportRows: Record<string, unknown>[]
): void {
  const documentsByKey = new Map<string, { row: Record<string, unknown> }[]>();

  rawRows.forEach((row, i) => {
    if (row.co_tipo_doc === 'IVAN') return;
    const key = documentKey(row.co_prov, row.nro_fact);
    const bucket = documentsByKey.get(key);
    if (bucket) bucket.push({ row: exportRows[i] });
    else documentsByKey.set(key, [{ row: exportRows[i] }]);
  });

  rawRows.forEach((row) => {
    if (row.co_tipo_doc !== 'IVAN') return;

    const matchedDocuments = documentsByKey.get(documentKey(row.co_prov, row.doc_afec));
    if (!matchedDocuments) return;

    for (const { row: document } of matchedDocuments) {
      document.nro_comprobante = String(row.num_comprobante ?? '');
      document.iva_retenido = Number(row.monto_ret_imp ?? 0);
    }
  });
}

export function mapComprasData(
  mainRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const exportRows = mainRows.map(toExportRow);

  matchIvanRows(mainRows, exportRows);

  return exportRows
    .filter((row, i) => row.total_neto !== 0 && mainRows[i].co_tipo_doc !== 'IVAN')
    .map((row, index) => {
      const { _anulado_por_ivan, ...rest } = row;
      return { ...rest, nro: index + 1 };
    });
}
