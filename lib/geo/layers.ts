import type { MapCustomer } from './types';

// [lat, lng, weight] for leaflet.heat — located customers with revenue only.
export function heatPoints(customers: MapCustomer[]): [number, number, number][] {
  return customers
    .filter(c => c.lat !== null && c.lng !== null && c.revenueUsd !== null && c.revenueUsd > 0)
    .map(c => [c.lat!, c.lng!, c.revenueUsd!]);
}
