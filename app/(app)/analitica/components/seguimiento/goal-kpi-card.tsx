import type { ReactNode } from 'react';

// One anatomy for every "result vs goal" KPI (sales, units): label, headline value, a bar with the goal marker
// and projection (the bar prints actual / Meta / Proy. as text, so colour is never the only signal), then muted notes.
export function GoalKpiCard({ label, value, bar, notes }: {
  label: string;
  value: string;
  bar: ReactNode;
  notes?: (string | null | undefined | false)[];
}) {
  const lines = (notes ?? []).filter((n): n is string => !!n);
  return (
    <section aria-label={label} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className="pt-2">{bar}</div>
      {lines.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-0.5 border-t border-gray-100 pt-2">
          {lines.map(l => <li key={l}>{l}</li>)}
        </ul>
      )}
    </section>
  );
}
