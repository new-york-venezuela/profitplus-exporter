import type { Currency } from '../types';

export function money(n: number, currency: Currency = 'bs', rate?: number): string {
  if (currency === 'usd' && rate) {
    n = n / rate;
  }
  const format = currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  return format.format(n);
}

export function moneyLabel(n: number, currency: Currency, rate?: number): string {
  return `${currency === 'usd' ? '$' : 'Bs. '}${money(n, currency, rate)}`;
}

export function moneyTooltip(value: unknown, currency: Currency = 'bs', rate?: number): string {
  const numVal = Number(Array.isArray(value) ? value[0] : value);
  return moneyLabel(numVal, currency, rate);
}
