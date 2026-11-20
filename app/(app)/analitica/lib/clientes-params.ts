'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Nivel } from './productos-params';

// URL state of the Clientes tab. Defaults are omitted from the URL and unrelated params (tab, dateRange,
// granularity, ...) are kept. `tienda`, `grupo` and `nivel` use the same keys and values as Productos, so a
// drill-through between the tabs carries the scope.
export type Dim = 'entidad' | 'tienda';
export type Origen = 'todos' | 'patrimonio' | 'nuevo';
export type Ver = 'total' | 'producto' | 'grupo';

export interface ClientesParams {
  dim: Dim;
  grupo: string | null;
  ruta: string | null;
  tienda: string | null;
  origen: Origen;
  ver: Ver;
  nivel: Nivel;
  // Product drill state (same URL keys and meaning as Productos).
  lineas: string[];
  sublineas: string[];
  q: string;
  detalle: boolean;
}

const DIMS: Dim[] = ['entidad', 'tienda'];
const ORIGENES: Origen[] = ['todos', 'patrimonio', 'nuevo'];
const VERS: Ver[] = ['total', 'producto', 'grupo'];
const NIVELES: Nivel[] = ['linea', 'sublinea', 'sku'];
const MANAGED = ['dim', 'grupo', 'ruta', 'tienda', 'origen', 'ver', 'nivel', 'lineas', 'sublineas', 'q', 'detalle'];

function scalar(v: string | null): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

function list(v: string | null): string[] {
  return (v ?? '').split(',').map(x => x.trim()).filter(Boolean);
}

function pick<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function parseClientesParams(sp: URLSearchParams): ClientesParams {
  const ruta = scalar(sp.get('ruta'));
  return {
    dim: pick(sp.get('dim'), DIMS, 'entidad'),
    grupo: scalar(sp.get('grupo')),
    ruta: ruta !== null && /^\d{1,3}$/.test(ruta) ? ruta : null,
    tienda: scalar(sp.get('tienda')),
    origen: pick(sp.get('origen'), ORIGENES, 'todos'),
    ver: pick(sp.get('ver'), VERS, 'total'),
    nivel: pick(sp.get('nivel'), NIVELES, 'linea'),
    lineas: list(sp.get('lineas')),
    sublineas: list(sp.get('sublineas')),
    q: (sp.get('q') ?? '').trim(),
    detalle: sp.get('detalle') === '1',
  };
}

export function applyClientesParams(sp: URLSearchParams, patch: Partial<ClientesParams>): URLSearchParams {
  const merged: ClientesParams = { ...parseClientesParams(sp), ...patch };
  const out = new URLSearchParams(sp.toString());
  for (const k of MANAGED) out.delete(k);
  if (merged.dim !== 'entidad') out.set('dim', merged.dim);
  if (merged.grupo) out.set('grupo', merged.grupo);
  if (merged.ruta) out.set('ruta', merged.ruta);
  if (merged.tienda) out.set('tienda', merged.tienda);
  if (merged.origen !== 'todos') out.set('origen', merged.origen);
  if (merged.ver !== 'total') out.set('ver', merged.ver);
  if (merged.nivel !== 'linea') out.set('nivel', merged.nivel);
  if (merged.lineas.length > 0) out.set('lineas', merged.lineas.join(','));
  if (merged.sublineas.length > 0) out.set('sublineas', merged.sublineas.join(','));
  if (merged.q.trim()) out.set('q', merged.q.trim());
  if (merged.detalle) out.set('detalle', '1');
  return out;
}

export function activeFilterCount(p: ClientesParams): number {
  return [p.grupo, p.ruta, p.tienda].filter(v => v !== null).length + (p.origen !== 'todos' ? 1 : 0);
}

// Year the selected range ends in: the "year Y" of the Patrimonio / Nuevo rule. Rolling ranges end today.
export function referenceYearOf(dateRange: string, today: Date = new Date()): number {
  const custom = /^custom:\d{4}-\d{2}-\d{2}:(\d{4})-\d{2}-\d{2}$/.exec(dateRange);
  if (custom) return Number(custom[1]);
  const month = /^month:(\d{4})-\d{2}$/.exec(dateRange);
  if (month) return Number(month[1]);
  const ytd = /^ytd:(\d{4})$/.exec(dateRange);
  if (ytd) return Number(ytd[1]);
  return today.getUTCFullYear();
}

export function dimToApi(dim: Dim): 'cliente_entidad' | 'cliente_tienda' {
  return dim === 'tienda' ? 'cliente_tienda' : 'cliente_entidad';
}

export function useClientesParams(): [ClientesParams, (patch: Partial<ClientesParams>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const params = useMemo(() => parseClientesParams(new URLSearchParams(qs)), [qs]);
  const update = useCallback((patch: Partial<ClientesParams>) => {
    const next = applyClientesParams(new URLSearchParams(qs), patch).toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [qs, router, pathname]);
  return [params, update];
}
