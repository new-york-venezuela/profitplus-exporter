import type { Currency, DualAmount } from '../types';

export function money(amount: DualAmount, currency: Currency = 'bs'): string {
  const n = currency === 'usd' ? amount.usd : amount.bs;
  if (n === null) return '—';
  const format = currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  return format.format(n);
}

export function moneyLabel(amount: DualAmount, currency: Currency): string {
  const n = currency === 'usd' ? amount.usd : amount.bs;
  if (n === null) return '—';
  return `${currency === 'usd' ? '$' : 'Bs. '}${money(amount, currency)}`;
}

// Recharts already hands this a single already-selected number (the chart's
// data-mapping step picks .bs/.usd before the chart renders — see every
// tab's chartData useMemo) — this formats that bare number/array, it does
// not itself pick a DualAmount side.
export function moneyTooltip(value: unknown, currency: Currency = 'bs'): string {
  const numVal = Number(Array.isArray(value) ? value[0] : value);
  return `${currency === 'usd' ? '$' : 'Bs. '}${(currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 })
  ).format(numVal)}`;
}
