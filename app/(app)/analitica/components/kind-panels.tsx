'use client';

import type { CustomerKind } from '@/lib/dwh/cutover';
import { STICKINESS_LABEL, type Stickiness } from '../lib/kind-kpis';

// Origen and constancia badges of the Clientes tab. Colours are never the only signal: every badge carries its label.
const KIND_STYLE: Record<'patrimonio' | 'nuevo', { chip: string; label: string }> = {
  patrimonio: { chip: 'bg-indigo-100 text-indigo-800', label: 'Patrimonio' },
  nuevo: { chip: 'bg-emerald-100 text-emerald-800', label: 'Nuevo' },
};
const STICKY_STYLE: Record<Stickiness, string> = {
  constante: 'bg-green-100 text-green-800',
  irregular: 'bg-amber-100 text-amber-800',
  perdido: 'bg-red-100 text-red-800',
  observacion: 'bg-blue-100 text-blue-800',
  sin_frecuencia: 'bg-gray-100 text-gray-600',
};

export function KindBadge({ kind }: { kind: CustomerKind | null }) {
  if (kind === null) return <span className="text-gray-400">—</span>;
  if (kind === 'posterior') return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Posterior</span>;
  const s = KIND_STYLE[kind];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.chip}`}>{s.label}</span>;
}

export function StickinessBadge({ value }: { value: Stickiness }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STICKY_STYLE[value]}`}>{STICKINESS_LABEL[value]}</span>;
}
