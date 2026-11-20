import type { CoberturaRowView, Currency, DualAmount } from '@/app/(app)/analitica/types';

// Q3: customers grouped by their CURRENT grupo (Dim_Segment) or ruta, from the Cobertura rows so the figures
// reconcile with the Cobertura table and the Estados. A breakdown ignores the filter of its own dimension (by
// grupo ignores the grupo filter, by ruta ignores the ruta filter) so it never collapses to a single row.
export type GrupoBy = 'grupo' | 'ruta';

export interface GrupoRow {
  key: string;                    // group code ('' = sin grupo) or route number as text ('' = sin ruta)
  name: string;
  sales: DualAmount;
  salesPrev: DualAmount | null;   // null = no previous equal period
  shareOfTotal: number | null;    // of all rows' sales in the active currency; null when any USD is unknown
  activos: number;                // customers that bought in the period
  activosPrev: number | null;
  nuevos: number;                 // active customers whose origen is nuevo
  patrimonio: number;             // active customers whose origen is patrimonio
  churnRate: number | null;       // share of last period's buyers that did not buy now
}

export interface GrupoScope {
  grupo: string | null;
  ruta: number | null;
  origen: 'todos' | 'patrimonio' | 'nuevo';
}

function sumDual(items: readonly DualAmount[]): DualAmount {
  return {
    bs: items.reduce((s, a) => s + a.bs, 0),
    usd: items.some(a => a.usd === null) ? null : items.reduce((s, a) => s + (a.usd as number), 0),
  };
}

export function buildGrupoRows(
  rows: readonly CoberturaRowView[],
  by: GrupoBy,
  scope: GrupoScope,
  currency: Currency,
  prevAvailable: boolean,
): GrupoRow[] {
  const scoped = rows.filter(r =>
    (by === 'grupo' || scope.grupo === null || r.groupCode === scope.grupo)
    && (by === 'ruta' || scope.ruta === null || r.routeNumber === scope.ruta)
    && (scope.origen === 'todos' || r.kind === scope.origen));

  const groups = new Map<string, CoberturaRowView[]>();
  for (const r of scoped) {
    const key = by === 'grupo' ? (r.groupCode ?? '') : (r.routeNumber === null ? '' : String(r.routeNumber));
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const out = [...groups].map(([key, members]) => {
    const active = members.filter(r => r.activeInPeriod === true);
    const cohort = members.filter(r => r.boughtPrev === true);
    const name = by === 'grupo' ? (members.find(r => r.groupName)?.groupName ?? 'Sin grupo') : (key === '' ? 'Sin ruta' : `Ruta ${key}`);
    return {
      key,
      name: key === '' ? (by === 'grupo' ? 'Sin grupo' : 'Sin ruta') : name,
      sales: sumDual(members.map(r => r.salesPeriod)),
      salesPrev: prevAvailable && members.every(r => r.salesPrev !== null) ? sumDual(members.map(r => r.salesPrev as DualAmount)) : null,
      shareOfTotal: null as number | null,
      activos: active.length,
      activosPrev: prevAvailable ? cohort.length : null,
      nuevos: active.filter(r => r.kind === 'nuevo').length,
      patrimonio: active.filter(r => r.kind === 'patrimonio').length,
      churnRate: prevAvailable && cohort.length > 0 ? cohort.filter(r => r.activeInPeriod !== true).length / cohort.length : null,
    };
  });

  const amounts = out.map(g => (currency === 'usd' ? g.sales.usd : g.sales.bs));
  const known = amounts.every(a => a !== null);
  const total = known ? (amounts as number[]).reduce((s, a) => s + a, 0) : 0;
  if (known && total > 0) out.forEach((g, i) => { g.shareOfTotal = (amounts[i] as number) / total; });

  return out.sort((a, b) => b.sales.bs - a.sales.bs);
}
