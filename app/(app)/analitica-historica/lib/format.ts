import type { Currency, DualAmount } from '../types';
import { moneyLabel } from '../../analitica/lib/format';

// A null amount in the active currency (USD with no exchange rate) is "Sin
// datos" — never "$0" and never a bare dash.
export function histMoney(amount: DualAmount, currency: Currency): string {
  const n = currency === 'usd' ? amount.usd : amount.bs;
  return n === null ? 'Sin datos' : moneyLabel(amount, currency);
}
