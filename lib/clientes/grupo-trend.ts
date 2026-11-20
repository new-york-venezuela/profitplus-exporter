// Sales per bucket stacked by customer grupo (the customer's CURRENT Dim_Segment): the "Ver por Grupo" view.
// Top groups by total Bs keep their own series; the rest collapse into "Otras" (always last), like Productos.
export const OTRAS_CODE = '__otras';
const DEFAULT_MAX_SERIES = 10;

export interface GrupoTrendRecord {
  bucketKey: string;
  groupCode: string | null;
  groupName: string | null;
  bs: number;
  usd: number | null;
}

export interface GrupoTrendSeries { code: string; name: string }
export interface GrupoTrendRow { bucketKey: string; sales: Record<string, { bs: number; usd: number | null }> }
export interface GrupoTrend { series: GrupoTrendSeries[]; rows: GrupoTrendRow[] }

export function buildGrupoTrend(records: readonly GrupoTrendRecord[], maxSeries: number = DEFAULT_MAX_SERIES): GrupoTrend {
  const totals = new Map<string, { name: string; bs: number }>();
  for (const r of records) {
    const code = r.groupCode ?? '';
    const prev = totals.get(code);
    totals.set(code, { name: prev?.name ?? r.groupName ?? 'Sin grupo', bs: (prev?.bs ?? 0) + r.bs });
  }
  const ranked = [...totals].sort((a, b) => b[1].bs - a[1].bs);
  const kept = ranked.slice(0, maxSeries);
  const keptCodes = new Set(kept.map(([code]) => code));
  const series: GrupoTrendSeries[] = kept.map(([code, v]) => ({ code, name: code === '' ? 'Sin grupo' : v.name }));
  const hasOtras = ranked.length > kept.length;
  if (hasOtras) series.push({ code: OTRAS_CODE, name: 'Otras' });

  const buckets = [...new Set(records.map(r => r.bucketKey))].sort();
  const rows: GrupoTrendRow[] = buckets.map(bucketKey => {
    const sales: GrupoTrendRow['sales'] = Object.fromEntries(series.map(s => [s.code, { bs: 0, usd: 0 as number | null }]));
    for (const r of records.filter(x => x.bucketKey === bucketKey)) {
      const code = keptCodes.has(r.groupCode ?? '') ? (r.groupCode ?? '') : OTRAS_CODE;
      const cur = sales[code];
      sales[code] = { bs: cur.bs + r.bs, usd: cur.usd === null || r.usd === null ? null : cur.usd + r.usd };
    }
    return { bucketKey, sales };
  });
  return { series, rows };
}

// Response of GET /api/dwh/clientes?section=trendGrupo.
export interface ClientesTrendGrupoResponse {
  granularity: 'day' | 'week' | 'month';
  trendMode: 'day' | 'week' | 'month' | 'range';
  series: GrupoTrendSeries[];
  rows: (GrupoTrendRow & { label: string })[];
}
