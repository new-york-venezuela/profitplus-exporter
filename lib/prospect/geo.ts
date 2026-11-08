import type { LatLng } from '../geo/coordinates';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface LocatedCustomer { routeNumber: number | null; point: LatLng | null }

export function routeCentroids(customers: LocatedCustomer[]): Map<number, LatLng> {
  const sums = new Map<number, { lat: number; lng: number; n: number }>();
  for (const c of customers) {
    if (c.routeNumber == null || !c.point) continue;
    const s = sums.get(c.routeNumber) ?? { lat: 0, lng: 0, n: 0 };
    s.lat += c.point.lat;
    s.lng += c.point.lng;
    s.n += 1;
    sums.set(c.routeNumber, s);
  }
  const out = new Map<number, LatLng>();
  for (const [route, s] of sums) out.set(route, { lat: s.lat / s.n, lng: s.lng / s.n });
  return out;
}

export function nearestRoutes(point: LatLng, centroids: Map<number, LatLng>, n: number): number[] {
  return [...centroids.entries()]
    .map(([route, c]) => ({ route, d: distanceKm(point, c) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, n))
    .map((r) => r.route);
}

export function suggestRoute(point: LatLng, customers: LocatedCustomer[], k = 3): number | null {
  const near: { route: number; d: number }[] = [];
  for (const c of customers) {
    if (c.routeNumber == null || !c.point) continue;
    near.push({ route: c.routeNumber, d: distanceKm(point, c.point) });
  }
  near.sort((a, b) => a.d - b.d);
  const top = near.slice(0, k);
  if (top.length === 0) return null;
  const counts = new Map<number, number>();
  for (const t of top) counts.set(t.route, (counts.get(t.route) ?? 0) + 1);
  const max = Math.max(...counts.values());
  // top is sorted nearest-first, so the first route reaching max is the nearest among ties
  return top.find((t) => counts.get(t.route) === max)!.route;
}
