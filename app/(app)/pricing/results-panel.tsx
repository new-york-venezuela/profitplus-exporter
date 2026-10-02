'use client';
import type { SegmentMoveResult } from '@/lib/pricing/client-types';

interface Props {
  results: SegmentMoveResult[];
  nameByCode: Record<string, string>;
  onRetry: (codes: string[]) => void;
  retrying?: boolean;
  onDismiss: () => void;
}

const GROUPS: { outcome: SegmentMoveResult['outcome']; title: string; box: string }[] = [
  { outcome: 'success', title: 'Éxito', box: 'border-green-200 bg-green-50 text-green-800' },
  { outcome: 'conflict', title: 'Conflicto', box: 'border-amber-200 bg-amber-50 text-amber-900' },
  { outcome: 'error', title: 'Error', box: 'border-red-200 bg-red-50 text-red-800' },
];

export default function ResultsPanel({ results, nameByCode, onRetry, onDismiss, retrying = false }: Props) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Resultado</h2>
        <button type="button" onClick={onDismiss}
          className="min-h-[44px] rounded-md px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Cerrar
        </button>
      </div>
      {GROUPS.map(g => {
        const items = results.filter(r => r.outcome === g.outcome);
        if (items.length === 0) return null;
        return (
          <section key={g.outcome} className={`rounded-md border px-3 py-2 ${g.box}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{g.title} ({items.length})</h3>
              {g.outcome === 'conflict' && (
                <button type="button" onClick={() => onRetry(items.map(i => i.coCli))} disabled={retrying}
                  className="min-h-[44px] rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  {retrying ? 'Reintentando…' : 'Reintentar'}
                </button>
              )}
            </div>
            <ul className="mt-1 text-sm">
              {items.map(i => (
                <li key={i.coCli}>
                  {nameByCode[i.coCli] ?? i.coCli}
                  {i.message && <span className="opacity-80"> — {i.message}</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
