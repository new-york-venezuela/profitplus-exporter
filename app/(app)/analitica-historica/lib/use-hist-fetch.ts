'use client';

import { useEffect, useState } from 'react';

export interface HistFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// GETs `url` (re-fetching when it changes) and returns the parsed JSON body.
// `url = null` idles without fetching. A non-OK response surfaces its
// `{ error }` message; a stale response for a superseded url is ignored.
export function useHistFetch<T>(url: string | null): HistFetchState<T> {
  const [state, setState] = useState<HistFetchState<T>>({ data: null, loading: url !== null, error: null });

  useEffect(() => {
    if (url === null) return;
    let cancelled = false;
    async function load(target: string) {
      setState(prev => ({ data: prev.data, loading: true, error: null }));
      try {
        const res = await fetch(target);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ data: null, loading: false, error: body.error ?? 'Error desconocido' });
          return;
        }
        const body: T = await res.json();
        if (!cancelled) setState({ data: body, loading: false, error: null });
      } catch {
        if (!cancelled) setState({ data: null, loading: false, error: 'No se pudo conectar con el servidor' });
      }
    }
    load(url);
    return () => { cancelled = true; };
  }, [url]);

  return state;
}
