'use client';

import type { ParetoClass } from '@/lib/productos/pareto';

const TONE: Record<ParetoClass, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  B: 'bg-slate-100 text-slate-700 border-slate-200',
  C: 'bg-white text-gray-500 border-gray-200',
};

// Null = no class (e.g. no USD value in USD mode): a dash, never a guessed class.
export default function ParetoBadge({ value }: { value: ParetoClass | null }) {
  if (value === null) return <span className="text-gray-400">—</span>;
  return (
    <span
      title={`Clase Pareto ${value}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-semibold ${TONE[value]}`}
    >
      {value}
    </span>
  );
}
