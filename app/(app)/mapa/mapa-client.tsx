'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MapPayload } from '@/lib/geo/types';
import { parseFilters, serializeFilters, normalizeFilters, applyFilters, type MapFilters } from '@/lib/geo/filters';
import CustomerMap from './components/customer-map';

export default function MapaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);

  // Only the period needs a server round-trip; every other filter is applied in memory.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/mapa/clientes?dateRange=${encodeURIComponent(filters.dateRange)}`)
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? 'Error al cargar el mapa');
        return body as MapPayload;
      })
      .then(p => { if (!cancelled) { setPayload(p); setFitKey(k => k + 1); } })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.dateRange]);

  const setFilters = useCallback((next: MapFilters) => {
    const normalized = normalizeFilters(next, payload?.routes ?? []);
    const qs = serializeFilters(normalized).toString();
    router.replace(qs ? `/mapa?${qs}` : '/mapa', { scroll: false });
  }, [payload, router]);
  void setFilters; // wired into the UI in Task 8

  const visible = useMemo(() => (payload ? applyFilters(payload.customers, filters) : []), [payload, filters]);

  return (
    <div className="flex h-full flex-col">
      {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="relative flex-1 min-h-[50vh]">
        <CustomerMap
          customers={visible}
          routes={payload?.routes ?? []}
          selectedCoCli={selected}
          onSelect={setSelected}
          onEditLocation={() => {}}
          fitKey={fitKey}
          editing={null}
          onPlace={() => {}}
        />
        {loading && <p role="status" className="absolute left-3 top-3 z-[500] rounded bg-white px-3 py-1 text-sm shadow">Cargando…</p>}
      </div>
    </div>
  );
}
