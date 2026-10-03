import type { PromoTone } from './promo-status-badge';

export const TONE_CLASS: Record<PromoTone, string> = {
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
  muted: 'bg-gray-100 text-gray-600',
  info: 'bg-blue-100 text-blue-800',
};

/** yyyy-mm-dd -> dd/mm/yyyy */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** yyyy-mm-dd -> dd/mm */
export function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function fmtMoney(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
