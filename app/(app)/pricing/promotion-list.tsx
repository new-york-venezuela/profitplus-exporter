'use client';

import type { PromotionDto } from '@/lib/pricing/client-types';
import { promoStatusBadge } from './promo-status-badge';
import { fmtShort, TONE_CLASS } from './promo-format';

const GROUPS: { status: PromotionDto['status']; title: string }[] = [
  { status: 'active', title: 'Activas' },
  { status: 'scheduled', title: 'Programadas' },
  { status: 'ended', title: 'Terminadas' },
  { status: 'cancelled', title: 'Canceladas' },
];

interface Props {
  promotions: PromotionDto[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
  error: string | null;
  onNew: () => void;
  canEdit: boolean;
}

export default function PromotionList({ promotions, selectedId, onSelect, loading, error, onNew, canEdit }: Props) {
  return (
    <nav aria-label="Promociones" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Promociones</h2>
        {canEdit && (
          <button type="button" onClick={onNew}
            className="min-h-[44px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            + Nueva promoción
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando promociones">
          {[0, 1, 2, 3].map(i => <li key={i} className="h-16 animate-pulse rounded-md bg-gray-100" />)}
        </ul>
      ) : promotions.length === 0 ? (
        !error && <p className="text-sm text-gray-500">No hay promociones</p>
      ) : (
        GROUPS.map(g => {
          const rows = promotions.filter(p => p.status === g.status);
          if (rows.length === 0) return null;
          return (
            <section key={g.status} aria-label={g.title} className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{g.title} ({rows.length})</h3>
              <ul className="flex flex-col gap-1">
                {rows.map(p => {
                  const badge = promoStatusBadge(p);
                  const isSelected = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => onSelect(p.id)} aria-current={isSelected ? 'true' : undefined}
                        className={`flex min-h-[44px] w-full flex-col gap-1 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                        }`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium text-gray-900">{p.name}</span>
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                            {p.kind === 'segment' ? 'Segmento' : 'Lista'}
                          </span>
                        </span>
                        <span className="truncate text-xs text-gray-500">
                          {p.kind === 'segment' ? (p.tipCli ?? p.coPrecio) : `${p.coPrecio}${p.desPrecio ? ` · ${p.desPrecio}` : ''}`}
                        </span>
                        <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span>{fmtShort(p.startsOn)} – {fmtShort(p.endsOn)} · {p.itemCount} {p.itemCount === 1 ? 'artículo' : 'artículos'}</span>
                          <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_CLASS[badge.tone]}`}>{badge.label}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </nav>
  );
}
