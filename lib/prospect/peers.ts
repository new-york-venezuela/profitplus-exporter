import type { LatLng } from '../geo/coordinates';
import { distanceKm, nearestRoutes, routeCentroids } from './geo';

export const MIN_PEERS = 5;
const NEAR_ROUTES = 2;

export interface PeerCandidate {
  code: string;
  name: string;
  typeCode: string;
  routeNumber: number | null;
  point: LatLng | null;
  weeklyUnits: number;
}

export type PeerTier = 'type_route' | 'type_near_routes' | 'type_all';

export function selectPeers(
  candidates: PeerCandidate[],
  q: { typeCode: string; routeNumber: number; pin: LatLng | null },
): { tier: PeerTier; peers: PeerCandidate[] } {
  const sameType = candidates.filter((c) => c.typeCode === q.typeCode);
  const order = (peers: PeerCandidate[]) => [...peers].sort((a, b) => {
    const ra = a.routeNumber === q.routeNumber ? 0 : 1;
    const rb = b.routeNumber === q.routeNumber ? 0 : 1;
    if (ra !== rb) return ra - rb;
    if (q.pin) {
      if (!a.point !== !b.point) return a.point ? -1 : 1;
      if (a.point && b.point) {
        const d = distanceKm(q.pin, a.point) - distanceKm(q.pin, b.point);
        if (d !== 0) return d;
      }
    } else if (a.weeklyUnits !== b.weeklyUnits) {
      return b.weeklyUnits - a.weeklyUnits;
    }
    return a.code.localeCompare(b.code);
  });

  const onRoute = sameType.filter((c) => c.routeNumber === q.routeNumber);
  if (onRoute.length >= MIN_PEERS) return { tier: 'type_route', peers: order(onRoute) };

  const centroids = routeCentroids(sameType);
  const from = q.pin ?? centroids.get(q.routeNumber) ?? null;
  if (from) {
    const others = new Map(centroids);
    others.delete(q.routeNumber);
    const near = new Set(nearestRoutes(from, others, NEAR_ROUTES));
    const wide = sameType.filter(
      (c) => c.routeNumber === q.routeNumber || (c.routeNumber != null && near.has(c.routeNumber)),
    );
    if (wide.length >= MIN_PEERS) return { tier: 'type_near_routes', peers: order(wide) };
  }
  return { tier: 'type_all', peers: order(sameType) };
}
