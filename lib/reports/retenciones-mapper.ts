import { formatDate } from '@/lib/dates';

export function mapRetencionesRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(r => {
    const iva = r.monto_imp == null ? null : Number(r.monto_imp);
    const tipo = typeof r.tipo_cliente === 'string' ? r.tipo_cliente.trim() : '';
    return {
      vendedor: r.vendedor ?? '',
      tipo_cliente: tipo === '' ? 'Sin asignar' : tipo,
      cli_des: r.cli_des,
      tipo_doc: r.co_tipo_doc,
      nro_doc: r.nro_doc,
      fec_emis: r.fec_emis == null ? '' : formatDate(r.fec_emis),
      iva_total: iva,
      retencion_75: iva == null ? null : Math.round(iva * 0.75 * 100) / 100,
      saldo: r.saldo == null ? null : Number(r.saldo),
    };
  });
}
