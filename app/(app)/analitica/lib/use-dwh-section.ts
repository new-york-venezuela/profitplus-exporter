'use client';

import { useEffect, useState } from 'react';

// Fetches one DWH section. Previous data stays in `data` while a new URL loads (stale-while-loading), the
// in-flight request is aborted when the URL changes or the component unmounts, and `retry()` refetches. A null
// url means "do not fetch".
export function useDwhSection<T>(url: string | null): { data: T | null; loading: boolean; error: string | null; retry: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (url === null) { setLoading(false); return; }
    const controller = new AbortController();
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!controller.signal.aborted) setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: T = await res.json();
        if (!controller.signal.aborted) setData(body);
      } catch {
        if (!controller.signal.aborted) setError('No se pudo conectar con el servidor');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [url, attempt]);

  return { data, loading, error, retry: () => setAttempt(a => a + 1) };
}
