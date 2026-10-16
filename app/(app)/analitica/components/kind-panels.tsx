'use client';

import type { CustomerKind } from '@/lib/dwh/cutover';
import { moneyLabel } from '../lib/format';
import {
  STICKINESS_LABEL, kindStats, newCustomersFunnel, patrimonioHolding, type KindFilter, type KindRow, type Stickiness,
} from '../lib/kind-kpis';
import { pct } from './seguimiento/fmt';
import type { Currency } from '../types';

// Nuevos vs patrimonio panels of the Clientes tab. Colours are never the only signal: every badge and bar carries its label.
const KIND_STYLE: Record<'patrimonio' | 'nuevo', { chip: string; bar: string; label: string }> = {
  patrimonio: { chip: 'bg-indigo-100 text-indigo-800', bar: 'bg-indigo-500', label: 'Patrimonio' },
  nuevo: { chip: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', label: 'Nuevo' },
};
const STICKY_STYLE: Record<Stickiness, string> = {
  constante: 'bg-green-100 text-green-800',
  irregular: 'bg-amber-100 text-amber-800',
  perdido: 'bg-red-100 text-red-800',
  observacion: 'bg-blue-100 text-blue-800',
  sin_frecuencia: 'bg-gray-100 text-gray-600',
};

export function KindBadge({ kind }: { kind: CustomerKind | null }) {
  if (kind === null) return <span className="text-gray-400">—</span>;
  if (kind === 'posterior') return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Posterior</span>;
  const s = KIND_STYLE[kind];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.chip}`}>{s.label}</span>;
}

export function StickinessBadge({ value }: { value: Stickiness }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STICKY_STYLE[value]}`}>{STICKINESS_LABEL[value]}</span>;
}

export function KindSwitch({ value, onChange, rows }: { value: KindFilter; onChange: (k: KindFilter) => void; rows: readonly KindRow[] }) {
  const counts = {
    todos: rows.length,
    patrimonio: rows.filter(r => r.kind === 'patrimonio').length,
    nuevo: rows.filter(r => r.kind === 'nuevo').length,
  };
  const options: { value: KindFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' }, { value: 'patrimonio', label: 'Patrimonio' }, { value: 'nuevo', label: 'Nuevos' },
  ];
  return (
    <div role="group" aria-label="Tipo de cliente" className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md ${value === o.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          {o.label} <span className={value === o.value ? 'text-gray-300' : 'text-gray-400'}>{counts[o.value]}</span>
        </button>
      ))}
    </div>
  );
}

const cardClass = 'bg-white border border-gray-200 rounded-lg p-4';

export function KindComparisonPanel({ rows, currency }: { rows: readonly KindRow[]; currency: Currency }) {
  const p = kindStats(rows, 'patrimonio');
  const n = kindStats(rows, 'nuevo');
  const line = (label: string, a: string, b: string) => (
    <div role="row" key={label} className="contents">
      <div role="rowheader" className="py-1.5 border-t border-gray-100 text-gray-600">{label}</div>
      <div role="cell" className="py-1.5 border-t border-gray-100 text-right font-medium text-gray-900">{a}</div>
      <div role="cell" className="py-1.5 border-t border-gray-100 text-right font-medium text-gray-900">{b}</div>
    </div>
  );
  return (
    <section aria-label="Nuevos vs patrimonio" className={cardClass}>
      <h3 className="text-sm font-bold text-gray-900 mb-2">Nuevos vs patrimonio</h3>
      <div role="table" aria-label="Comparación nuevos vs patrimonio" className="grid grid-cols-[1fr_auto_auto] gap-x-6 text-sm">
        <div role="row" className="contents">
          <div role="columnheader" />
          <div role="columnheader" className="text-right pb-1"><KindBadge kind="patrimonio" /></div>
          <div role="columnheader" className="text-right pb-1"><KindBadge kind="nuevo" /></div>
        </div>
        {line('Clientes', String(p.customers), String(n.customers))}
        {line('Activos en el período', `${pct(p.activePct)} (${p.active})`, `${pct(n.activePct)} (${n.active})`)}
        {line('Ventas del período', moneyLabel(p.sales, currency), moneyLabel(n.sales, currency))}
        {line('Ventas por cliente activo', p.salesPerActive ? moneyLabel(p.salesPerActive, currency) : '—', n.salesPerActive ? moneyLabel(n.salesPerActive, currency) : '—')}
        {line('Con visita vencida', String(p.overdue), String(n.overdue))}
        {line('Llevan 30+ días sin comprar', String(p.lapsed), String(n.lapsed))}
        {line('Constantes (últimas 3 visitas)', pct(p.constantePct), pct(n.constantePct))}
      </div>
    </section>
  );
}

