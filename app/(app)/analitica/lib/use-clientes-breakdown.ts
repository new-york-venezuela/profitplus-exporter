'use client';

import { useEffect, useState } from 'react';
import type { ProductoClientesResponse } from '../types';

export type ClientesBreakdownState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: ProductoClientesResponse };

// Successful responses by URL, so re-expanding a row (or remounting after a sort) is instant.
// Errors are never cached. The URL carries every filter, so a stale entry cannot be served for other filters.
// Entries older than CLIENTES_CACHE_TTL_MS are treated as missing.
export const CLIENTES_CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { data: ProductoClientesResponse; at: number }>();
let now: () => number = Date.now;

// Test seam: inject the clock (pass nothing to restore Date.now).
export function setClientesBreakdownClock(clock?: () => number): void {
  now = clock ?? Date.now;
}

function fresh(url: string): ProductoClientesResponse | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (now() - entry.at > CLIENTES_CACHE_TTL_MS) { cache.delete(url); return null; }
  return entry.data;
}

export function clearClientesBreakdownCache(): void {
  cache.clear();
}

// Lazy per-row fetch: only a mounted consumer with a non-null URL requests. A null URL is idle.
export function useClientesBreakdown(url: string | null): ClientesBreakdownState {
  const [settled, setSettled] = useState<{ url: string; error: string } | { url: string; data: ProductoClientesResponse } | null>(null);

  useEffect(() => {
    if (url === null || fresh(url) !== null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!controller.signal.aborted) setSettled({ url, error: body.error ?? 'Error desconocido' });
          return;
        }
        const data: ProductoClientesResponse = await res.json();
        if (controller.signal.aborted) return;
        cache.set(url, { data, at: now() });
        setSettled({ url, data });
      } catch {
        if (!controller.signal.aborted) setSettled({ url, error: 'No se pudo conectar con el servidor' });
      }
    })();
    return () => controller.abort();
  }, [url]);

  if (url === null) return { status: 'idle' };
  const cached = cache.get(url);
  if (cached && now() - cached.at <= CLIENTES_CACHE_TTL_MS) return { status: 'ready', data: cached.data };
  if (settled !== null && settled.url === url) {
    return 'error' in settled ? { status: 'error', error: settled.error } : { status: 'ready', data: settled.data };
  }
  return { status: 'loading' };
}
