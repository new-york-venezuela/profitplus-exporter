'use client';

import { useMemo, useState } from 'react';
import type { SegmentDto } from '@/lib/pricing/client-types';
import { segmentBadge, type BadgeTone } from './segment-badge';

const TONE_CLASS: Record<BadgeTone, string> = {
  none: '',
  ok: 'bg-gray-100 text-gray-700',
  warn: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
};

interface SegmentRailProps {
  segments: SegmentDto[];
  selected: string | null;
  onSelect: (tipCli: string) => void;
  onNew: () => void;
  canEdit: boolean;
  loading: boolean;
}

export default function SegmentRail({ segments, selected, onSelect, onNew, canEdit, loading }: SegmentRailProps) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? segments.filter(s => s.desTipo.toLowerCase().includes(q) || s.tipCli.toLowerCase().includes(q))
      : segments;
    const groups = filtered.filter(s => s.kind !== 'special');
    const specials = filtered
      .filter(s => s.kind === 'special')
      .sort((a, b) => (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER));
    return [...groups, ...specials];
  }, [segments, query]);

  return (
    <nav aria-label="Segmentos" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Segmentos</h2>
        {canEdit && (
          <button
            type="button"
            onClick={onNew}
            className="min-h-[44px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            + Nuevo
          </button>
        )}
      </div>
      <input
        type="search"
        aria-label="Buscar segmento"
        placeholder="Buscar segmento"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      />
      {loading ? (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando segmentos">
          {[0, 1, 2, 3].map(i => (
            <li key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">No hay segmentos</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {visible.map(s => {
            const isSelected = s.tipCli === selected;
            const badge = segmentBadge(s);
            return (
              <li key={s.tipCli}>
                <button
                  type="button"
                  onClick={() => onSelect(s.tipCli)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`flex min-h-[44px] w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{s.desTipo}</span>
                    <span className="block text-xs text-gray-500">{s.coPrecio} · {s.customerCount}</span>
                  </span>
                  {badge.tone !== 'none' && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[badge.tone]}`}>
                      {badge.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
