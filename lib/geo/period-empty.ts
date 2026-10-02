import type { MapCustomer } from './types';

// True when customers loaded but none has revenue in the selected period.
// A customer with Bs sales but no exchange rate (revenueUsd null) still counts
// as revenue: the period is not empty, only the USD conversion is missing.
export function hasNoRevenue(customers: Pick<MapCustomer, 'revenueUsd' | 'revenueBs'>[]): boolean {
  return customers.length > 0 && customers.every(c => !c.revenueUsd && !c.revenueBs);
}
