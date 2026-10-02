'use client';
import { useCallback, useState } from 'react';
import { Modal } from '@/components/modal';
import type { ApplyResult } from '@/lib/pricing/client-types';
import { percentFromPrice } from '@/lib/pricing/rates-math';
import { todayIso } from '@/lib/pricing/dates';
import { ErrorBox, FOCUS, useSubmit } from './dialog-parts';

export interface ApplyChange { coArt: string; artDes: string; before: number | null; after: number }

interface Props {
  changes: ApplyChange[];
  effectiveFrom: string;
  onConfirm: () => Promise<ApplyResult[]>;
  /** Closes the dialog and reloads the grid keeping the staged edits (so conflicts show the fresh price). */
  onReload: () => void;
  onClose: () => void;
}

const NUM = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BTN = `min-h-[44px] rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const GROUPS: { outcomes: ApplyResult['outcome'][]; title: string; box: string }[] = [
  { outcomes: ['success'], title: 'Éxito', box: 'border-green-200 bg-green-50 text-green-800' },
  { outcomes: ['skipped'], title: 'Omitido', box: 'border-gray-200 bg-gray-50 text-gray-800' },
  { outcomes: ['conflict'], title: 'Conflicto', box: 'border-amber-200 bg-amber-50 text-amber-900' },
  { outcomes: ['rejected', 'error'], title: 'Rechazado', box: 'border-red-200 bg-red-50 text-red-800' },
];

const STALE_MSG = 'El precio cambió desde que cargaste la lista';

export default function ApplyDialog({ changes, effectiveFrom, onConfirm, onReload, onClose }: Props) {
  const [results, setResults] = useState<ApplyResult[] | null>(null);
  const scheduled = effectiveFrom > todayIso();
  const nameByCode = new Map(changes.map(c => [c.coArt, c.artDes]));

  const first = useSubmit(useCallback(async () => { setResults(await onConfirm()); }, [onConfirm]));

  const busy = first.submitting;
  const close = () => { if (!busy) onClose(); };

  return (
    <Modal title="Aplicar cambios de precio" onClose={close}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">
          Vigente desde <strong>{effectiveFrom.split('-').reverse().join('/')}</strong>
          {scheduled && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Programado</span>}
        </p>

        {results === null ? (
          <>
            <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <tr>
                    <th scope="col" className="px-2 py-1.5">Artículo</th>
                    <th scope="col" className="px-2 py-1.5 text-right">Antes</th>
                    <th scope="col" className="px-2 py-1.5 text-right">Después</th>
                    <th scope="col" className="px-2 py-1.5 text-right">Δ%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {changes.map(c => {
                    const d = c.before === null ? null : percentFromPrice(c.before, c.after);
                    return (
                      <tr key={c.coArt}>
                        <td className="px-2 py-1.5">{c.artDes}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{c.before === null ? '—' : NUM.format(c.before)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{NUM.format(c.after)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{d === null ? '—' : `${d > 0 ? '+' : ''}${NUM.format(d)}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {first.error && <ErrorBox>{first.error.message}</ErrorBox>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className={`${BTN} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>Cancelar</button>
              <button type="button" disabled={busy} onClick={() => void first.run()} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
                {first.submitting ? 'Aplicando…' : `Confirmar ${changes.length} ${changes.length === 1 ? 'cambio' : 'cambios'}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div role="status" aria-live="polite" className="flex flex-col gap-2">
              {GROUPS.map(g => {
                const items = results.filter(r => g.outcomes.includes(r.outcome));
                if (items.length === 0) return null;
                return (
                  <section key={g.title} className={`rounded-md border px-3 py-2 ${g.box}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{g.title} ({items.length})</h3>
                      {g.title === 'Conflicto' && (
                        <button type="button" disabled={busy} onClick={onReload}
                          className={`min-h-[44px] rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
                          Recargar y revisar
                        </button>
                      )}
                    </div>
                    <ul className="mt-1 text-sm">
                      {items.map(i => (
                        <li key={i.coArt}>
                          {nameByCode.get(i.coArt) ?? i.coArt}
                          {(i.message || i.outcome === 'conflict') && <span className="opacity-80"> — {i.message ?? STALE_MSG}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
            {first.error && <ErrorBox>{first.error.message}</ErrorBox>}
            <div className="flex justify-end">
              <button type="button" disabled={busy} onClick={onClose} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
