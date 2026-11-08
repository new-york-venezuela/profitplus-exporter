import { useState } from 'react';
import type { ProspectoResponse, ProspectoTier } from '../../types';

const nf1 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('es-VE', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 1 });

const usd = (n: number) => `$${nf2.format(n)}`;

const TIER_TEXT: Record<ProspectoTier, string> = {
  type_route: 'Mismo tipo y misma ruta',
  type_near_routes: 'Mismo tipo en las 2 rutas más cercanas',
  type_all: 'Mismo tipo en todas las rutas',
};

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
      <div className="text-2xl font-bold text-gray-900">{children}</div>
      {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded px-4 py-2">
      <span aria-hidden="true">⚠ </span>{children}
    </div>
  );
}

const PEERS_SHOWN = 15;

export function ResultPanel({ data }: { data: ProspectoResponse }) {
  const [showAll, setShowAll] = useState(false);
  const noPeers = data.peerCount === 0;
  const shownPeers = showAll ? data.peers : data.peers.slice(0, PEERS_SHOWN);
  const benefitNote = data.benefit
    ? `Rango: ${usd(data.benefit.p25Usd)} – ${usd(data.benefit.p75Usd)}`
    : noPeers ? 'Sin pares suficientes' : 'Sin datos de costo';
  const unitsNote = data.units
    ? `Rango: ${nf1.format(data.units.p25)} – ${nf1.format(data.units.p75)}`
    : 'Sin pares suficientes';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.lowPeers && !noPeers && <Banner>Pocos pares ({data.peerCount}): tómelo como referencia.</Banner>}
        {data.benefit?.incomplete && (
          <Banner>Algunos productos no tienen costo (Sin datos); el beneficio solo suma los productos con costo.</Banner>
        )}
        {data.excludedNoRoute > 0 && (
          <Banner>{data.excludedNoRoute} clientes sin ruta (de todos los tipos) no se consideraron.</Banner>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Unidades por semana" note={unitsNote}>
          {data.units ? nf1.format(data.units.median) : 'Sin datos'}
        </Card>
        <Card title="Beneficio semanal de la tienda" note={benefitNote}>
          {data.benefit ? usd(data.benefit.medianUsd) : 'Sin datos'}
        </Card>
        <Card title="Pares" note={noPeers ? 'Sin pares suficientes' : TIER_TEXT[data.tier]}>
          {data.peerCount}
        </Card>
      </div>
      <p className="text-xs text-gray-500">Mediana semanal por tienda, en unidades brutas (sin devoluciones).</p>

      {!noPeers && (
        <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Mezcla típica de productos">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Mezcla típica de productos</h2>
          {data.mix.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-1 font-medium">Producto</th>
                  <th className="py-1 font-medium text-right">Participación</th>
                  <th className="py-1 font-medium text-right">Costo por unidad</th>
                </tr>
              </thead>
              <tbody>
                {data.mix.map(l => (
                  <tr key={l.productCode} className="border-b border-gray-100">
                    <td className="py-1">{l.productName}</td>
                    <td className="py-1 text-right tabular-nums">{pct.format(l.share)}</td>
                    <td className="py-1 text-right tabular-nums">{l.costUsd === null ? 'Sin datos' : usd(l.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {!noPeers && (
        <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Pares más cercanos">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Pares más cercanos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-1 font-medium">Cliente</th>
                <th className="py-1 font-medium">Ruta</th>
                <th className="py-1 font-medium text-right">Unidades/semana</th>
                <th className="py-1 font-medium text-right">Beneficio/sem. (mezcla típica)</th>
              </tr>
            </thead>
            <tbody>
              {shownPeers.map(p => (
                <tr key={p.code} className="border-b border-gray-100">
                  <td className="py-1">{p.name}{p.typeName ? <span className="text-xs text-gray-500"> · {p.typeName}</span> : null}</td>
                  <td className="py-1">{p.routeNumber ?? '—'}</td>
                  <td className="py-1 text-right tabular-nums">{nf1.format(p.weeklyUnits)}</td>
                  <td className="py-1 text-right tabular-nums">{p.weeklyBenefitUsd === null ? 'Sin datos' : usd(p.weeklyBenefitUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.peers.length > PEERS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="mt-2 text-xs underline text-blue-700"
            >
              {showAll ? `Ver menos` : `Ver todos (${data.peers.length})`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
