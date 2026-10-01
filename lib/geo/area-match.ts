import { pointInPolygon } from './geometry';
import type { AreaDto } from './areas-repo';
import type { MapCustomer } from './types';

// Computed on every read: matches are never stored and never written to
// the ERP. Areas are tested in ascending id order so a customer exactly on
// a shared border resolves deterministically to the lowest id.
export function applyAreaMatch(customers: MapCustomer[], areas: AreaDto[]): MapCustomer[] {
  const ordered = [...areas].sort((a, b) => a.id - b.id);
  return customers.map(c => {
    if (c.lat === null || c.lng === null) return c;
    const area = ordered.find(a => pointInPolygon([c.lng!, c.lat!], a.ring));
    if (!area) return c;
    return {
      ...c,
      areaId: area.id,
      areaName: area.name,
      areaSellerCodes: area.sellerCodes,
      sellerMismatch: area.sellerCodes.length > 0 && !area.sellerCodes.includes(c.coVen),
    };
  });
}

export interface AreaStats { areaId: number; revenueUsd: number; customers: number }

export function areaRevenue(customers: MapCustomer[], areas: AreaDto[]): Map<number, AreaStats> {
  const stats = new Map<number, AreaStats>(areas.map(a => [a.id, { areaId: a.id, revenueUsd: 0, customers: 0 }]));
  for (const c of customers) {
    if (c.areaId === null) continue;
    const s = stats.get(c.areaId);
    if (!s) continue;
    s.revenueUsd += c.revenueUsd ?? 0;
    s.customers += 1;
  }
  return stats;
}
