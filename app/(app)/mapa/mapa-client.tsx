'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MapPayload } from '@/lib/geo/types';
import { parseFilters, serializeFilters, normalizeFilters, applyFilters, type MapFilters } from '@/lib/geo/filters';
import CustomerMap from './components/customer-map';
import { FilterPanel } from './components/filter-panel';
import { CustomerTable } from './components/customer-table';
import { UnlocatedList } from './components/unlocated-list';

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

  const visible = useMemo(() => (payload ? applyFilters(payload.customers, filters) : []), [payload, filters]);

  const [view, setView] = useState<'map' | 'table'>('map');
  const [rightTab, setRightTab] = useState<'unlocated'>('unlocated');
  const sellers = payload?.sellers ?? [];
  const routes = payload?.routes ?? [];
  const unlocated = useMemo(() => (payload ? payload.customers.filter(c => c.lat === null) : []), [payload]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="max-h-[40vh] w-full shrink-0 overflow-auto border-b border-gray-200 bg-white md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <FilterPanel
          filters={filters}
          sellers={sellers}
          routes={routes}
          onChange={setFilters}
          onFit={() => setFitKey(k => k + 1)}
          counts={{ shown: visible.length, total: payload?.customers.length ?? 0 }}
        />
      </aside>

      <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col">
        {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2" role="group" aria-label="Vista">
          {(['map', 'table'] as const).map(v => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-md px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${view === v ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {v === 'map' ? 'Mapa' : 'Tabla'}
            </button>
          ))}
          {loading && <span role="status" className="ml-auto text-sm text-gray-500">Cargando…</span>}
        </div>
        <div className="relative min-h-0 flex-1">
          {view === 'map' ? (
            <CustomerMap
              customers={visible}
              routes={routes}
              selectedCoCli={selected}
              onSelect={setSelected}
              onEditLocation={() => {}}
              fitKey={fitKey}
              editing={null}
              onPlace={() => {}}
            />
          ) : (
            <CustomerTable customers={visible} onSelect={c => { setSelected(c); setView('map'); }} />
          )}
        </div>
      </div>

      <aside className="max-h-[40vh] w-full shrink-0 overflow-auto border-t border-gray-200 bg-white md:max-h-none md:w-72 md:border-l md:border-t-0">
        <div role="tablist" aria-label="Paneles" className="flex border-b border-gray-200">
          <button role="tab" aria-selected={rightTab === 'unlocated'} className="min-h-11 flex-1 px-3 text-sm font-medium text-blue-700">
            Sin ubicación ({unlocated.length})
          </button>
        </div>
        <UnlocatedList customers={unlocated} onLocate={() => {}} />
      </aside>
    </div>
  );
}
