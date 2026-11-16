'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { moneyLabel, qty } from '../lib/format';
import { bucketLabels, bucketTitle, TREND_UNIT_LABEL } from '../lib/granularity';
import type { Granularity } from '../lib/granularity';
import { trendClickPatch, useProductosParams, type Nivel, type ProductosParams } from '../lib/productos-params';
import ControlBar from '../components/productos/control-bar';
import MasterTable from '../components/productos/master-table';
import BubblePlot from '../components/productos/bubble-plot';
import { normalizeStack } from '@/lib/productos/normalize-stack';
import { GroupShareMatrixTable } from '../components/productos/group-share-matrix';
import type { SearchableSelectOption } from '@/lib/components/searchable-select';
import type {
  CatalogoResponse, Currency, DateRange, UnitsByLineaResponse,
  ProductosCategoriasResponse, ProductosFiltrosResponse, ProductosGroupShareResponse,
} from '../types';

// Stable palette across the (up to 10) series a given range/filter surfaces — "Otras" (always last
// in `lineas`, see route.ts) gets the trailing gray so it reads as a catch-all, not another series.
const LINEA_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
];

function lineaColor(linea: string, lineas: string[]): string {
  if (linea === 'Otras') return '#9ca3af';
  const idx = lineas.indexOf(linea);
  return LINEA_COLORS[idx % LINEA_COLORS.length];
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const NIVEL_LABEL: Record<Nivel, string> = { linea: 'Línea', sublinea: 'Sublínea', sku: 'SKU' };

const NIVEL_SERIES_LABEL: Record<Nivel, string> = { linea: 'línea', sublinea: 'sublínea', sku: 'SKU' };

const NIVEL_SUBTITLE: Record<Nivel, string> = {
  linea: 'Una fila por línea de producto',
  sublinea: 'Una fila por sublínea',
  sku: 'Todos los SKU con ventas en el período',
};

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

function ChartCard({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {actions}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

// The bar's item filters as query params (shared by section=catalogo and section=grupos).
function filterParams(base: Record<string, string>, p: ProductosParams): URLSearchParams {
  const params = new URLSearchParams({ ...base, nivel: p.nivel });
  if (p.tienda) params.set('tienda', p.tienda);
  if (p.categoria) params.set('categoria', p.categoria);
  if (p.lineas.length > 0) params.set('lineas', p.lineas.join(','));
  if (p.sublineas.length > 0) params.set('sublineas', p.sublineas.join(','));
  if (p.grupo) params.set('grupo', p.grupo);
  if (p.q) params.set('q', p.q);
  return params;
}

// Fetches JSON for `url`; a stale response (the effect was cleaned up, request aborted) is ignored.
// Loading is derived: the last settled result belongs to a different URL.
function useSection<T>(url: string): { data: T | null; loading: boolean; error: string | null } {
  const [settled, setSettled] = useState<{ url: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!controller.signal.aborted) setSettled({ url, data: null, error: body.error ?? 'Error desconocido' });
          return;
        }
        const body: T = await res.json();
        if (!controller.signal.aborted) setSettled({ url, data: body, error: null });
      } catch {
        if (!controller.signal.aborted) setSettled({ url, data: null, error: 'No se pudo conectar con el servidor' });
      }
    })();
    return () => controller.abort();
  }, [url]);
  const current = settled !== null && settled.url === url;
  return { data: current ? settled.data : null, loading: !current, error: current ? settled.error : null };
}

// Option lists for the bar: fetched once, non-critical (a failed list just stays empty).
function useOnce<T>(url: string, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted || !res.ok) return;
        const body: T = await res.json();
        if (!controller.signal.aborted) setValue(body);
      } catch {
        // Non-critical.
      }
    })();
    return () => controller.abort();
  }, [url]);
  return value;
}

const EMPTY_FILTROS: ProductosFiltrosResponse = { lineas: [], sublineas: [], grupos: [] };

