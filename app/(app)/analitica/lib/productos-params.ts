'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type Nivel = 'linea' | 'sublinea' | 'sku';
export type Metric = 'ventas' | 'unidades';

export interface ProductosParams {
  nivel: Nivel;
  metric: Metric;
  tienda: string | null;
  categoria: string | null;
  lineas: string[];
  sublineas: string[];
  grupo: string | null;
  q: string;
}

const NIVELES: Nivel[] = ['linea', 'sublinea', 'sku'];
const METRICS: Metric[] = ['ventas', 'unidades'];

function list(v: string | null): string[] {
  return (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

function scalar(v: string | null): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

export function parseProductosParams(sp: URLSearchParams): ProductosParams {
  const nivel = sp.get('nivel') as Nivel;
  const metric = sp.get('metric') as Metric;
  return {
    nivel: NIVELES.includes(nivel) ? nivel : 'linea',
    metric: METRICS.includes(metric) ? metric : 'ventas',
    tienda: scalar(sp.get('tienda')),
    categoria: scalar(sp.get('categoria')),
    lineas: list(sp.get('lineas')),
    sublineas: list(sp.get('sublineas')),
    grupo: scalar(sp.get('grupo')),
    q: (sp.get('q') ?? '').trim(),
  };
}

export function applyProductosParams(sp: URLSearchParams, patch: Partial<ProductosParams>): URLSearchParams {
  const next = parseProductosParams(sp);
  const merged: ProductosParams = { ...next, ...patch };
  const out = new URLSearchParams(sp.toString());
  for (const k of ['nivel', 'metric', 'tienda', 'categoria', 'lineas', 'sublineas', 'grupo', 'q']) out.delete(k);
  if (merged.nivel !== 'linea') out.set('nivel', merged.nivel);
  if (merged.metric !== 'ventas') out.set('metric', merged.metric);
  if (merged.tienda) out.set('tienda', merged.tienda);
  if (merged.categoria) out.set('categoria', merged.categoria);
  if (merged.lineas.length > 0) out.set('lineas', merged.lineas.join(','));
  if (merged.sublineas.length > 0) out.set('sublineas', merged.sublineas.join(','));
  if (merged.grupo) out.set('grupo', merged.grupo);
  if (merged.q.trim()) out.set('q', merged.q.trim());
  return out;
}

export interface TrendSeriesMeta { linea?: string; sublinea?: string; code?: string }

// What clicking a trend-chart series does to the bar: drill one level down into that item.
// "Otras" and series without the needed metadata do nothing (null).
export function trendClickPatch(nivel: Nivel, meta: TrendSeriesMeta | undefined, label: string): Partial<ProductosParams> | null {
  if (label === 'Otras') return null;
  if (nivel === 'linea') return { lineas: [label], sublineas: [], nivel: 'sublinea' };
  if (nivel === 'sublinea') {
    if (!meta?.linea || !meta.sublinea) return null;
    return { lineas: [meta.linea], sublineas: [meta.sublinea], nivel: 'sku' };
  }
  return meta?.code ? { q: meta.code } : null;
}

export function useProductosParams(): [ProductosParams, (patch: Partial<ProductosParams>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const params = useMemo(() => parseProductosParams(new URLSearchParams(qs)), [qs]);
  const update = useCallback((patch: Partial<ProductosParams>) => {
    const next = applyProductosParams(new URLSearchParams(qs), patch).toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [qs, router, pathname]);
  return [params, update];
}
