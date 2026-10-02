'use client';

import { useId, useMemo, useRef, useState } from 'react';
import type { FilterOption, GridData, GridRow } from '@/lib/pricing/client-types';
import SearchableSelect from '@/lib/components/searchable-select';
import {
  parseDecimalInput,
  parsePercentInput,
  percentFromPrice,
  priceFromPercent,
} from '@/lib/pricing/rates-math';
import {
  newDeltaPct,
  pendingChanges,
  referenceFor,
  visibleDraft,
  visibleRows,
  rowIdentityKey,
  type CellDraft,
  type BulkOp,
  type Staged,
} from '@/lib/pricing/rates-staging';

const NUM = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => NUM.format(n);
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const BTN = `min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const INPUT = `min-h-[44px] w-28 rounded-md border px-2 py-1.5 text-right text-sm tabular-nums disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${FOCUS}`;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}` : iso;
}

export interface RatesGridProps {
  data: GridData | null;
  loading: boolean;
  error: string | null;
  staged: Staged;
  onStage: (coArt: string, monto: number | null) => void;
  selected: Set<string>;
  onToggle: (coArt: string) => void;
  onToggleAll: (visible: string[], all: boolean) => void;
  compareTo: string | null;
  compareOptions: FilterOption[];
  onCompareChange: (v: string | null) => void;
  effectiveFrom: string;
  onEffectiveFromChange: (v: string) => void;
  canEdit: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  showUnpriced: boolean;
  onShowUnpricedChange: (v: boolean) => void;
  onBulk: (op: BulkOp) => void;
  onClear: () => void;
  onApply: () => void;
  onClone: () => void;
  onExport: () => void;
  /** Parent increments this on Descartar/Apply/list switch to remount (reset) every cell draft. */
  discardNonce: number;
}

interface CellProps {
  row: GridRow;
  staged: Staged;
  onStage: (coArt: string, monto: number | null) => void;
  readOnly: boolean;
}

function PriceCell({ row, staged, onStage, readOnly }: CellProps) {
  const errId = useId();
  const [rawDraft, setDraft] = useState<CellDraft | null>(null);
  const [rawError, setError] = useState(false);
  const price = staged[row.coArt];
  const draft = visibleDraft(rawDraft, price);
  const error = rawError && draft !== null;
  const shown = draft ?? (price !== undefined ? fmt(price) : '');

  function commit() {
    if (draft === null) return;
    const text = draft;
    if (text.trim() === '') {
      onStage(row.coArt, null);
      setError(false);
    } else {
      const n = parseDecimalInput(text);
      if (n === null || !(n > 0)) {
        setError(true);
        return;
      }
      onStage(row.coArt, n);
      setError(false);
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
        onChange={e => { setDraft({ text: e.target.value, base: price ?? null }); setError(false); }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(null); setError(false); }
        }}
        className={`${INPUT} ${error ? 'border-red-500' : 'border-gray-300'} ${price !== undefined ? 'bg-amber-50' : ''}`}
      />
      {error && <span id={errId} className="text-xs text-red-700">Precio inválido</span>}
      {price !== undefined && !error && <span className="text-xs font-medium text-amber-800">editado</span>}
    </div>
  );
}

function PctCell({ row, staged, onStage, readOnly }: CellProps) {
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

type BulkKind = 'plus' | 'minus' | 'set';

function BulkBar({ count, onBulk }: { count: number; onBulk: (op: BulkOp) => void }) {
  const [open, setOpen] = useState<BulkKind | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});

  function submit() {
    if (!open) return;
    if (open === 'set') {
      const n = parseDecimalInput(text);
      if (n === null || !(n > 0)) { setError(true); return; }
      onBulk({ type: 'set', monto: n });
    } else {
      const n = parsePercentInput(text);
      if (n === null || !(n > 0)) { setError(true); return; }
      onBulk({ type: 'percent', pct: open === 'plus' ? n : -n });
    }
    setOpen(null);
    setText('');
    setError(false);
  }

  function toggle(kind: BulkKind) {
    setOpen(prev => (prev === kind ? null : kind));
    setText('');
    setError(false);
  }

  const labels: Record<BulkKind, string> = { plus: '+ %', minus: '− %', set: 'Fijar precio' };

  return (
    <div role="group" aria-label="Acciones masivas" className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
      <span className="text-sm font-medium text-gray-900">{count} seleccionados</span>
      {(['plus', 'minus', 'set'] as BulkKind[]).map(k => (
        <button key={k} ref={el => { triggers.current[k] = el; }} type="button" aria-pressed={open === k} onClick={() => toggle(k)} className={BTN}>
          {labels[k]}
        </button>
      ))}
      {open && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            aria-label={open === 'set' ? 'Precio a fijar' : open === 'plus' ? 'Porcentaje a sumar' : 'Porcentaje a restar'}
            aria-invalid={error || undefined}
            value={text}
            onChange={e => { setText(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { const k = open; setOpen(null); triggers.current[k]?.focus(); } }}
            className={`min-h-[44px] w-24 rounded-md border px-2 py-1.5 text-right text-sm ${FOCUS} ${error ? 'border-red-500' : 'border-gray-300'}`}
          />
          <button type="button" onClick={submit} className={`min-h-[44px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 ${FOCUS}`}>
            Aplicar a selección
          </button>
          {error && <span role="alert" className="text-xs text-red-700">Valor inválido</span>}
        </div>
      )}
    </div>
  );
}

