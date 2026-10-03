'use client';

import { useId, useState } from 'react';
import type { GridRow } from '@/lib/pricing/client-types';
import { parsePercentInput, parsePriceCell, priceFromPercent } from '@/lib/pricing/rates-math';
import { newDeltaPct, referenceFor, visibleDraft, type CellDraft, type Staged } from '@/lib/pricing/rates-staging';

const NUM = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt = (n: number) => NUM.format(n);
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
export const INPUT = `min-h-[44px] w-28 rounded-md border px-2 py-1.5 text-right text-sm tabular-nums disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${FOCUS}`;

export interface CellProps {
  row: GridRow;
  staged: Staged;
  onStage: (coArt: string, monto: number | null) => void;
  readOnly: boolean;
}

export function PriceCell({ row, staged, onStage, readOnly }: CellProps) {
  const errId = useId();
  const [rawDraft, setDraft] = useState<CellDraft | null>(null);
  const [rawError, setError] = useState<string | null>(null);
  const price = staged[row.coArt];
  const draft = visibleDraft(rawDraft, price);
  const error = rawError !== null && draft !== null;
  const shown = draft ?? (price !== undefined ? fmt(price) : '');

  function commit() {
    if (draft === null) return;
    const text = draft;
    if (text.trim() === '') {
      onStage(row.coArt, null);
      setError(null);
    } else {
      const parsed = parsePriceCell(text);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      onStage(row.coArt, parsed.value);
      setError(null);
    }
    setDraft(null);
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Nuevo precio de ${row.artDes}`}
        aria-invalid={error || undefined}
        aria-describedby={error ? errId : undefined}
        disabled={readOnly}
        value={shown}
        placeholder="—"
        onChange={e => { setDraft({ text: e.target.value, base: price ?? null }); setError(null); }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(null); setError(null); }
        }}
        className={`${INPUT} ${error ? 'border-red-500' : 'border-gray-300'} ${price !== undefined ? 'bg-amber-50' : ''}`}
      />
      {error && <span id={errId} className="text-xs text-red-700">{rawError}</span>}
      {price !== undefined && !error && <span className="text-xs font-medium text-amber-800">editado</span>}
    </div>
  );
}

export function PctCell({ row, staged, onStage, readOnly }: CellProps) {
  const errId = useId();
  const hintId = useId();
  const [rawDraft, setDraft] = useState<CellDraft | null>(null);
  const [rawError, setError] = useState(false);
  const reference = referenceFor(row);
  const price = staged[row.coArt];
  const draft = visibleDraft(rawDraft, price);
  const error = rawError && draft !== null;
  const pct = newDeltaPct(row, staged);
  const shown = draft ?? (pct !== null ? fmt(pct) : '');

  function commit() {
    if (draft === null || reference === null) return;
    if (draft.trim() === '') {
      onStage(row.coArt, null);
      setError(false);
      setDraft(null);
      return;
    }
    const n = parsePercentInput(draft);
    const next = n === null ? null : priceFromPercent(reference, n);
    if (next === null || !(next > 0)) {
      setError(true);
      return;
    }
    onStage(row.coArt, next);
    setError(false);
    setDraft(null);
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Nuevo Δ% de ${row.artDes}`}
        aria-invalid={error || undefined}
        aria-describedby={error ? errId : price !== undefined && draft === null ? hintId : undefined}
        disabled={readOnly || reference === null}
        title={reference === null ? 'Sin precio de referencia' : undefined}
        value={shown}
        placeholder="—"
        onChange={e => { setDraft({ text: e.target.value, base: price ?? null }); setError(false); }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(null); setError(false); }
        }}
        className={`${INPUT} w-24 ${error ? 'border-red-500' : 'border-gray-300'} ${price !== undefined ? 'bg-amber-50' : ''}`}
      />
      {error && <span id={errId} className="text-xs text-red-700">Porcentaje inválido</span>}
      <span id={hintId} className="sr-only">(derivado)</span>
    </div>
  );
}
