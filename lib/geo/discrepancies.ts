import type { MapCustomer } from './types';

export interface Discrepancies { mismatched: MapCustomer[]; outside: MapCustomer[] }

export function findDiscrepancies(customers: MapCustomer[], hasAreas: boolean): Discrepancies {
  return {
    mismatched: customers.filter(c => c.sellerMismatch),
    outside: hasAreas ? customers.filter(c => c.lat !== null && c.areaId === null) : [],
  };
}
