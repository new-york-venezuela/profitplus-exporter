'use client';

import { Fragment, useEffect, useState } from 'react';
import { moneyLabel } from '../lib/format';
import type { Currency, DateRange, DepthMatrixResponse, DepthMatrixRow, DepthGapResponse, CustomerSegment, SellerCoverageResponse } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(0)}%`;
}

function EmptyState() {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      Sin datos disponibles todavía.
    </div>
  );
}

const TIER_LABELS: Record<DepthMatrixRow['tier'], string> = {
  primera: 'Primera línea',
  segunda: 'Segunda línea',
  addon: 'Addon',
  'sin-ventas': 'Sin ventas',
};

const TIER_COLORS: Record<DepthMatrixRow['tier'], string> = {
  primera: 'bg-green-100 text-green-800',
  segunda: 'bg-blue-100 text-blue-800',
  addon: 'bg-gray-100 text-gray-600',
  'sin-ventas': 'bg-gray-50 text-gray-400',
};

export default function TabProfundidad({ dateRange, currency }: { dateRange: DateRange; currency: Currency }) {
  const [data, setData] = useState<DepthMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'linea' | 'sublinea' | 'sku'>('linea');
  const [linea, setLinea] = useState<string | null>(null);
  const [sublinea, setSublinea] = useState<string | null>(null);
  const [firstLineMinPenetration, setFirstLineMinPenetration] = useState(0.7);
  const [secondLineMinPenetration, setSecondLineMinPenetration] = useState(0.3);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [gapData, setGapData] = useState<DepthGapResponse | null>(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [salesRepKey, setSalesRepKey] = useState<string | null>(null);
  const [salesRepName, setSalesRepName] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<SellerCoverageResponse | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      try {
        const params = new URLSearchParams({
          dateRange, currency, section: 'leaderboard',
          firstLineMinPenetration: String(firstLineMinPenetration),
          secondLineMinPenetration: String(secondLineMinPenetration),
        });
        const res = await fetch(`/api/dwh/profundidad-linea?${params.toString()}`);
        if (cancelled) return;
        if (res.ok) setLeaderboard(await res.json());
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    }
    loadLeaderboard();
    return () => { cancelled = true; };
  }, [dateRange, currency, firstLineMinPenetration, secondLineMinPenetration]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          dateRange, currency, groupBy,
          firstLineMinPenetration: String(firstLineMinPenetration),
          secondLineMinPenetration: String(secondLineMinPenetration),
        });
        if (linea) params.set('linea', linea);
        if (sublinea) params.set('sublinea', sublinea);
        if (salesRepKey) params.set('salesRepKey', salesRepKey);
        const res = await fetch(`/api/dwh/profundidad-linea?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange, currency, groupBy, linea, sublinea, firstLineMinPenetration, secondLineMinPenetration, salesRepKey]);

  const rate = data?.usdRate ?? undefined;

  function drillInto(row: DepthMatrixRow) {
    if (groupBy === 'linea') {
      setLinea(row.label);
      setGroupBy('sublinea');
    } else if (groupBy === 'sublinea') {
      setSublinea(row.label);
      setGroupBy('sku');
    }
    setExpandedKey(null);
  }

  function resetToLineas() {
    setGroupBy('linea');
    setLinea(null);
    setSublinea(null);
    setExpandedKey(null);
  }

  function backToSublineas() {
    setGroupBy('sublinea');
    setSublinea(null);
    setExpandedKey(null);
  }

  async function handleToggleGap(row: DepthMatrixRow, segment: CustomerSegment) {
    const key = `${row.value}|${segment}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    setGapData(null);
    setGapLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange, section: 'gap', groupBy, segment, productLabel: row.label,
      });
      if (linea) params.set('linea', linea);
      if (sublinea) params.set('sublinea', sublinea);
      const res = await fetch(`/api/dwh/profundidad-linea?${params.toString()}`);
      if (res.ok) setGapData(await res.json());
    } finally {
      setGapLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="p-6"><EmptyState /></div>;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {!leaderboardLoading && leaderboard && leaderboard.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Cobertura por vendedor</h2>
          <p className="text-xs text-gray-500 mb-3">
            Penetración de productos primera/segunda línea en las entidades propias de cada vendedor, comparada con el promedio general
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Entidades</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Penetración propia</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Promedio general</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Brecha</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.rows.map((row, i) => (
                  <tr key={row.salesRepKey} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{row.salesRepName}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.entitiesServed}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.ownPenetration)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.baselinePenetration)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${row.gapVsBaseline !== null && row.gapVsBaseline < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {row.gapVsBaseline === null ? '—' : `${row.gapVsBaseline >= 0 ? '+' : ''}${(row.gapVsBaseline * 100).toFixed(0)}pp`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setSalesRepKey(row.salesRepKey); setSalesRepName(row.salesRepName); }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {salesRepKey && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Mostrando solo clientes de: <strong>{salesRepName}</strong></span>
          <button
            onClick={() => { setSalesRepKey(null); setSalesRepName(null); }}
            className="text-blue-600 hover:text-blue-800 underline text-xs"
          >
            Volver a vista general
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Profundidad de Línea</h2>
            <p className="text-xs text-gray-500">
              Penetración por segmento (Cadena / Independientes) a nivel de entidad legal
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <label className="flex items-center gap-1">
              Primera línea ≥
              <input
                type="number" min={0} max={100} step={5}
                value={Math.round(firstLineMinPenetration * 100)}
                onChange={e => setFirstLineMinPenetration(Number(e.target.value) / 100)}
                className="border border-gray-200 rounded px-1 py-0.5 w-14 text-right"
              />%
            </label>
            <label className="flex items-center gap-1">
              Segunda línea ≥
              <input
                type="number" min={0} max={100} step={5}
                value={Math.round(secondLineMinPenetration * 100)}
                onChange={e => setSecondLineMinPenetration(Number(e.target.value) / 100)}
                className="border border-gray-200 rounded px-1 py-0.5 w-14 text-right"
              />%
            </label>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <button onClick={resetToLineas} className="hover:text-blue-600 underline">Líneas</button>
          {linea && (
            <>
              <span>/</span>
              <button onClick={backToSublineas} className="hover:text-blue-600 underline">{linea}</button>
            </>
          )}
          {sublinea && (
            <>
              <span>/</span>
              <span>{sublinea}</span>
            </>
          )}
        </nav>

        {data.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Cadena</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Independientes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Clasificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row, i) => {
                  const cadena = row.cells.find(c => c.segment === 'CADENA');
                  const independientes = row.cells.find(c => c.segment === 'INDEPENDIENTES');
                  const canDrill = groupBy !== 'sku';
                  return (
                    <Fragment key={row.value}>
                      <tr className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2 text-gray-800">
                          {canDrill ? (
                            <button onClick={() => drillInto(row)} className="hover:text-blue-600 underline text-left">
                              {row.label}
                            </button>
                          ) : row.label}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {cadena ? (
                            <button onClick={() => handleToggleGap(row, 'CADENA')} className="hover:text-blue-600">
                              {cadena.entitiesBuying}/{cadena.entitiesActive} ({pct(cadena.penetration)})
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {independientes ? (
                            <button onClick={() => handleToggleGap(row, 'INDEPENDIENTES')} className="hover:text-blue-600">
                              {independientes.entitiesBuying}/{independientes.entitiesActive} ({pct(independientes.penetration)})
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{pct(row.totalPenetration)}</td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">{moneyLabel(row.totalSalesNet, currency, rate)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${TIER_COLORS[row.tier]}`}>
                            {TIER_LABELS[row.tier]}
                          </span>
                        </td>
                      </tr>
                      {(expandedKey === `${row.value}|CADENA` || expandedKey === `${row.value}|INDEPENDIENTES`) && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2 bg-gray-50/50">
                            {gapLoading ? (
                              <div className="text-xs text-gray-400 py-2">Cargando…</div>
                            ) : !gapData || gapData.entities.length === 0 ? (
                              <div className="text-xs text-gray-400 py-2">Ninguna entidad activa está sin comprar este producto.</div>
                            ) : (
                              <div className="text-xs">
                                <p className="text-gray-500 mb-1">
                                  Entidades en {gapData.segment} que no compran {gapData.productLabel}:
                                </p>
                                <ul className="ml-4 list-disc space-y-0.5">
                                  {gapData.entities.map(e => (
                                    <li key={e.legalEntityKey} className="text-gray-700">
                                      {e.legalEntityName} — {moneyLabel(e.totalSalesNet, currency, rate)} en ventas totales
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
