import { formatDate } from '@/lib/dates';
import { splitTaxBuckets, type LineAgg } from './tax-buckets';

const DAY_MS = 86_400_000;
const utcDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function mapCxcPendientesRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(r => {
    const tipo = typeof r.tipo_cliente === 'string' ? r.tipo_cliente.trim() : '';
    const vendedor = typeof r.vendedor === 'string' ? r.vendedor.trim() : '';
    const emis = r.fec_emis == null ? '' : formatDate(r.fec_emis);
    const venc = r.fec_venc == null ? '' : formatDate(r.fec_venc);
    const dias = emis && venc ? Math.round((utcDay(venc) - utcDay(emis)) / DAY_MS) : null;
    const split = splitTaxBuckets((r.lines as LineAgg[] | undefined) ?? []);
    return {
      vendedor: vendedor === '' ? 'Sin asignar' : vendedor,
      tipo_cliente: tipo === '' ? 'Sin asignar' : tipo,
      cli_des: r.cli_des,
      nro_factura: r.nro_doc,
      fec_emis: emis,
      fec_venc: venc,
      dias_credito: dias,
      base_imp: split ? split.base : null,
      exento: split ? split.exento : null,
      iva: split ? split.iva : null,
    };
  });
}
