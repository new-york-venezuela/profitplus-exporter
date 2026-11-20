import { ESTADO_LABEL, type Estado } from '@/lib/clientes/estado';

// Colour is never the only signal: every badge carries its label.
const STYLE: Record<Estado, string> = {
  nuevo_periodo: 'bg-emerald-100 text-emerald-900',
  retenido: 'bg-green-100 text-green-900',
  recuperado: 'bg-blue-100 text-blue-900',
  enfriado: 'bg-amber-100 text-amber-900',
  perdido: 'bg-red-100 text-red-900',
  sin_ventas: 'bg-gray-100 text-gray-800',
};

export function EstadoBadge({ estado }: { estado: Estado }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STYLE[estado]}`}>{ESTADO_LABEL[estado]}</span>;
}
