import * as XLSX from 'xlsx';
import type { ConnectionPool } from 'mssql';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { Promotion } from '@/lib/db/schema';
import { listPriceLists, readAllActiveRates, listArticles, type ArticleRow } from '@/lib/pricing/rates-erp';
import { listPromotions, listItems } from '@/lib/pricing/promotions-repo';
import { fetchCustomerTypeRows } from '@/lib/pricing/xlsx/customer-rows';
import { fetchDwhProducts, partitionByScope, type ScopedArticle } from '@/lib/pricing/xlsx/scope';
import { SHEET } from '@/lib/pricing/xlsx/workbook';

export interface ExportPromotion {
  name: string; coPrecio: string; startsOn: string; endsOn: string; reason: string | null;
  status: 'activa' | 'programada';
  items: { coArt: string; monto: number }[];
}

export interface ExportData {
  lists: { coPrecio: string; desPrecio: string; coMone: string | null }[];
  articles: ScopedArticle[];
  currentPrice: Map<string, number>; // key `${coPrecio}|${coArt}`
  promotions: ExportPromotion[];
  customers: { coCli: string; nombre: string; tipCli: string; desTipo: string; segmento: string; listaActual: string; lista90d: string; moneda90d?: string }[];
}

export const priceKey = (coPrecio: string, coArt: string) => `${coPrecio}|${coArt}`;

/** Overlay promotions not cancelled and not yet over, with their status relative to `today`. */
export function selectPromotions(
  promos: Promotion[],
  itemsOf: (id: number) => { coArt: string; promoMonto: number }[],
  today: string,
): ExportPromotion[] {
  return promos
    .filter(p => p.kind === 'overlay' && p.cancelledAt == null && p.endsOn >= today)
    .map(p => ({
      name: p.name, coPrecio: p.coPrecio, startsOn: p.startsOn, endsOn: p.endsOn, reason: p.reason,
      status: p.startsOn <= today ? ('activa' as const) : ('programada' as const),
      items: itemsOf(p.id).map(i => ({ coArt: i.coArt, monto: i.promoMonto })),
    }));
}

function sheet(rows: unknown[][], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map(wch => ({ wch }));
  return ws;
}

export function buildExportWorkbook(d: ExportData, today: string): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheet(
    [['lista', 'nombre', 'moneda', 'desde', 'nueva'],
      ...d.lists.map(l => [l.coPrecio, l.desPrecio, l.coMone ?? '', today, ''])],
    [10, 30, 10, 12, 10]), SHEET.listas);

  XLSX.utils.book_append_sheet(wb, sheet(
    [['co_art', 'nombre', 'linea', 'categoria', ...d.lists.map(l => `actual ${l.coPrecio}`)],
      ...d.articles.map(a => [a.coArt, a.artDes, a.line, a.category,
        ...d.lists.map(l => d.currentPrice.get(priceKey(l.coPrecio, a.coArt)) ?? '')])],
    [14, 40, 14, 14, ...d.lists.map(() => 14)]), SHEET.precios);

  XLSX.utils.book_append_sheet(wb, sheet(
    [['promocion', 'lista', 'desde', 'hasta', 'motivo', 'co_art', 'precio', 'estado'],
      ...d.promotions.flatMap(p => p.items.map(i =>
        [p.name, p.coPrecio, p.startsOn, p.endsOn, p.reason ?? '', i.coArt, i.monto, p.status]))],
    [24, 10, 12, 12, 24, 14, 12, 12]), SHEET.promociones);

  XLSX.utils.book_append_sheet(wb, sheet(
    [['co_cli', 'co_art', 'precio', 'desde', 'hasta']], [14, 14, 12, 12, 12]), SHEET.descuentos);

  XLSX.utils.book_append_sheet(wb, sheet(
    [['co_cli', 'nombre', 'tip_cli_actual', 'des_tipo_actual', 'segmento', 'lista_actual', 'lista_usada_90d', 'moneda_90d', 'tip_cli_nuevo'],
      ...d.customers.map(c => [c.coCli, c.nombre, c.tipCli, c.desTipo, c.segmento, c.listaActual, c.lista90d, c.moneda90d ?? '', ''])],
    [14, 40, 14, 24, 24, 12, 14, 10, 14]), SHEET.clientes);

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export interface ExportDeps { erp: ConnectionPool; dwh: ConnectionPool; db: AppDb; today: string }

export async function loadExportData(deps: ExportDeps): Promise<ExportData & { unclassified: ArticleRow[] }> {
  const { erp, dwh, db, today } = deps;
  const priceLists = await listPriceLists(erp);
  const lists = priceLists.map(l => ({ coPrecio: l.coPrecio, desPrecio: l.desPrecio, coMone: l.coMone }));

  const [erpArticles, dwhProducts, rates, customerRows] = await Promise.all([
    listArticles(erp, { limit: 5000 }),
    fetchDwhProducts(dwh),
    readAllActiveRates(erp, lists.map(l => l.coPrecio)),
    fetchCustomerTypeRows(erp),
  ]);
  const { inScope, unclassified } = partitionByScope(erpArticles, dwhProducts);

  const currentPrice = new Map<string, number>();
  for (const r of rates) {
    if (r.desde <= today && (r.hasta == null || today <= r.hasta)) currentPrice.set(priceKey(r.coPrecio, r.coArt), r.monto);
  }

  return {
    lists, articles: inScope, currentPrice, unclassified,
    promotions: selectPromotions(listPromotions(db), id => listItems(db, id), today),
    customers: customerRows.map(c => ({
      coCli: c.co_cli, nombre: c.nombre, tipCli: c.tip_cli_actual, desTipo: c.des_tipo_actual ?? '', segmento: c.des_seg ?? c.co_seg ?? '',
      listaActual: c.lista_actual ?? '', lista90d: c.lista_usada_90d ?? '', moneda90d: c.moneda_90d ?? '',
    })),
  };
}