export default function RatesGrid(props: RatesGridProps) {
  const {
    data, loading, error, staged, onStage, selected, onToggle, onToggleAll, compareTo, compareOptions,
    onCompareChange, effectiveFrom, onEffectiveFromChange, canEdit, search, onSearchChange, category,
    onCategoryChange, showUnpriced, onShowUnpricedChange, onBulk, onClear, onApply, onClone, onExport, discardNonce,
  } = props;

  const rows = useMemo(
    () =>
      visibleRows(data?.rows ?? [], { search, category, showUnpriced, staged })
        .slice()
        .sort((a, b) => a.artDes.localeCompare(b.artDes, 'es')),
    [data, search, category, showUnpriced, staged],
  );
  const categories = useMemo<FilterOption[]>(() => {
    const set = new Set<string>();
    for (const r of data?.rows ?? []) if (r.catDes) set.add(r.catDes);
    return [...set].sort((a, b) => a.localeCompare(b, 'es')).map(c => ({ value: c, label: c }));
  }, [data]);
  const pending = useMemo(() => pendingChanges(staged, data?.rows ?? []).length, [staged, data]);

  const selectable = rows.filter(r => !r.ambiguous).map(r => r.coArt);
  const allSelected = selectable.length > 0 && selectable.every(c => selected.has(c));

  return (
    <section aria-label="Tarifas de la lista" className="flex min-w-0 flex-col gap-3">
      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">
          {data ? `${data.list.coPrecio} · ${data.list.desPrecio} · ${data.list.coMone ?? 'Sin moneda'}` : 'Tarifas'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onClone} disabled={!data || !canEdit} className={BTN}>Clonar</button>
          <button type="button" onClick={onExport} disabled={!data} className={BTN}>Exportar</button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Comparar con:</span>
          <SearchableSelect
            value={compareTo}
            onChange={onCompareChange}
            options={compareOptions}
            allLabel="Tarifa anterior"
            ariaLabel="Comparar con"
            className="w-56"
          />
        </div>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Vigente desde:
          <input
            type="date"
            value={effectiveFrom}
            min={todayIso()}
            onChange={e => onEffectiveFromChange(e.target.value)}
            disabled={!canEdit}
            className={`min-h-[44px] rounded-md border border-gray-300 px-2 text-sm disabled:bg-gray-100 ${FOCUS}`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <input
          type="search"
          aria-label="Buscar artículo"
          placeholder="Buscar artículo"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className={`min-h-[44px] w-64 rounded-md border border-gray-300 px-3 py-2 text-sm ${FOCUS}`}
        />
        <SearchableSelect
          value={category || null}
          onChange={v => onCategoryChange(v ?? '')}
          options={categories}
          allLabel="Todas las categorías"
          ariaLabel="Categoría"
          className="w-56"
        />
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showUnpriced}
            onChange={e => onShowUnpricedChange(e.target.checked)}
            className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`}
          />
          Mostrar artículos sin precio en esta lista
        </label>
      </div>

      {canEdit && selected.size > 0 && <BulkBar count={selected.size} onBulk={onBulk} />}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th scope="col" className="w-12 px-2">
                {canEdit && (
                  <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los artículos visibles"
                      checked={allSelected}
                      disabled={selectable.length === 0}
                      onChange={e => onToggleAll(selectable, e.target.checked)}
                      className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`}
                    />
                  </label>
                )}
              </th>
              <th scope="col" aria-sort="ascending" className="px-3 py-2">Artículo</th>
              <th scope="col" className="px-3 py-2 text-right">Vigente</th>
              <th scope="col" className="px-3 py-2 text-right">Δ%</th>
              <th scope="col" className="px-3 py-2 text-right">Nuevo</th>
              <th scope="col" className="px-3 py-2 text-right">Nuevo Δ%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [0, 1, 2, 3, 4].map(i => (
                <tr key={i} aria-hidden="true">
                  <td colSpan={6} className="px-3 py-2"><div className="h-8 animate-pulse rounded bg-gray-100" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                  {!data ? 'Selecciona una lista' : data.rows.length > 0 ? 'No hay artículos que coincidan con el filtro' : 'Esta lista no tiene tarifas'}
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const readOnly = !canEdit || r.ambiguous;
                const reference = referenceFor(r);
                const delta = compareTo === null || !r.current ? null : percentFromPrice(reference, r.current.monto);
                return (
                  <tr key={r.coArt} className={selected.has(r.coArt) ? 'bg-blue-50' : undefined}>
                    <td className="px-2">
                      {canEdit && (
                        <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${r.artDes}`}
                            checked={selected.has(r.coArt)}
                            disabled={r.ambiguous}
                            onChange={() => onToggle(r.coArt)}
                            className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`}
                          />
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">{r.coArt}</span>
                        <span className="font-medium text-gray-900">{r.artDes}</span>
                        {r.ambiguous && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">varios almacenes</span>
                        )}
                      </div>
                      {r.next && (
                        <div className="text-xs text-gray-500">próximo: ${fmt(r.next.monto)} desde {shortDate(r.next.desde)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.current ? fmt(r.current.monto) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {compareTo === null || delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta)}%`}
                    </td>
                    <td className="px-3 py-2"><PriceCell key={rowIdentityKey(r, discardNonce)} row={r} staged={staged} onStage={onStage} readOnly={readOnly} /></td>
                    <td className="px-3 py-2"><PctCell key={rowIdentityKey(r, discardNonce)} row={r} staged={staged} onStage={onStage} readOnly={readOnly} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-3 py-2">
        <span aria-live="polite" className="text-sm font-medium text-gray-900">
          {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'}
        </span>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClear} disabled={pending === 0} className={BTN}>Descartar</button>
            <button
              type="button"
              onClick={onApply}
              disabled={pending === 0}
              className={`min-h-[44px] rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-offset-2 ${FOCUS}`}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