export function PatrimonioHoldingPanel({ rows, prevPeriodAvailable, currency, onShowCooled }: {
  rows: readonly KindRow[]; prevPeriodAvailable: boolean; currency: Currency; onShowCooled: () => void;
}) {
  const h = patrimonioHolding(rows, prevPeriodAvailable, currency);
  const delta = h.salesDeltaPct;
  return (
    <section aria-label="¿Se mantiene el patrimonio?" className={cardClass}>
      <h3 className="text-sm font-bold text-gray-900 mb-2">¿Se mantiene el patrimonio?</h3>
      {!prevPeriodAvailable ? (
        <p className="text-sm text-gray-500">Este rango no tiene un período anterior comparable.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">Ventas vs período anterior</span>
            <span className={`font-medium ${delta === null ? 'text-gray-400' : delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {delta === null ? '—' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(1)}%`}
            </span></div>
          <div className="flex justify-between"><span className="text-gray-600">Siguen comprando</span>
            <span className="font-medium text-gray-900">{pct(h.retainedPct)} ({h.boughtPrev === null ? 0 : h.boughtPrev - (h.cooled ?? 0)} de {h.boughtPrev})</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-600">Se enfriaron</span>
            <span className="flex items-center gap-2">
              <span className={`font-medium ${(h.cooled ?? 0) > 0 ? 'text-red-700' : 'text-gray-900'}`}>{h.cooled}</span>
              {(h.cooled ?? 0) > 0 && (
                <button type="button" onClick={onShowCooled} className="text-xs text-blue-600 hover:underline">Ver en la tabla</button>
              )}
            </span></div>
          <p className="text-xs text-gray-400">&quot;Se enfriaron&quot;: compraron en el período anterior y no en este.</p>
        </div>
      )}
    </section>
  );
}

export function NewFunnelPanel({ rows }: { rows: readonly KindRow[] }) {
  const f = newCustomersFunnel(rows);
  const stage = (label: string, value: number, color: string) => (
    <div key={label}>
      <div className="flex justify-between text-sm"><span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{value}{f.registered > 0 ? ` · ${pct(value / f.registered)}` : ''}</span></div>
      <div className="h-2 rounded bg-gray-100"><div className={`h-2 rounded ${color}`} style={{ width: f.registered > 0 ? `${(value / f.registered) * 100}%` : '0%' }} /></div>
    </div>
  );
  return (
    <section aria-label="¿Se quedan los nuevos?" className={cardClass}>
      <h3 className="text-sm font-bold text-gray-900 mb-2">¿Se quedan los nuevos?</h3>
      {f.registered === 0 ? (
        <p className="text-sm text-gray-500">No hay clientes nuevos en el año del rango.</p>
      ) : (
        <div className="space-y-2">
          {stage('Registrados', f.registered, KIND_STYLE.nuevo.bar)}
          {stage('Compraron alguna vez', f.bought, KIND_STYLE.nuevo.bar)}
          {stage('Constantes (3 de 3 visitas)', f.constante, 'bg-green-500')}
          <ul className="text-xs text-gray-600 grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
            <li>Irregulares: <span className="font-medium">{f.irregular}</span></li>
            <li>Perdidos: <span className="font-medium">{f.perdido}</span></li>
            <li>En observación: <span className="font-medium">{f.observacion}</span></li>
            <li>Sin frecuencia: <span className="font-medium">{f.sin_frecuencia}</span></li>
            <li>Nunca compraron: <span className="font-medium">{f.neverBought}</span></li>
            <li>Días a la 1ª compra (mediana): <span className="font-medium">{f.medianDaysToFirstSale ?? '—'}</span></li>
          </ul>
        </div>
      )}
    </section>
  );
}
