import { sellerKey } from './codes';
import { routeZoneCode } from './route-zones';

// No seller x route table: a route's owner is derived from the sellers of its customers.
// The real world is 1 route -> 1 seller; anything else is reported, never silently accepted.

export interface OwnerInput { coCli: string; coVen: string; ruta: number | null }

export interface RouteOwner {
  route: number;
  zone: string;
  owner: string | null;                       // null on a tie or when no customer has a seller
  tie: boolean;
  customers: number;
  bySeller: { coVen: string; n: number }[];   // n desc, then code
}

export function deriveRouteOwners(rows: readonly OwnerInput[]): RouteOwner[] {
  const byRoute = new Map<number, OwnerInput[]>();
  for (const row of rows) {
    if (row.ruta == null) continue;
    const list = byRoute.get(row.ruta);
    if (list) list.push(row); else byRoute.set(row.ruta, [row]);
  }
  const out: RouteOwner[] = [];
  for (const [route, list] of [...byRoute].sort((a, b) => a[0] - b[0])) {
    const counts = new Map<string, { coVen: string; n: number }>();
    for (const row of list) {
      const code = row.coVen.trim();
      if (!code) continue;
      const key = sellerKey(code);
      const entry = counts.get(key);
      if (entry) entry.n++; else counts.set(key, { coVen: code, n: 1 });
    }
    const bySeller = [...counts.values()].sort((a, b) => b.n - a.n || a.coVen.localeCompare(b.coVen));
    const tie = bySeller.length > 1 && bySeller[1].n === bySeller[0].n;
    out.push({
      route, zone: routeZoneCode(route),
      owner: bySeller.length > 0 && !tie ? bySeller[0].coVen : null,
      tie, customers: list.length, bySeller,
    });
  }
  return out;
}

export type CoherenceKind = 'missing_route' | 'missing_seller' | 'route_without_owner' | 'seller_not_route_owner';

export interface CoherenceIssue {
  kind: CoherenceKind;
  coCli: string;
  ruta: number | null;
  coVen: string;
  owner: string | null;
  detail: string;
}

export function checkCoherence(rows: readonly OwnerInput[]): CoherenceIssue[] {
  const owners = new Map(deriveRouteOwners(rows).map(o => [o.route, o]));
  const issues: CoherenceIssue[] = [];
  for (const row of rows) {
    const coVen = row.coVen.trim();
    const base = { coCli: row.coCli, ruta: row.ruta, coVen };
    if (row.ruta == null) {
      issues.push({ ...base, kind: 'missing_route', owner: null, detail: 'sin ruta' });
    }
    if (!coVen) {
      issues.push({ ...base, kind: 'missing_seller', owner: null, detail: 'sin vendedor' });
    }
    if (row.ruta == null || !coVen) continue;
    const route = owners.get(row.ruta)!;
    if (route.owner == null) {
      issues.push({
        ...base, kind: 'route_without_owner', owner: null,
        detail: `ruta ${row.ruta} sin dueño (${route.bySeller.map(s => `${s.coVen}:${s.n}`).join(', ')}); deje un solo vendedor en la ruta`,
      });
    } else if (sellerKey(coVen) !== sellerKey(route.owner)) {
      issues.push({
        ...base, kind: 'seller_not_route_owner', owner: route.owner,
        detail: `vendedor ${coVen}, pero el dueño de la ruta ${row.ruta} es ${route.owner}`,
      });
    }
  }
  return issues;
}

// Gives every customer on a route with an owner that owner as seller. Owners are computed from
// the input as it is (so `owners.bySeller` shows the distribution BEFORE the override).
export function applyRouteOwners<T extends OwnerInput>(rows: readonly T[]): {
  rows: T[];
  owners: RouteOwner[];
  overrides: { coCli: string; ruta: number; from: string; to: string }[];
} {
  const owners = deriveRouteOwners(rows);
  const ownerOf = new Map(owners.map(o => [o.route, o.owner]));
  const overrides: { coCli: string; ruta: number; from: string; to: string }[] = [];
  const out = rows.map(row => {
    const owner = row.ruta == null ? null : (ownerOf.get(row.ruta) ?? null);
    if (!owner) return row;
    const current = row.coVen.trim();
    if (current && sellerKey(current) === sellerKey(owner)) return row;
    overrides.push({ coCli: row.coCli, ruta: row.ruta!, from: current, to: owner });
    return { ...row, coVen: owner };
  });
  return { rows: out, owners, overrides };
}
