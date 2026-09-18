'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { moneyLabel } from '../lib/format';
import type {
  Currency, DateRange, ProductosResponse, ProductosRow,
  ProfundidadLineaResponse, UnitsByLineaResponse,
} from '../types';

// Stable palette cycled across whatever líneas a given date range/tienda
// filter surfaces — "Otras" (always last in `lineas`, see route.ts) gets the
// trailing gray so it reads as a catch-all rather than another real línea.
const LINEA_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#6b7280'];

function lineaColor(linea: string, lineas: string[]): string {
  if (linea === 'Otras') return '#9ca3af';
  const idx = lineas.indexOf(linea);
  return LINEA_COLORS[idx % LINEA_COLORS.length];
}

type ProductosGroupBy = 'linea' | 'sublinea' | 'sku';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function qty(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n);
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

const COLUMN_LABEL: Record<ProductosGroupBy, string> = {
  linea: 'Línea',
  sublinea: 'Sublínea',
  sku: 'SKU',
};

function rowLabel(row: ProductosRow, groupBy: ProductosGroupBy): string {
  if (groupBy === 'sku') return row.sku;
  if (groupBy === 'sublinea') return row.sublinea;
  return row.linea;
}

function rowKey(row: ProductosRow, i: number): string {
  return `${row.linea}-${row.sublinea}-${row.sku}-${i}`;
}

