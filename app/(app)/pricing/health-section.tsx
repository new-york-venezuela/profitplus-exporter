'use client';
import type { ReactNode } from 'react';

interface Props { id: string; title: string; count: number | null; emptyText?: string; loading?: boolean; children: ReactNode }

/** Titled card with a count badge; shows the "Todo en orden" state when there is nothing to report. */
export default function HealthSection({ id, title, count, emptyText = 'Todo en orden', loading = false, children }: Props) {
  const headingId = `health-${id}`;
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 id={headingId} className="text-sm font-semibold text-gray-900">{title}</h3>
        {count !== null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
            {count}
          </span>
        )}
      </div>
      {loading ? (
        <div aria-busy="true" aria-label={`Cargando ${title}`} className="flex flex-col gap-2">
          {[0, 1].map(i => <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />)}
        </div>
      ) : count === 0 ? (
        <p className="text-sm text-green-700">{emptyText}</p>
      ) : children}
    </section>
  );
}
