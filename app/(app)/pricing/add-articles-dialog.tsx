'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import type { GridRow } from '@/lib/pricing/client-types';
import { parseDecimalInput } from '@/lib/pricing/rates-math';
import { addableRows, type Staged } from '@/lib/pricing/rates-staging';
import { FOCUS, INPUT } from './dialog-parts';

const MAX_SHOWN = 100;
const BTN = `min-h-[44px] rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

interface Props {
  rows: GridRow[];
  staged: Staged;
  /** Retail-article warehouse; null when the scope is off (every article is offered). */
  scope: { coAlma: string } | null;
  /** True when a comparison list supplies `referenceMonto` for the rows. */
  hasReference: boolean;
  onAdd: (items: { coArt: string; monto: number }[]) => void;
  onClose: () => void;
}

const refText = (n: number | null) => (n === null ? '' : String(n));

export default function AddArticlesDialog({ rows, staged, scope, hasReference, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [includeOut, setIncludeOut] = useState(false);
  // coArt -> price text; a key's presence means the article is ticked.
  const [picked, setPicked] = useState<Record<string, string>>({});

  const candidates = useMemo(
    () => addableRows(rows, { search, includeOutOfScope: includeOut, staged }),
    [rows, search, includeOut, staged],
  );
  const shown = candidates.slice(0, MAX_SHOWN);
  const byArt = useMemo(() => new Map(rows.map(r => [r.coArt, r])), [rows]);

  const parsed = Object.entries(picked).map(([coArt, text]) => ({ coArt, monto: parseDecimalInput(text) }));
  const allValid = parsed.length > 0 && parsed.every(p => p.monto !== null && p.monto > 0);

  function toggle(r: GridRow) {
    setPicked(p => {
      const next = { ...p };
      if (r.coArt in next) delete next[r.coArt];
      else next[r.coArt] = hasReference ? refText(r.referenceMonto) : '';
      return next;
    });
  }

  function submit() {
    if (!allValid) return;
    onAdd(parsed.map(p => ({ coArt: p.coArt, monto: p.monto as number })));
    onClose();
  }

  return (
    <Modal title="Agregar artículos a la lista" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="flex flex-col gap-3">
        <input
          type="search" autoFocus aria-label="Buscar artículo" placeholder="Buscar artículo por código o nombre"
          value={search} onChange={e => setSearch(e.target.value)} className={INPUT}
        />
        {scope && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={includeOut} onChange={e => setIncludeOut(e.target.checked)} className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
            Incluir artículos fuera del almacén {scope.coAlma} (materia prima, etc.)
          </label>
        )}
        <p className="text-xs text-gray-600">
          {candidates.length} artículo{candidates.length === 1 ? '' : 's'} sin precio en esta lista
          {scope && !includeOut ? ` · solo almacén ${scope.coAlma}` : ''}.
          {candidates.length > MAX_SHOWN && ` Mostrando ${MAX_SHOWN}; refine la búsqueda.`}
        </p>

        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200" aria-label="Artículos disponibles">
          {shown.length === 0 && <li className="px-3 py-4 text-sm text-gray-500">Ningún artículo coincide.</li>}
          {shown.map(r => {
            const on = r.coArt in picked;
            return (
              <li key={r.coArt} className="flex min-h-[44px] items-center gap-3 px-3 py-1.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" checked={on} onChange={() => toggle(r)} className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
                  <span className="truncate"><span className="font-mono text-xs text-gray-500">{r.coArt}</span> {r.artDes}</span>
                </label>
                {on && (
                  <input
                    type="text" inputMode="decimal" aria-label={`Precio de ${r.artDes}`} placeholder="Precio"
                    value={picked[r.coArt]} onChange={e => setPicked(p => ({ ...p, [r.coArt]: e.target.value }))}
                    className={`min-h-[44px] w-24 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm ${FOCUS}`}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {Object.keys(picked).some(c => !shown.some(r => r.coArt === c)) && (
          <p className="text-xs text-gray-600">
            También seleccionados fuera del filtro actual: {Object.keys(picked).filter(c => !shown.some(r => r.coArt === c)).map(c => byArt.get(c)?.artDes ?? c).join(', ')}.
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-gray-600">Los precios quedan en borrador hasta que pulse «Aplicar».</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${BTN} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>Cancelar</button>
            <button type="submit" disabled={!allValid} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
              Agregar {parsed.length > 0 ? parsed.length : ''}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
