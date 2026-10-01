'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MapPayload } from '@/lib/geo/types';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { Ring } from '@/lib/geo/geometry';
import { findDiscrepancies } from '@/lib/geo/discrepancies';
import { areaRevenue } from '@/lib/geo/area-match';
import { buildScale } from '@/lib/geo/color-scale';
import { heatPoints } from '@/lib/geo/layers';
import { parseFilters, serializeFilters, normalizeFilters, applyFilters, type MapFilters } from '@/lib/geo/filters';
import CustomerMap from './components/customer-map';
import { FilterPanel } from './components/filter-panel';
import { CustomerTable } from './components/customer-table';
import { UnlocatedList } from './components/unlocated-list';
import { RoutesPanel } from './components/routes-panel';
import { LocationEditor, type EditDraft } from './components/location-editor';
import { LayerToggles, type LayerState } from './components/layer-toggles';
import { AreaPolygons } from './components/area-polygons';
import { HeatLayer } from './components/heat-layer';
import { ChoroplethLegend } from './components/choropleth-legend';
import { MismatchPanel } from './components/mismatch-panel';
import { AreaDrawing } from './components/area-drawing';
import { AreasPanel, type AreaDraft } from './components/areas-panel';

// Strict numeric parse: parseFloat('10.5abc') would silently accept garbage.
function parseCoord(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function MapaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const lastRange = useRef<string | null>(null);

  // Refit when a route filter becomes active. Adjusting state during render (not in the
  // click handler) guarantees the fit runs against the already-filtered point set.
  const [prevRoute, setPrevRoute] = useState<number | null>(filters.route);
  if (prevRoute !== filters.route) {
    setPrevRoute(filters.route);
    if (filters.route !== null) setFitKey(k => k + 1);
  }

  // Only the period needs a server round-trip; every other filter is applied in memory.
  useEffect(() => {
    let cancelled = false;
    // Resetting loading/error when the period changes is part of the fetch lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/mapa/clientes?dateRange=${encodeURIComponent(filters.dateRange)}`)
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? 'Error al cargar el mapa');
        return body as MapPayload;
      })
            .then(p => {
        if (cancelled) return;
        setPayload(p);
        // Re-fits only when the period changed, not on area/route save reloads.
        if (lastRange.current !== filters.dateRange) { lastRange.current = filters.dateRange; setFitKey(k => k + 1); }
      })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.dateRange, reloadKey]);

  const setFilters = useCallback((next: MapFilters) => {
    const normalized = normalizeFilters(next, payload?.routes ?? [], payload?.areas ?? []);
    const qs = serializeFilters(normalized).toString();
    router.replace(qs ? `/mapa?${qs}` : '/mapa', { scroll: false });
  }, [payload, router]);

  const visible = useMemo(() => (payload ? applyFilters(payload.customers, filters) : []), [payload, filters]);

  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null);
  const [tableView, setView] = useState<'map' | 'table'>('map');
  // Drawing needs the map, so an open area draft forces the map view.
  const view = areaDraft ? 'map' : tableView;
  const [rightTab, setRightTab] = useState<'unlocated' | 'routes' | 'areas' | 'mismatch'>('unlocated');
  const sellers = payload?.sellers ?? [];
  const routes = payload?.routes ?? [];
  const areas = useMemo(() => payload?.areas ?? [], [payload]);
  const discrepancies = useMemo(() => findDiscrepancies(payload?.customers ?? [], areas.length > 0), [payload, areas]);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const focusCustomer = useCallback((coCli: string) => {
    const c = payload?.customers.find(x => x.coCli === coCli);
    if (!c || c.lat === null || c.lng === null) return;
    setView('map'); setSelected(coCli);
    setFocus(f => ({ lat: c.lat!, lng: c.lng!, key: (f?.key ?? 0) + 1 }));
  }, [payload]);
  const [layers, setLayers] = useState<LayerState>({ pins: true, areas: true, choropleth: false, density: false });
  const [highlightAreaId, setHighlightAreaId] = useState<number | null>(null);
  const stats = useMemo(() => areaRevenue(visible, areas), [visible, areas]);
  const scale = useMemo(() => (layers.choropleth ? buildScale([...stats.values()].map(s => s.revenueUsd)) : null), [layers.choropleth, stats]);
  const heat = useMemo(() => (layers.density ? heatPoints(visible) : []), [layers.density, visible]);
  const unlocated = useMemo(() => (payload ? payload.customers.filter(c => c.lat === null) : []), [payload]);

  const [draft, setDraft] = useState<EditDraft | null>(null);

  const startDraw = useCallback(() => {
    setDraft(null);                                               // cancel any customer-location edit
    setAreaDraft({ id: null, name: '', color: '#2563eb', sellerCodes: [], ring: null, phase: 'draw', saving: false, error: null });
    setHighlightAreaId(null);
  }, []);

  const editArea = useCallback((a: AreaDto) => {
    setDraft(null);
    setAreaDraft({ id: a.id, name: a.name, color: a.color, sellerCodes: a.sellerCodes, ring: a.ring, phase: 'form', saving: false, error: null });
    setHighlightAreaId(null);
  }, []);

  const onDrawn = useCallback((ring: Ring) => setAreaDraft(d => d && { ...d, ring, phase: 'form' }), []);
  const onShapeEdited = useCallback((ring: Ring) => setAreaDraft(d => d && { ...d, ring }), []);
  const cancelArea = useCallback(() => { setAreaDraft(null); setHighlightAreaId(null); }, []);

  async function saveArea() {
    if (!areaDraft?.ring) return;
    setAreaDraft({ ...areaDraft, saving: true, error: null });
    const body = { name: areaDraft.name, color: areaDraft.color, ring: areaDraft.ring, sellerCodes: areaDraft.sellerCodes };
    let res: Response;
    try {
      res = await fetch(areaDraft.id === null ? '/api/mapa/zonas' : `/api/mapa/zonas/${areaDraft.id}`, {
        method: areaDraft.id === null ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } catch {
      setAreaDraft(d => d && { ...d, saving: false, error: 'Error de red al guardar la zona' });
      return;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setHighlightAreaId(json?.conflictAreaId ?? null);           // overlap: highlight the area we collide with
      setAreaDraft(d => d && { ...d, saving: false, error: json?.error ?? 'Error al guardar la zona' });
      return;
    }
    setAreaDraft(null); setHighlightAreaId(null);
    setReloadKey(k => k + 1);                                     // matches/revenue change when an area changes
  }

  async function deleteAreaById(a: AreaDto): Promise<string | null> {
    let res: Response;
    try {
      res = await fetch(`/api/mapa/zonas/${a.id}`, { method: 'DELETE' });
    } catch {
      return 'Error de red al eliminar la zona';
    }
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? 'Error al eliminar la zona';
    if (filters.area === a.id) setFilters({ ...filters, area: null });
    setAreaDraft(d => (d && d.id === a.id ? null : d));
    setHighlightAreaId(null);
    setReloadKey(k => k + 1);
    return null;
  }


  const startEditing = useCallback((coCli: string) => {
    const c = payload?.customers.find(x => x.coCli === coCli);
    if (!c) return;
    setAreaDraft(null);
    setHighlightAreaId(null);
    setView('map');
    setDraft({
      coCli, lat: c.lat === null ? '' : String(c.lat), lng: c.lng === null ? '' : String(c.lng),
      dirEnt2: c.dirEnt2 ?? c.direc1 ?? '', saving: false, errors: {},
    });
  }, [payload]);

  const place = useCallback((lat: number, lng: number) => {
    setDraft(d => (d ? { ...d, lat: lat.toFixed(6), lng: lng.toFixed(6), errors: { ...d.errors, coordinates: undefined } } : d));
  }, []);

  // Escape cancels an in-progress edit.
  const isEditing = draft !== null;
  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDraft(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditing]);

  const editingCustomer = draft ? payload?.customers.find(c => c.coCli === draft.coCli) ?? null : null;
  const editLat = draft ? parseCoord(draft.lat) : null;
  const editLng = draft ? parseCoord(draft.lng) : null;
  const editingPosition = draft && editLat !== null && editLng !== null
    ? { lat: editLat, lng: editLng } : draft ? { lat: null, lng: null } : null;

  async function saveLocation() {
    if (!draft || !editingCustomer) return;
    const body: Record<string, unknown> = {};
    const lat = parseCoord(draft.lat), lng = parseCoord(draft.lng);
    const hasCoords = draft.lat.trim() !== '' || draft.lng.trim() !== '';
    if (hasCoords) {
      if (lat === null || lng === null) {
        setDraft({ ...draft, errors: { coordinates: 'Latitud y longitud deben ser números válidos' } });
        return;
      }
      body.lat = lat; body.lng = lng;
    }
    const address = draft.dirEnt2.trim();
    if (address && address !== (editingCustomer.dirEnt2 ?? editingCustomer.direc1 ?? '')) body.dirEnt2 = address;
    if (Object.keys(body).length === 0) { setDraft({ ...draft, errors: { form: 'No hay cambios para guardar' } }); return; }

    setDraft({ ...draft, saving: true, errors: {} });
    let res: Response;
    try {
      res = await fetch(`/api/mapa/clientes/${encodeURIComponent(draft.coCli)}/ubicacion`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } catch {
      setDraft(d => d && ({ ...d, saving: false, errors: { form: 'Error de red al guardar' } }));
      return;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.error ?? 'Error al guardar';
      setDraft(d => d && ({
        ...d, saving: false,
        errors: json?.field === 'coordinates' ? { coordinates: message } : json?.field === 'dirEnt2' ? { dirEnt2: message } : { form: message },
      }));
      return;
    }
    setPayload(p => p && ({
      ...p,
      customers: p.customers.map(c => c.coCli !== draft.coCli ? c : {
        ...c,
        ...(json.coordinates ? { lat: json.coordinates.lat, lng: json.coordinates.lng, coordinatesIssue: null } : {}),
        ...(json.dirEnt2 ? { dirEnt2: json.dirEnt2 } : {}),
      }),
    }));
    setDraft(null);
    setReloadKey(k => k + 1);                                     // area match / mismatch depend on the new location
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="max-h-[40vh] w-full shrink-0 overflow-auto border-b border-gray-200 bg-white md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <FilterPanel
          filters={filters}
          sellers={sellers}
          routes={routes}
          areas={areas}
          onChange={setFilters}
          onFit={() => setFitKey(k => k + 1)}
          counts={{ shown: visible.length, total: payload?.customers.length ?? 0 }}
        />
        <LayerToggles layers={layers} onChange={setLayers} />
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
              onEditLocation={startEditing}
              fitKey={fitKey}
              editing={editingPosition}
              onPlace={place}
              showPins={layers.pins}
              focus={focus}
            >
              {(layers.areas || layers.choropleth) && <AreaPolygons areas={areas} stats={stats} scale={scale} highlightId={highlightAreaId} />}
              {layers.density && <HeatLayer points={heat} />}
              <AreaDrawing
                mode={areaDraft?.phase === 'draw' ? 'draw' : areaDraft?.phase === 'shape' ? 'edit' : 'idle'}
                editRing={areaDraft?.ring ?? null}
                onDrawn={onDrawn}
                onEdited={onShapeEdited}
                onCancel={cancelArea}
              />
            </CustomerMap>
          ) : (
            <CustomerTable customers={visible} onSelect={c => { setSelected(c); setView('map'); }} />
          )}
          {view === 'map' && scale && <ChoroplethLegend scale={scale} />}
        </div>
      </div>

      <aside className="max-h-[40vh] w-full shrink-0 overflow-auto border-t border-gray-200 bg-white md:max-h-none md:w-72 md:border-l md:border-t-0">
        {draft && editingCustomer && (
          <LocationEditor
            customer={editingCustomer}
            draft={draft}
            onChange={patch => setDraft(d => d && { ...d, ...patch })}
            onSave={saveLocation}
            onCancel={() => setDraft(null)}
          />
        )}
        <div role="tablist" aria-label="Paneles" className="flex flex-wrap border-b border-gray-200">
          {([['unlocated', `Sin ubicación (${unlocated.length})`], ['routes', `Rutas (${routes.length})`], ['areas', `Zonas (${areas.length})`], ['mismatch', `Discrepancias (${discrepancies.mismatched.length + discrepancies.outside.length})`]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={rightTab === id}
              onClick={() => setRightTab(id)}
              className={`min-h-11 flex-1 px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${rightTab === id ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {rightTab === 'unlocated' ? (
          <UnlocatedList customers={unlocated} onLocate={startEditing} />
        ) : rightTab === 'mismatch' ? (
          <MismatchPanel customers={payload?.customers ?? []} hasAreas={areas.length > 0} sellers={sellers} onFocus={focusCustomer} />
        ) : rightTab === 'areas' ? (
          <AreasPanel
            areas={areas} stats={stats} sellers={sellers} draft={areaDraft}
            onStartDraw={startDraw} onEditArea={editArea}
            onChangeDraft={patch => setAreaDraft(d => d && { ...d, ...patch })}
            onEditShape={() => setAreaDraft(d => d && { ...d, phase: 'shape' })}
            onDoneShape={() => setAreaDraft(d => d && { ...d, phase: 'form' })}
            onSave={saveArea} onCancel={cancelArea} onDelete={deleteAreaById}
          />
        ) : (
          <RoutesPanel
            routes={routes}
            sellers={sellers}
            customers={payload?.customers ?? []}
            sellerFilter={filters.seller}
            onRoutesChanged={next => {
              setPayload(p => p && ({
                ...p,
                routes: next,
                customers: p.customers.map(c => ({ ...c, routeIds: next.filter(r => r.customerCodes.includes(c.coCli)).map(r => r.id) })),
              }));
              // Drop a route filter whose route was deleted.
              if (filters.route !== null && !next.some(r => r.id === filters.route)) setFilters({ ...filters, route: null });
            }}
            onShowRoute={id => setFilters({ ...filters, route: id })}
          />
        )}
      </aside>
    </div>
  );
}