export default function TabProductos({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [groupBy, setGroupBy] = useState<ProductosGroupBy>('linea');
  const [linea, setLinea] = useState<string | null>(null);
  const [sublinea, setSublinea] = useState<string | null>(null);
  const [tienda, setTienda] = useState<string | null>(null);
  const [tiendas, setTiendas] = useState<{ value: string; label: string }[]>([]);
  const [data, setData] = useState<ProductosResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [profundidadData, setProfundidadData] = useState<ProfundidadLineaResponse | null>(null);
  const [profundidadLoading, setProfundidadLoading] = useState<boolean>(true);
  const [profundidadError, setProfundidadError] = useState<string | null>(null);

  const [porLineaMesData, setPorLineaMesData] = useState<UnitsByLineaResponse | null>(null);
  const [porLineaMesLoading, setPorLineaMesLoading] = useState<boolean>(true);
  const [porLineaMesError, setPorLineaMesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTiendas() {
      try {
        const res = await fetch('/api/dwh/productos?tiendas=1');
        if (cancelled || !res.ok) return;
        const body: { tiendas?: { value: string; label: string }[] } = await res.json().catch(() => ({}));
        if (!cancelled) setTiendas(body.tiendas ?? []);
      } catch {
        // Non-critical — filter just stays empty if this fails.
      }
    }
    loadTiendas();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy !== 'linea' && linea) params.set('linea', linea);
        if (groupBy === 'sku' && sublinea) params.set('sublinea', sublinea);
        if (tienda) params.set('tienda', tienda);
        const res = await fetch(`/api/dwh/productos?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ProductosResponse = await res.json();
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, groupBy, linea, sublinea, tienda]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setProfundidadError(null);
      setProfundidadLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, section: 'profundidad' });
        if (tienda) params.set('tienda', tienda);
        const res = await fetch(`/api/dwh/productos?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setProfundidadError(body.error ?? 'Error desconocido');
          return;
        }
        setProfundidadData(await res.json());
      } catch {
        if (!cancelled) setProfundidadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setProfundidadLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, tienda]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPorLineaMesError(null);
      setPorLineaMesLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, section: 'porLineaMes' });
        if (tienda) params.set('tienda', tienda);
        const res = await fetch(`/api/dwh/productos?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPorLineaMesError(body.error ?? 'Error desconocido');
          return;
        }
        setPorLineaMesData(await res.json());
      } catch {
        if (!cancelled) setPorLineaMesError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setPorLineaMesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, tienda]);

  function handleRowClick(row: ProductosRow) {
    if (groupBy === 'linea') {
      setLinea(row.linea);
      setSublinea(null);
      setGroupBy('sublinea');
    } else if (groupBy === 'sublinea') {
      setSublinea(row.sublinea);
      setGroupBy('sku');
    }
  }

  function handleBreadcrumbClick(crumbGroupBy: ProductosGroupBy) {
    if (crumbGroupBy === 'linea') {
      setLinea(null);
      setSublinea(null);
      setGroupBy('linea');
    } else if (crumbGroupBy === 'sublinea') {
      setSublinea(null);
      setGroupBy('sublinea');
    }
  }

  // Clicking a línea's segment within a month's stacked bar drills the
  // existing línea/sublínea/sku table straight to that línea's sublíneas
  // (reusing handleRowClick's own state-setting logic) and scrolls it into
  // view — "Otras" isn't a real línea (see route.ts), so it isn't drillable.
  function handleStackSegmentClick(lineaName: string) {
    if (lineaName === 'Otras') return;
    setLinea(lineaName);
    setSublinea(null);
    setGroupBy('sublinea');
    document.getElementById('productos-drilldown-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const rate = data?.usdRate ?? undefined;
  const drillable = groupBy !== 'sku';
  const profundidadRate = profundidadData?.usdRate ?? undefined;
  const porLineaMesRate = porLineaMesData?.usdRate ?? undefined;
  const porLineaMesChartData = (porLineaMesData?.rows ?? []).map(r => ({ ...r.units, yearMonth: r.yearMonth, yearMonthValue: r.yearMonthValue }));

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Breadcrumb */}
      {data && data.breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-gray-500">
          {data.breadcrumb.map((crumb, i) => (
            <span key={`${crumb.groupBy}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">/</span>}
              {i === data.breadcrumb.length - 1 ? (
                <span className="font-medium text-gray-800">{crumb.label}</span>
              ) : (
                <button
                  onClick={() => handleBreadcrumbClick(crumb.groupBy as ProductosGroupBy)}
                  className="hover:text-blue-600 hover:underline"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      <div id="productos-drilldown-section" className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-sm font-bold text-gray-900">Rotación y margen por producto</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Tienda:
            <select
              value={tienda ?? ''}
              onChange={e => setTienda(e.target.value || null)}
              className="border border-gray-200 rounded px-2 py-1 text-sm max-w-[220px]"
            >
              <option value="">Todas</option>
              {tiendas.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {groupBy === 'linea' && 'Ventas netas, rotación y margen por línea de producto — clic en una fila para ver sus sublíneas'}
          {groupBy === 'sublinea' && 'Sublíneas de la línea seleccionada — clic en una fila para ver sus productos'}
          {groupBy === 'sku' && 'Productos individuales de la sublínea seleccionada'}
        </p>

        {loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                    {COLUMN_LABEL[groupBy]}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">% del total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row, i) => (
                  <tr
                    key={rowKey(row, i)}
                    onClick={drillable ? () => handleRowClick(row) : undefined}
                    className={`${i % 2 === 1 ? 'bg-gray-50' : ''} ${drillable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-gray-800">{rowLabel(row, groupBy)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {moneyLabel(row.salesNet, currency, rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.salesShare)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{qty(row.rotacion)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unidades vendidas por mes, apiladas por línea */}
      <ChartCard
        title="Unidades vendidas por mes, por línea"
        subtitle="Clic en un segmento para ver las sublíneas de esa línea"
      >
        {porLineaMesLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : porLineaMesError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{porLineaMesError}</p>
        ) : !porLineaMesData || porLineaMesChartData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={porLineaMesChartData} margin={{ top: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => qty(Number(v))} />
              <Tooltip
                formatter={(value, name, entry) => {
                  const row = porLineaMesData.rows.find(r => r.yearMonth === (entry.payload as { yearMonth: string })?.yearMonth);
                  const lineaName = String(name);
                  const salesNet = row?.salesNet[lineaName] ?? 0;
                  const share = row && row.totalSalesNet > 0 ? salesNet / row.totalSalesNet : null;
                  return [`${qty(Number(value))} u. — ${moneyLabel(salesNet, currency, porLineaMesRate)} (${pct(share)} del mes)`, lineaName];
                }}
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

      {/* Profundidad de Línea */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Profundidad de Línea</h2>
        <p className="text-xs text-gray-500 mb-3">
          Top 15 productos por ventas netas — presencia en clientes y tiendas, precio y unidades promedio mensuales, tasa de devolución
        </p>

        {profundidadLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : profundidadError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{profundidadError}</p>
        ) : !profundidadData || profundidadData.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Clientes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tiendas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Precio prom./mes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades prom./mes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profundidadData.rows.map((row, i) => (
                  <tr key={`${row.sku}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{row.sku}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {qty(row.clientCount)} <span className="text-gray-400">({pct(row.clientShare)})</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {qty(row.storeCount)} <span className="text-gray-400">({pct(row.storeShare)})</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {moneyLabel(row.avgMonthlyPrice, currency, profundidadRate)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{qty(row.avgMonthlyUnits)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.returnRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