export default function TabProductos({
  dateRange,
  currency,
  granularity,
}: {
  dateRange: DateRange;
  currency: Currency;
  granularity: Granularity;
}) {
  const [params, setParams] = useProductosParams();

  const tiendas = useOnce<{ tiendas?: SearchableSelectOption[] }>('/api/dwh/productos?tiendas=1', {}).tiendas ?? [];
  const categorias = useOnce<ProductosCategoriasResponse>('/api/dwh/productos?categorias=1', { categorias: [] }).categorias ?? [];
  const filtros = useOnce<ProductosFiltrosResponse>('/api/dwh/productos?filtros=1', EMPTY_FILTROS);

  const lineaOptions = useMemo(() => (filtros.lineas ?? []).map(l => ({ value: l, label: l })), [filtros]);
  // Sublíneas narrow to the selected líneas; the filter matches by sublínea name.
  const sublineaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of filtros.sublineas ?? []) {
      if (params.lineas.length === 0 || params.lineas.includes(s.linea)) names.add(s.sublinea);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es')).map(s => ({ value: s, label: s }));
  }, [filtros, params.lineas]);
  const grupoOptions = useMemo(() => (filtros.grupos ?? []).map(g => ({ value: g.code, label: g.name })), [filtros]);

  const catalogoUrl = `/api/dwh/productos?${filterParams({ dateRange, section: 'catalogo', currency }, params).toString()}`;
  const gruposUrl = `/api/dwh/productos?${filterParams({ dateRange, section: 'grupos' }, params).toString()}`;
  const trendParams = filterParams({ dateRange, section: 'porLineaMes', granularity }, params);
  const trendUrl = `/api/dwh/productos?${trendParams.toString()}`;

  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState(false);
  const catalogo = useSection<CatalogoResponse>(catalogoUrl);
  const grupos = useSection<ProductosGroupShareResponse>(gruposUrl);
  const trend = useSection<UnitsByLineaResponse>(trendUrl);

  // Clicking a series drills one level down (see trendClickPatch). "Otras" does nothing.
  function handleStackSegmentClick(seriesName: string) {
    const patch = trendClickPatch(trend.data?.nivel ?? params.nivel, trend.data?.seriesMeta?.[seriesName], seriesName);
    if (patch === null) return;
    setParams(patch);
    document.getElementById('productos-master-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleBubbleSelect(key: string) {
    setHighlightKey(key);
    document.getElementById(`prod-row-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const porLineaMesData = trend.data;
  const trendMode = porLineaMesData?.trendMode ?? 'month';
  const porLineaMesLabels = bucketLabels(trendMode, (porLineaMesData?.rows ?? []).map(r => r.bucket));
  const trendKeys = porLineaMesData?.lineas ?? [];
  const trendShares = normalizeStack((porLineaMesData?.rows ?? []).map(r => r.units), trendKeys);
  const porLineaMesChartData = (porLineaMesData?.rows ?? []).map((r, i) => ({
    ...(shareMode ? trendShares[i] : r.units),
    label: porLineaMesLabels[i],
    bucket: r.bucket,
    realUnits: r.units,
    title: bucketTitle(trendMode, r.bucket),
  }));

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <ControlBar
        params={params}
        onChange={setParams}
        tiendas={tiendas}
        categorias={categorias}
        lineaOptions={lineaOptions}
        sublineaOptions={sublineaOptions}
        grupoOptions={grupoOptions}
      />

      <section id="productos-master-section" aria-labelledby="productos-master-title" className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
        <h2 id="productos-master-title" className="text-sm font-bold text-gray-900">Catálogo de productos</h2>
        <p className="text-xs text-gray-500 mb-3">
          {NIVEL_SUBTITLE[params.nivel]}, sin IVA. Devoluciones por fecha de devolución; clic en un encabezado para ordenar.
        </p>
        <MasterTable
          rows={catalogo.data?.rows ?? []}
          currency={currency}
          metric={params.metric}
          nivel={params.nivel}
          loading={catalogo.loading}
          error={catalogo.error}
          highlightKey={highlightKey}
        />
      </section>

      <ChartCard
        title="Participación por grupo de cliente"
        subtitle="Qué parte de las ventas brutas de cada fila va a cada grupo de cliente (grupo actual del cliente en Profit Plus) — sigue el nivel y los filtros de la barra"
      >
        {grupos.loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : grupos.error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{grupos.error}</p>
        ) : (
          <>
            <GroupShareMatrixTable
              matrix={grupos.data ?? { columns: [], rows: [] }}
              currency={currency}
              metric={params.metric}
              rowHeader={NIVEL_LABEL[params.nivel]}
              open={params.matriz}
              onToggle={() => setParams({ matriz: !params.matriz })}
            />
            <p className="mt-2 text-xs text-gray-400">
              Solo ventas positivas y las 30 filas con más ventas: puede no cuadrar exactamente con la tabla de arriba.
            </p>
          </>
        )}
      </ChartCard>

      <ChartCard
        title="Volumen, ventas y tendencia por fila"
        subtitle="Cada burbuja es una fila de la tabla; sigue el nivel y los filtros de la barra"
      >
        {catalogo.loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : catalogo.error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{catalogo.error}</p>
        ) : (catalogo.data?.rows ?? []).length === 0 ? (
          <EmptyState />
        ) : (
          <BubblePlot rows={catalogo.data?.rows ?? []} currency={currency} onSelect={handleBubbleSelect} />
        )}
      </ChartCard>

      {/* Unidades vendidas por período, apiladas por el ítem del nivel activo */}
      <ChartCard
        title={`Unidades vendidas por ${TREND_UNIT_LABEL[trendMode]}, por ${NIVEL_SERIES_LABEL[params.nivel]}`}
        subtitle="Clic en un segmento para filtrar la tabla"
        actions={(
          <div role="group" aria-label="Escala del gráfico" className="inline-flex rounded border border-gray-300 text-xs overflow-hidden shrink-0">
            <button type="button" aria-pressed={!shareMode} onClick={() => setShareMode(false)} className={`px-2 py-1 ${!shareMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>Absoluto</button>
            <button type="button" aria-pressed={shareMode} onClick={() => setShareMode(true)} className={`px-2 py-1 ${shareMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>100 %</button>
          </div>
        )}
      >
        {trend.loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : trend.error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{trend.error}</p>
        ) : !porLineaMesData || porLineaMesChartData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={porLineaMesChartData} margin={{ top: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={shareMode ? [0, 1] : undefined} tickFormatter={v => (shareMode ? `${Math.round(Number(v) * 100)}%` : qty(Number(v)))} />
              <Tooltip
                formatter={(value, name, entry) => {
                  const row = porLineaMesData.rows.find(r => r.bucket === (entry.payload as { bucket: string })?.bucket);
                  const lineaName = String(name);
                  const realUnits = (entry.payload as { realUnits?: Record<string, number> })?.realUnits?.[lineaName] ?? Number(value);
                  const salesGrossAmount = row?.salesGross[lineaName] ?? { bs: 0, usd: 0 };
                  const totalBs = row?.totalSalesGross.bs ?? 0;
                  const share = totalBs > 0 ? salesGrossAmount.bs / totalBs : null;
                  return [`${qty(realUnits)} u. — ${moneyLabel(salesGrossAmount, currency)} (${pct(share)} del ${TREND_UNIT_LABEL[trendMode]})`, lineaName];
                }}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {porLineaMesData.lineas.map(lineaName => (
                <Bar
                  key={lineaName}
                  dataKey={lineaName}
                  stackId="lineas"
                  fill={lineaColor(lineaName, porLineaMesData.lineas)}
                  cursor={lineaName === 'Otras' ? 'default' : 'pointer'}
                  onClick={() => handleStackSegmentClick(lineaName)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
