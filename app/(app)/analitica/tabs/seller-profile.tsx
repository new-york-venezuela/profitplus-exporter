'use client';

import { useEffect, useState } from 'react';
import { moneyLabel } from '../lib/format';
import type { Currency, DateRange, Seller360Response } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function attainmentBadgeClass(actual: number, quota: number | null): string {
  if (quota === null || quota === 0) return 'bg-gray-100 text-gray-500';
  const ratio = actual / quota;
  if (ratio >= 1) return 'bg-green-100 text-green-800';
  if (ratio >= 0.8) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function KpiCard({ label, actual, actualLabel, quota, quotaSuffix = '' }: {
  label: string;
  actual: number;
  actualLabel: string;
  quota: number | null;
  quotaSuffix?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</h3>
      <div className="text-2xl font-bold text-gray-900">{actualLabel}</div>
      {quota === null ? (
        <div className="text-xs text-gray-400 mt-1">Sin meta definida</div>
      ) : (
        <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${attainmentBadgeClass(actual, quota)}`}>
          {pct(quota > 0 ? actual / quota : null)} de la meta ({quota}{quotaSuffix})
        </div>
      )}
    </div>
  );
}

export default function SellerProfile({ salesRepKey, dateRange, currency, onBack }: {
  salesRepKey: string;
  dateRange: DateRange;
  currency: Currency;
  onBack: () => void;
}) {
  const [data, setData] = useState<Seller360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityGrain, setEntityGrain] = useState<'entity' | 'tienda'>('entity');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ salesRepKey, dateRange, entityGrain });
        const res = await fetch(`/api/dwh/vendedor-360?${params.toString()}`);
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
  }, [salesRepKey, dateRange, entityGrain]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4 print:hidden">← Volver a Vendedores</button>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Volver a Vendedores</button>
        <button
          onClick={() => window.print()}
          className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700"
        >
          Imprimir / PDF
        </button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">{data.salesRepName}</h1>
        <p className="text-sm text-gray-500">Período: {dateRange} — Generado: {new Date().toISOString().slice(0, 10)}</p>
      </div>

      <h1 className="text-lg font-bold text-gray-900 print:hidden">{data.salesRepName}</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900">1. Activación (alcance semanal)</h2>
          <select
            value={entityGrain}
            onChange={e => setEntityGrain(e.target.value === 'tienda' ? 'tienda' : 'entity')}
            className="text-xs border border-gray-300 rounded px-2 py-1 print:hidden"
          >
            <option value="entity">Por entidad</option>
            <option value="tienda">Por tienda</option>
          </select>
        </div>
        {data.activacion.weeks.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin ventas en el período.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Semana</th>
                <th className="text-right py-1">Clientes alcanzados</th>
              </tr>
            </thead>
            <tbody>
              {data.activacion.weeks.map(w => (
                <tr key={w.weekStart}>
                  <td className="pr-4 py-1">{w.weekStart}</td>
                  <td className="text-right py-1">{w.distinctReached}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.activacion.weeklyVisitQuota === null ? (
          <div className="text-xs text-gray-400 mt-2">Sin meta semanal definida</div>
        ) : (
          <div className="text-xs text-gray-600 mt-2">Meta semanal: {data.activacion.weeklyVisitQuota} clientes</div>
        )}
      </div>

      <KpiCard
        label="2. Cuota de ventas mensual"
        actual={currency === 'usd' ? (data.cuota.salesNet.usd ?? 0) : data.cuota.salesNet.bs}
        actualLabel={moneyLabel(data.cuota.salesNet, currency)}
        quota={data.cuota.quotaUsd}
        quotaSuffix=" USD"
      />
      {data.cuota.isPartial && (
        <p className="text-xs text-amber-700">Meta parcial: falta la meta de algún mes del rango seleccionado.</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 mb-2">3. Cobranza (antigüedad de saldos)</h2>
        {data.cobranza.buckets.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin datos de antigüedad disponibles.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Rango</th>
                <th className="text-right pr-4 py-1">Este vendedor</th>
                <th className="text-right py-1">Total empresa</th>
              </tr>
            </thead>
            <tbody>
              {data.cobranza.buckets.map(b => {
                const baseline = data.cobranza.baselineBuckets.find(x => x.bucket === b.bucket);
                return (
                  <tr key={b.bucket}>
                    <td className="pr-4 py-1">{b.bucket}</td>
                    <td className="text-right pr-4 py-1">{moneyLabel(b.amount, currency)}</td>
                    <td className="text-right py-1 text-gray-400">{baseline ? moneyLabel(baseline.amount, currency) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <KpiCard
        label="4. Nuevos clientes"
        actual={data.nuevosClientes.rows.length}
        actualLabel={String(data.nuevosClientes.rows.length)}
        quota={data.nuevosClientes.quota}
      />
      {data.nuevosClientes.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Cliente</th>
                <th className="pr-4 py-1">Primera venta</th>
                <th className="text-right py-1">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.nuevosClientes.rows.map(r => (
                <tr key={r.legalEntityKey}>
                  <td className="pr-4 py-1">{r.legalEntityName}</td>
                  <td className="pr-4 py-1">{r.firstSaleDate}</td>
                  <td className="text-right py-1">{moneyLabel(r.firstSaleAmount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 mb-2">5. Clientes recuperados</h2>
        {data.clientesRecuperados.rows.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin clientes recuperados en el período.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Cliente</th>
                <th className="pr-4 py-1">Última venta antes</th>
                <th className="text-right pr-4 py-1">Días</th>
                <th className="pr-4 py-1">Venta de recuperación</th>
                <th className="text-right py-1">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.clientesRecuperados.rows.map(r => (
                <tr key={r.legalEntityKey}>
                  <td className="pr-4 py-1">{r.legalEntityName}</td>
                  <td className="pr-4 py-1">{r.lastSaleBeforeGap}</td>
                  <td className="text-right pr-4 py-1">{r.gapDays}</td>
                  <td className="pr-4 py-1">{r.recoverySaleDate}</td>
                  <td className="text-right py-1">{moneyLabel(r.recoverySaleAmount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
          <h2 className="text-sm font-bold text-gray-900 mb-2">6a. Devoluciones por producto</h2>
          {data.devoluciones.byProduct.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin devoluciones.</div>
          ) : (
            <table className="min-w-full text-sm">
              <tbody>
                {data.devoluciones.byProduct.map(r => (
                  <tr key={r.label}>
                    <td className="pr-4 py-1">{r.label}</td>
                    <td className="text-right pr-4 py-1">{r.quantity}</td>
                    <td className="text-right py-1">{moneyLabel(r.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
          <h2 className="text-sm font-bold text-gray-900 mb-2">6b. Devoluciones por tienda</h2>
          {data.devoluciones.byTienda.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin devoluciones.</div>
          ) : (
            <table className="min-w-full text-sm">
              <tbody>
                {data.devoluciones.byTienda.map(r => (
                  <tr key={r.label}>
                    <td className="pr-4 py-1">{r.label}</td>
                    <td className="text-right pr-4 py-1">{r.quantity}</td>
                    <td className="text-right py-1">{moneyLabel(r.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 mb-2">7. Profundidad de línea</h2>
        {data.profundidad.coverage === null ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin datos de cobertura para este vendedor en el período.</div>
        ) : (
          <div className="text-sm">
            <div>Cobertura propia: <strong>{pct(data.profundidad.coverage.ownPenetration)}</strong></div>
            <div className="text-gray-500">Línea base de la empresa: {pct(data.profundidad.coverage.baselinePenetration)}</div>
            <div className={data.profundidad.coverage.gapVsBaseline !== null && data.profundidad.coverage.gapVsBaseline < 0 ? 'text-red-600' : 'text-green-600'}>
              Diferencia vs. línea base: {data.profundidad.coverage.gapVsBaseline !== null ? pct(data.profundidad.coverage.gapVsBaseline) : '—'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
