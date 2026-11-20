'use client';

import type { KpiCardData } from '@/lib/clientes/kpis';
import type { ClientesParams } from '../../lib/clientes-params';
import { DeltaBadge } from './delta-badge';

function Card({ card }: { card: KpiCardData }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{card.label}</p>
        <span className="text-xs rounded bg-gray-100 text-gray-700 px-1.5 py-0.5">{card.windowTag}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${card.warn ? 'text-orange-700' : 'text-gray-900'}`}>{card.value}</p>
      <div className="mt-1 min-h-4">
        {card.previous !== null || card.id === 'ventas' || card.id === 'activos'
          ? <DeltaBadge current={card.current} previous={card.previous} />
          : null}
      </div>
      {card.hint && <p className="text-xs text-gray-600 mt-1">{card.hint}</p>}
      <p className="text-xs text-gray-600 mt-1">{card.basis}</p>
    </>
  );
}

// The five executive cards of the Clientes tab. A card with onClickFilter applies that scope to the tab.
export function KpiStrip({ cards, onFilter }: { cards: KpiCardData[]; onFilter: (patch: Partial<ClientesParams>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map(card => {
        const cls = 'bg-white border border-gray-300 rounded-lg shadow-sm p-4 text-left';
        return card.onClickFilter ? (
          <button key={card.id} type="button" className={`${cls} hover:bg-gray-50`} onClick={() => onFilter(card.onClickFilter as Partial<ClientesParams>)}>
            <Card card={card} />
          </button>
        ) : (
          <div key={card.id} className={cls}><Card card={card} /></div>
        );
      })}
    </div>
  );
}
