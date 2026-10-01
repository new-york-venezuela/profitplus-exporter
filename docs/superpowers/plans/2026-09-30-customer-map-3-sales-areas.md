# Customer Map — Plan 3 of 3: Sales Areas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Series:** Plan 3 of 3 — `customer-map-1-foundations` → `customer-map-2-map-and-routes` → **`customer-map-3-sales-areas`**.
> **Depends on:** Plan 2 (`docs/superpowers/plans/2026-09-30-customer-map-2-map-and-routes.md`) merged to `main`, and therefore Plan 1. This plan modifies Plan 2's files: `lib/geo/types.ts` (`MapCustomer`, `MapPayload`), `lib/geo/merge.ts`, `lib/geo/filters.ts`, `app/api/mapa/clientes/route.ts`, `app/(app)/mapa/mapa-client.tsx`, `components/customer-map.tsx`, `customer-popup.tsx`, `customer-table.tsx`, `filter-panel.tsx`, and the unit tests for filters/merge. It reuses `requireGeoAccess`, `AppDb`, `MapFilters`, the right-panel tab strip, and `CustomerMap`'s `children` slot.
> **Blocks:** nothing (last in the series).

**Goal:** Let users draw sales areas on the map, assign one or more sellers to each, automatically match every located customer to the area it falls in, flag seller/area mismatches and customers outside every area, and view revenue as an area choropleth and a point-density heatmap.

**Architecture:** Areas (GeoJSON polygon + color + seller codes) live in SQLite. All geometry (point-in-polygon, polygon validity, polygon overlap) is small, dependency-free, pure code in `lib/geo/geometry.ts`. Matching is computed on read inside `GET /api/mapa/clientes` (never stored, never written to the ERP). Drawing/editing uses Geoman inside the Leaflet map; layers are toggleable map children.

**Tech Stack:** Drizzle + `bun:sqlite`, `leaflet`, `react-leaflet`, `@geoman-io/leaflet-geoman-free`, `leaflet.heat`, `bun:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-customer-map-design.md` (as amended by Plans 1 and 2).

## Global Constraints

- Polygon coordinates are `[lng, lat]` pairs (GeoJSON order) everywhere in `lib/geo/geometry.ts` and in storage; Leaflet's `[lat, lng]` appears only at the UI boundary through `ringToLatLngs` / `ringFromLatLngs`.
- Stored polygon = GeoJSON `Polygon` text with a **closed** ring; in memory a ring is **open** (first ≠ last), ≥ 3 vertices, either winding accepted.
- Areas must not overlap each other; areas that only share a border are allowed. The overlap error names the conflicting area and the UI highlights it.
- Many sellers per area, one area per customer. A customer on an exact border matches the lowest-id area containing it. Customers without valid coordinates are never matched.
- Mismatch = customer is inside an area that has ≥ 1 seller and the customer's `coVen` is not among them. An area with no sellers never produces mismatches. Matches are never persisted and never written to the ERP (`saCliente.co_ven` is untouched).
- Area names are unique (case-sensitive). Colors are `#RRGGBB`. Max 500 vertices per polygon, max 100 sellers per area.
- Same module gate as Plan 2: every `/api/mapa/zonas*` route calls `requireGeoAccess` (`401`/`403`); errors are `{ error: string }`.
- Choropleth: single-hue sequential scale, always with a numeric legend, a visible boundary and a direct label per area — color is never the only signal. Density layer is supplementary; the same numbers are in the Zonas panel and the table.
- Map never animates (`animate: false`); modes show a visible banner; Esc cancels drawing.
- Geoman and `leaflet.heat` touch `window`; they are imported only inside the client-only map tree from Plan 2.
- Unit tests in `__tests__/unit/geo/`; run with `bun test --isolate --env-file=.env.local <file>`. e2e that needs ERP/DWH is tagged `@mssql`; keep `SQLITE_PATH` pinned to `e2e/.tmp` for any SQLite-touching script.

## Review Focus

- Bow-tie (self-intersecting) polygon from a careless draw: rejected `400`, never stored.
- Polygon with < 3 distinct points, zero area (collinear), duplicate consecutive points, or a closing point repeated: normalized or rejected, never crashes the matcher.
- Clockwise vs counter-clockwise rings: both accepted and match identically.
- Two areas that share a full edge (neighbouring districts): accepted. Identical, nested, or diamond-inside-square areas: rejected as overlapping (touch-only vertices must not hide an overlap).
- Editing an area must not conflict with itself; renaming into an existing name → `409`.
- Customer exactly on a border / on a vertex: matched deterministically (lowest area id), no crash, no double-count in revenue.
- Area with zero sellers: no mismatch flags. Area with zero customers: appears in the list and choropleth at the lowest color with revenue 0.
- Choropleth with all-equal values (min = max) or no areas: no NaN colors / division by zero; legend still renders.
- Heat layer with no located, revenue-bearing customers: nothing is added, no thrown error.
- Deleting an area: customers fall back to "sin zona"; no orphan seller rows (cascade).
- Starting to edit a customer location while drawing an area (or vice-versa): the first mode is cancelled; the user is never left in two modes.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/geo/geometry.ts` | `Ring`, `normalizeRing`, `validatePolygon`, `pointInPolygon`, `polygonsOverlap`, `interiorPoint`, GeoJSON (de)serialization, Leaflet boundary helpers |
| `lib/db/schema.ts`, `migrations/sqlite/0007_*.sql` | `sales_areas`, `sales_area_sellers` |
| `lib/geo/area-validation.ts` | `parseAreaCreate`, `parseAreaPatch` |
| `lib/geo/areas-repo.ts` | `AreaDto`, area CRUD with overlap/validity checks |
| `lib/geo/area-match.ts` | `applyAreaMatch`, `areaRevenue` |
| `lib/geo/color-scale.ts` | `buildScale` |
| `lib/geo/layers.ts` | `heatPoints` |
| `lib/geo/types.ts`, `merge.ts`, `filters.ts` | (modify) new customer fields, `areas` in payload, `area` filter |
| `app/api/mapa/zonas/route.ts`, `app/api/mapa/zonas/[id]/route.ts` | area API |
| `app/api/mapa/clientes/route.ts` | (modify) load areas + match |
| `types/leaflet-heat.d.ts`, `types/leaflet-heat-module.d.ts` | typings for `leaflet.heat` |
| `app/(app)/mapa/components/area-polygons.tsx`, `heat-layer.tsx`, `area-drawing.tsx`, `layer-toggles.tsx`, `choropleth-legend.tsx`, `areas-panel.tsx`, `mismatch-panel.tsx` | UI |
| `app/(app)/mapa/components/customer-map.tsx`, `customer-popup.tsx`, `customer-table.tsx`, `filter-panel.tsx`, `mapa-client.tsx` | (modify) |
| `e2e/mapa.spec.ts`, `AGENTS.md` | e2e + docs |

---

### Task 1: Geometry (pure)

**Files:**
- Create: `lib/geo/geometry.ts`
- Test: `__tests__/unit/geo/geometry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Point = [number, number];            // [lng, lat]
  export type Ring = Point[];                       // open ring
  export type PolygonError = 'TOO_FEW_VERTICES' | 'NON_FINITE' | 'OUT_OF_RANGE' | 'ZERO_AREA' | 'SELF_INTERSECTING';
  export function normalizeRing(ring: Ring): Ring;                         // drops closing point + consecutive duplicates
  export function validatePolygon(ring: Ring): { ok: true } | { ok: false; error: PolygonError };
  export function pointInPolygon(p: Point, ring: Ring, boundary?: 'inside' | 'outside'): boolean;   // default 'inside'
  export function interiorPoint(ring: Ring): Point;
  export function polygonsOverlap(a: Ring, b: Ring): boolean;
  export function toGeoJsonPolygon(ring: Ring): string;
  export function fromGeoJsonPolygon(text: string): Ring | null;
  export function ringToLatLngs(ring: Ring): [number, number][];            // [lat, lng] for Leaflet
  export function ringFromLatLngs(latlngs: { lat: number; lng: number }[][] | { lat: number; lng: number }[]): Ring;
  export function polygonErrorMessage(error: PolygonError): string;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/geometry.test.ts
import { describe, test, expect } from 'bun:test';
import {
  normalizeRing, validatePolygon, pointInPolygon, polygonsOverlap, interiorPoint,
  toGeoJsonPolygon, fromGeoJsonPolygon, ringToLatLngs, ringFromLatLngs, polygonErrorMessage, type Ring,
} from '@/lib/geo/geometry';

const square: Ring = [[0, 0], [2, 0], [2, 2], [0, 2]];
const squareCw: Ring = [[0, 0], [0, 2], [2, 2], [2, 0]];
const lShape: Ring = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
const shift = (r: Ring, dx: number, dy: number): Ring => r.map(([x, y]) => [x + dx, y + dy]);

describe('normalizeRing', () => {
  test('drops a repeated closing point and consecutive duplicates', () => {
    expect(normalizeRing([[0, 0], [2, 0], [2, 0], [2, 2], [0, 0]])).toEqual([[0, 0], [2, 0], [2, 2]]);
  });
});

describe('validatePolygon', () => {
  test('accepts clockwise and counter-clockwise, open or closed', () => {
    expect(validatePolygon(square)).toEqual({ ok: true });
    expect(validatePolygon(squareCw)).toEqual({ ok: true });
    expect(validatePolygon([...square, square[0]])).toEqual({ ok: true });
    expect(validatePolygon(lShape)).toEqual({ ok: true });
  });
  test('rejects fewer than 3 distinct vertices', () => {
    expect(validatePolygon([[0, 0], [1, 1]])).toEqual({ ok: false, error: 'TOO_FEW_VERTICES' });
    expect(validatePolygon([[0, 0], [0, 0], [1, 1]])).toEqual({ ok: false, error: 'TOO_FEW_VERTICES' });
  });
  test('rejects a bow-tie', () => {
    expect(validatePolygon([[0, 0], [2, 2], [2, 0], [0, 2]])).toEqual({ ok: false, error: 'SELF_INTERSECTING' });
  });
  test('rejects collinear (zero area) points', () => {
    expect(validatePolygon([[0, 0], [1, 1], [2, 2]])).toEqual({ ok: false, error: 'ZERO_AREA' });
  });
  test('rejects a spike that doubles back on itself', () => {
    expect(validatePolygon([[0, 0], [4, 0], [4, 4], [4, 0.0], [2, 3]])).toMatchObject({ ok: false });
  });
  test('rejects NaN/Infinity and impossible lat/lng', () => {
    expect(validatePolygon([[0, 0], [NaN, 1], [1, 1]])).toEqual({ ok: false, error: 'NON_FINITE' });
    expect(validatePolygon([[0, 0], [1, 91], [2, 0]])).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
    expect(validatePolygon([[181, 0], [1, 1], [2, 0]])).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
});

describe('pointInPolygon', () => {
  test('inside / outside', () => {
    expect(pointInPolygon([1, 1], square)).toBe(true);
    expect(pointInPolygon([3, 1], square)).toBe(false);
  });
  test('same answer for either winding', () => {
    expect(pointInPolygon([1, 1], squareCw)).toBe(true);
  });
  test('concave: a point in the notch of an L is outside', () => {
    expect(pointInPolygon([3, 3], lShape)).toBe(false);
    expect(pointInPolygon([1, 3], lShape)).toBe(true);
  });
  test('boundary and vertex: inside by default, outside on request', () => {
    expect(pointInPolygon([1, 0], square)).toBe(true);
    expect(pointInPolygon([0, 0], square)).toBe(true);
    expect(pointInPolygon([1, 0], square, 'outside')).toBe(false);
    expect(pointInPolygon([0, 0], square, 'outside')).toBe(false);
  });
});

describe('interiorPoint', () => {
  test('is strictly inside convex and concave polygons', () => {
    for (const ring of [square, squareCw, lShape, [[0, 0], [10, 0], [5, 8]] as Ring]) {
      expect(pointInPolygon(interiorPoint(ring), ring, 'outside')).toBe(true);
    }
  });
});

describe('polygonsOverlap', () => {
  test('disjoint → false', () => expect(polygonsOverlap(square, shift(square, 5, 0))).toBe(false));
  test('neighbours sharing a full edge → false', () => expect(polygonsOverlap(square, shift(square, 2, 0))).toBe(false));
  test('neighbours sharing only a corner → false', () => expect(polygonsOverlap(square, shift(square, 2, 2))).toBe(false));
  test('partially overlapping (edges cross) → true', () => expect(polygonsOverlap(square, shift(square, 1, 1))).toBe(true));
  test('one nested inside the other → true, both directions', () => {
    const inner: Ring = [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]];
    expect(polygonsOverlap(square, inner)).toBe(true);
    expect(polygonsOverlap(inner, square)).toBe(true);
  });
  test('identical → true', () => expect(polygonsOverlap(square, [...square])).toBe(true));
  test('diamond whose vertices all touch the square\'s sides → true (no strictly-inside vertex, no crossing)', () => {
    const diamond: Ring = [[1, 0], [2, 1], [1, 2], [0, 1]];
    expect(polygonsOverlap(square, diamond)).toBe(true);
    expect(polygonsOverlap(diamond, square)).toBe(true);
  });
  test('half-rectangle sharing the square\'s boundary → true', () => {
    expect(polygonsOverlap(square, [[0, 0], [1, 0], [1, 2], [0, 2]])).toBe(true);
  });
  test('either winding gives the same answer', () => {
    expect(polygonsOverlap(squareCw, shift(square, 1, 1))).toBe(true);
    expect(polygonsOverlap(squareCw, shift(square, 2, 0))).toBe(false);
  });
});

describe('GeoJSON round trip', () => {
  test('stores a closed ring and reads back the open ring', () => {
    const text = toGeoJsonPolygon(square);
    const parsed = JSON.parse(text);
    expect(parsed.type).toBe('Polygon');
    expect(parsed.coordinates[0].at(-1)).toEqual(parsed.coordinates[0][0]);
    expect(fromGeoJsonPolygon(text)).toEqual(square);
  });
  test('garbage → null, never throws', () => {
    for (const bad of ['', 'nope', '{}', '{"type":"Point","coordinates":[1,2]}', '{"type":"Polygon","coordinates":[]}',
      '{"type":"Polygon","coordinates":[[[0,0],[1,"x"],[2,2]]]}']) expect(fromGeoJsonPolygon(bad)).toBeNull();
  });
});

describe('Leaflet boundary helpers', () => {
  test('swap axes and drop the nested array', () => {
    expect(ringToLatLngs([[-66, 10], [-65, 10], [-65, 11]])).toEqual([[10, -66], [10, -65], [11, -65]]);
    expect(ringFromLatLngs([[{ lat: 10, lng: -66 }, { lat: 10, lng: -65 }, { lat: 11, lng: -65 }]])).toEqual([[-66, 10], [-65, 10], [-65, 11]]);
    expect(ringFromLatLngs([{ lat: 10, lng: -66 }, { lat: 10, lng: -65 }, { lat: 11, lng: -65 }])).toEqual([[-66, 10], [-65, 10], [-65, 11]]);
  });
});

describe('polygonErrorMessage', () => {
  test('Spanish text per error', () => {
    expect(polygonErrorMessage('SELF_INTERSECTING')).toContain('cruz');
    expect(polygonErrorMessage('TOO_FEW_VERTICES')).toContain('3');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/geometry.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/geometry`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/geo/geometry.ts
//
// Small, dependency-free planar geometry for sales areas (a few dozen
// vertices at most). Coordinates are [lng, lat] (x, y) — GeoJSON order.
// Planar maths is fine at the scale of a sales area.

export type Point = [number, number];
export type Ring = Point[];
export type PolygonError = 'TOO_FEW_VERTICES' | 'NON_FINITE' | 'OUT_OF_RANGE' | 'ZERO_AREA' | 'SELF_INTERSECTING';

const EPS = 1e-12;

const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function onSegment(p: Point, a: Point, b: Point): boolean {
  if (Math.abs(cross(a, b, p)) > EPS) return false;
  return p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS
    && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
}

// Segments cross at a single point interior to both (no touching, no collinear overlap).
function properCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}

function touch(a: Point, b: Point, c: Point, d: Point): boolean {
  return properCross(a, b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

export function normalizeRing(ring: Ring): Ring {
  const out: Ring = [];
  for (const p of ring) if (out.length === 0 || !same(out[out.length - 1], p)) out.push(p);
  while (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

const edges = (ring: Ring): [Point, Point][] => ring.map((p, i) => [p, ring[(i + 1) % ring.length]]);

function area2(ring: Ring): number {
  let s = 0;
  for (const [a, b] of edges(ring)) s += a[0] * b[1] - b[0] * a[1];
  return s;
}

export function validatePolygon(input: Ring): { ok: true } | { ok: false; error: PolygonError } {
  if (input.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return { ok: false, error: 'NON_FINITE' };
  const ring = normalizeRing(input);
  if (ring.length < 3) return { ok: false, error: 'TOO_FEW_VERTICES' };
  if (ring.some(([lng, lat]) => lng < -180 || lng > 180 || lat < -90 || lat > 90)) return { ok: false, error: 'OUT_OF_RANGE' };
  if (Math.abs(area2(ring)) < EPS) return { ok: false, error: 'ZERO_AREA' };

  const es = edges(ring);
  const n = es.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) {
        // Adjacent edges legitimately share one endpoint; they only conflict if they double back collinearly.
        const [a, b] = es[i]; const [, d] = es[j];
        const dot = (b[0] - a[0]) * (d[0] - b[0]) + (b[1] - a[1]) * (d[1] - b[1]);
        if (Math.abs(cross(a, b, d)) < EPS && dot < 0) return { ok: false, error: 'SELF_INTERSECTING' };
        continue;
      }
      if (touch(es[i][0], es[i][1], es[j][0], es[j][1])) return { ok: false, error: 'SELF_INTERSECTING' };
    }
  }
  return { ok: true };
}

export function pointInPolygon(p: Point, ring: Ring, boundary: 'inside' | 'outside' = 'inside'): boolean {
  for (const [a, b] of edges(ring)) if (onSegment(p, a, b)) return boundary === 'inside';
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A point strictly inside a simple polygon: scan a horizontal line that
// passes between two distinct vertex heights (so it hits no vertex) and
// take the midpoint of the first inside interval.
export function interiorPoint(ring: Ring): Point {
  const ys = [...new Set(ring.map(p => p[1]))].sort((a, b) => a - b);
  const k = Math.floor((ys.length - 1) / 2);
  const y = (ys[k] + ys[k + 1]) / 2;
  const xs: number[] = [];
  for (const [a, b] of edges(ring)) {
    if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
  }
  xs.sort((a, b) => a - b);
  return [(xs[0] + xs[1]) / 2, y];
}

// Interiors intersect iff some edges properly cross, or a vertex of one is
// strictly inside the other, or (for identical/contained shapes whose
// vertices only touch the other's boundary) an interior point of one is
// strictly inside the other. Shared borders and shared corners do NOT overlap.
export function polygonsOverlap(a: Ring, b: Ring): boolean {
  const ea = edges(a), eb = edges(b);
  for (const [p, q] of ea) for (const [r, s] of eb) if (properCross(p, q, r, s)) return true;
  if (a.some(p => pointInPolygon(p, b, 'outside'))) return true;
  if (b.some(p => pointInPolygon(p, a, 'outside'))) return true;
  return pointInPolygon(interiorPoint(a), b, 'outside') || pointInPolygon(interiorPoint(b), a, 'outside');
}

export function toGeoJsonPolygon(ring: Ring): string {
  const open = normalizeRing(ring);
  return JSON.stringify({ type: 'Polygon', coordinates: [[...open, open[0]]] });
}

export function fromGeoJsonPolygon(text: string): Ring | null {
  try {
    const g = JSON.parse(text);
    if (g?.type !== 'Polygon' || !Array.isArray(g.coordinates?.[0])) return null;
    const pts = g.coordinates[0];
    if (!pts.every((p: unknown) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')) return null;
    const ring = normalizeRing(pts.map((p: number[]) => [p[0], p[1]] as Point));
    return ring.length >= 3 ? ring : null;
  } catch {
    return null;
  }
}

export function ringToLatLngs(ring: Ring): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

export function ringFromLatLngs(latlngs: { lat: number; lng: number }[][] | { lat: number; lng: number }[]): Ring {
  const flat = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as { lat: number; lng: number }[];
  return flat.map(p => [p.lng, p.lat] as Point);
}

export function polygonErrorMessage(error: PolygonError): string {
  switch (error) {
    case 'TOO_FEW_VERTICES': return 'La zona necesita al menos 3 puntos distintos.';
    case 'SELF_INTERSECTING': return 'Los bordes de la zona se cruzan entre sí.';
    case 'ZERO_AREA': return 'La zona no tiene área (los puntos están alineados).';
    case 'NON_FINITE': return 'La zona contiene coordenadas inválidas.';
    case 'OUT_OF_RANGE': return 'La zona contiene coordenadas fuera de rango.';
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/geometry.test.ts`
Expected: PASS. If the "spike" case does not return `ok: false`, check that the spike ring `[[0,0],[4,0],[4,4],[4,0],[2,3]]` is rejected by either the non-adjacent `touch` check (vertex `[4,0]` repeats) or the doubling-back check; fix the validator, not the test.

- [ ] **Step 5: Commit**

```bash
git add lib/geo/geometry.ts __tests__/unit/geo/geometry.test.ts
git commit -m "feat(geo): planar geometry (point-in-polygon, validity, overlap)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Area persistence (schema, validators, repo)

**Files:**
- Modify: `lib/db/schema.ts`
- Create (generated): `migrations/sqlite/0007_*.sql` + meta
- Create: `lib/geo/area-validation.ts`, `lib/geo/areas-repo.ts`
- Test: `__tests__/unit/geo/area-validation.test.ts`, `__tests__/unit/geo/areas-repo.test.ts`

**Interfaces:**
- Consumes: `Ring`, `validatePolygon`, `polygonsOverlap`, `toGeoJsonPolygon`, `fromGeoJsonPolygon`, `normalizeRing`, `PolygonError` (Task 1); `AppDb` and `Parsed` from Plan 2 (`lib/geo/routes-repo.ts`, `lib/geo/route-validation.ts`).
- Produces:
  ```ts
  export interface AreaDto { id: number; name: string; color: string; ring: Ring; sellerCodes: string[] }
  export class AreaNotFoundError extends Error {}
  export class DuplicateAreaError extends Error {}
  export class InvalidPolygonError extends Error { constructor(public reason: PolygonError) }
  export class AreaOverlapError extends Error { constructor(public conflict: { id: number; name: string }) }
  export function listAreas(db: AppDb): AreaDto[];
  export function createArea(db: AppDb, input: { name: string; color: string; ring: Ring; sellerCodes: string[] }): AreaDto;
  export function updateArea(db: AppDb, id: number, patch: { name?: string; color?: string; ring?: Ring; sellerCodes?: string[] }): AreaDto;
  export function deleteArea(db: AppDb, id: number): void;
  export function parseAreaCreate(body: unknown): Parsed<{ name: string; color: string; ring: Ring; sellerCodes: string[] }>;
  export function parseAreaPatch(body: unknown): Parsed<{ name?: string; color?: string; ring?: Ring; sellerCodes?: string[] }>;
  ```

- [ ] **Step 1: Add the tables and generate the migration**

Append to `lib/db/schema.ts`:

```ts
export const salesAreas = sqliteTable('sales_areas', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull().unique(),
  color:     text('color').notNull(),                  // '#RRGGBB'
  polygon:   text('polygon').notNull(),                // GeoJSON Polygon text, [lng, lat], closed ring
  createdAt: integer('created_at').notNull(),          // unix ms
});

export type SalesArea    = typeof salesAreas.$inferSelect;
export type NewSalesArea = typeof salesAreas.$inferInsert;

export const salesAreaSellers = sqliteTable('sales_area_sellers', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  areaId:     integer('area_id').notNull().references(() => salesAreas.id, { onDelete: 'cascade' }),
  sellerCode: text('seller_code').notNull(),           // saVendedor.co_ven, trimmed
}, (t) => ({
  uniq: unique('sales_area_sellers_area_seller_unique').on(t.areaId, t.sellerCode),
}));

export type SalesAreaSeller    = typeof salesAreaSellers.$inferSelect;
export type NewSalesAreaSeller = typeof salesAreaSellers.$inferInsert;
```

Run: `bunx drizzle-kit generate --name geo_sales_areas`
Expected: `migrations/sqlite/0007_geo_sales_areas.sql` with both tables, the unique index on `name`, the unique index on `(area_id, seller_code)` and `ON DELETE cascade`; `meta/_journal.json` and `0007_snapshot.json` updated.

- [ ] **Step 2: Write the failing validator tests**

```ts
// __tests__/unit/geo/area-validation.test.ts
import { describe, test, expect } from 'bun:test';
import { parseAreaCreate, parseAreaPatch } from '@/lib/geo/area-validation';

const ring = [[0, 0], [2, 0], [2, 2], [0, 2]];

describe('parseAreaCreate', () => {
  test('accepts and trims; dedupes seller codes', () => {
    const r = parseAreaCreate({ name: ' Norte ', color: '#1D4ED8', ring, sellerCodes: [' 000001 ', '000001', '000002'] });
    expect(r).toEqual({ ok: true, value: { name: 'Norte', color: '#1D4ED8', ring, sellerCodes: ['000001', '000002'] } });
  });
  test('sellerCodes may be empty (area drawn before assigning)', () => {
    expect(parseAreaCreate({ name: 'N', color: '#000000', ring, sellerCodes: [] }).ok).toBe(true);
  });
  test('rejects bad shapes', () => {
    const base = { name: 'N', color: '#000000', ring, sellerCodes: [] };
    for (const body of [null, 'x', [], { ...base, name: '  ' }, { ...base, name: 'x'.repeat(81) },
      { ...base, color: 'red' }, { ...base, color: '#12345' }, { ...base, ring: 'x' }, { ...base, ring: [[0, 0], [1]] },
      { ...base, ring: [[0, 0], [1, 'a'], [2, 2]] }, { ...base, ring: Array.from({ length: 501 }, (_, i) => [i / 1000, 0]) },
      { ...base, sellerCodes: 'a' }, { ...base, sellerCodes: [''] }, { ...base, sellerCodes: Array.from({ length: 101 }, (_, i) => `S${i}`) }]) {
      expect(parseAreaCreate(body).ok).toBe(false);
    }
  });
});

describe('parseAreaPatch', () => {
  test('any subset', () => {
    expect(parseAreaPatch({ name: 'X' })).toEqual({ ok: true, value: { name: 'X' } });
    expect(parseAreaPatch({ sellerCodes: ['1'] })).toEqual({ ok: true, value: { sellerCodes: ['1'] } });
    expect(parseAreaPatch({ ring }).ok).toBe(true);
  });
  test('rejects empty patch and invalid fields', () => {
    expect(parseAreaPatch({}).ok).toBe(false);
    expect(parseAreaPatch({ color: 'blue' }).ok).toBe(false);
    expect(parseAreaPatch(null).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing repo tests**

```ts
// __tests__/unit/geo/areas-repo.test.ts
import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import {
  listAreas, createArea, updateArea, deleteArea,
  AreaNotFoundError, DuplicateAreaError, InvalidPolygonError, AreaOverlapError,
} from '@/lib/geo/areas-repo';
import type { Ring } from '@/lib/geo/geometry';

const sqlite = new Database(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
const db = drizzle(sqlite, { schema });

beforeAll(() => { migrate(db, { migrationsFolder: './migrations/sqlite' }); });
beforeEach(() => { sqlite.exec('DELETE FROM sales_area_sellers'); sqlite.exec('DELETE FROM sales_areas'); });

const sq = (x: number, y: number, size = 2): Ring => [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
const input = (name: string, ring: Ring, sellerCodes: string[] = []) => ({ name, color: '#2563EB', ring, sellerCodes });

describe('areas repo', () => {
  test('create then list round-trips ring, color and sellers', () => {
    const a = createArea(db, input('Norte', sq(0, 0), ['000001', '000002']));
    expect(a).toMatchObject({ name: 'Norte', color: '#2563EB', ring: sq(0, 0) });
    expect(a.sellerCodes.sort()).toEqual(['000001', '000002']);
    expect(listAreas(db)).toEqual([a]);
  });
  test('rejects an invalid polygon with the reason, and stores nothing', () => {
    expect(() => createArea(db, input('Bad', [[0, 0], [2, 2], [2, 0], [0, 2]]))).toThrow(InvalidPolygonError);
    try { createArea(db, input('Bad', [[0, 0], [1, 1]])); } catch (e) { expect((e as InvalidPolygonError).reason).toBe('TOO_FEW_VERTICES'); }
    expect(listAreas(db)).toEqual([]);
  });
  test('rejects an overlapping area and names the conflict', () => {
    createArea(db, input('Norte', sq(0, 0)));
    try { createArea(db, input('Centro', sq(1, 1))); throw new Error('should have thrown'); }
    catch (e) {
      expect(e).toBeInstanceOf(AreaOverlapError);
      expect((e as AreaOverlapError).conflict.name).toBe('Norte');
    }
  });
  test('accepts a neighbour that shares a full edge', () => {
    createArea(db, input('Norte', sq(0, 0)));
    expect(createArea(db, input('Este', sq(2, 0))).id).toBeGreaterThan(0);
  });
  test('duplicate name → DuplicateAreaError', () => {
    createArea(db, input('Norte', sq(0, 0)));
    expect(() => createArea(db, input('Norte', sq(10, 10)))).toThrow(DuplicateAreaError);
  });
  test('updating an area never conflicts with itself', () => {
    const a = createArea(db, input('Norte', sq(0, 0)));
    expect(updateArea(db, a.id, { ring: sq(0, 0, 3) }).ring).toEqual(sq(0, 0, 3));
  });
  test('updating the ring into a neighbour is rejected and leaves the old ring', () => {
    const a = createArea(db, input('Norte', sq(0, 0)));
    createArea(db, input('Este', sq(2, 0)));
    expect(() => updateArea(db, a.id, { ring: sq(1, 0) })).toThrow(AreaOverlapError);
    expect(listAreas(db).find(x => x.id === a.id)!.ring).toEqual(sq(0, 0));
  });
  test('update replaces seller assignment atomically; renaming into an existing name throws', () => {
    const a = createArea(db, input('Norte', sq(0, 0), ['1', '2']));
    createArea(db, input('Este', sq(5, 5)));
    expect(updateArea(db, a.id, { sellerCodes: ['3'] }).sellerCodes).toEqual(['3']);
    expect(() => updateArea(db, a.id, { name: 'Este', sellerCodes: ['9'] })).toThrow(DuplicateAreaError);
    expect(listAreas(db).find(x => x.id === a.id)!.sellerCodes).toEqual(['3']);
  });
  test('unknown id → AreaNotFoundError', () => {
    expect(() => updateArea(db, 999, { name: 'x' })).toThrow(AreaNotFoundError);
    expect(() => deleteArea(db, 999)).toThrow(AreaNotFoundError);
  });
  test('delete cascades seller rows', () => {
    const a = createArea(db, input('Norte', sq(0, 0), ['1']));
    deleteArea(db, a.id);
    expect(listAreas(db)).toEqual([]);
    expect(sqlite.query('SELECT COUNT(*) AS n FROM sales_area_sellers').get()).toEqual({ n: 0 });
  });
  test('a closed ring (first point repeated) is stored and returned open', () => {
    const a = createArea(db, input('Norte', [...sq(0, 0), sq(0, 0)[0]]));
    expect(a.ring).toEqual(sq(0, 0));
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/area-validation.test.ts __tests__/unit/geo/areas-repo.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Write the validators**

```ts
// lib/geo/area-validation.ts
import type { Ring } from './geometry';
import type { Parsed } from './route-validation';

const MAX_NAME = 80;
const MAX_VERTICES = 500;
const MAX_SELLERS = 100;
const MAX_CODE = 16;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function name(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Nombre requerido' };
  if (v.trim().length > MAX_NAME) return { ok: false, error: `Nombre demasiado largo (máximo ${MAX_NAME})` };
  return { ok: true, value: v.trim() };
}

function color(v: unknown): Parsed<string> {
  return typeof v === 'string' && COLOR_RE.test(v) ? { ok: true, value: v } : { ok: false, error: 'Color inválido (use #RRGGBB)' };
}

function ring(v: unknown): Parsed<Ring> {
  if (!Array.isArray(v)) return { ok: false, error: 'La zona debe ser una lista de puntos' };
  if (v.length > MAX_VERTICES) return { ok: false, error: `Demasiados puntos (máximo ${MAX_VERTICES})` };
  const out: Ring = [];
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number') {
      return { ok: false, error: 'Cada punto debe ser [longitud, latitud]' };
    }
    out.push([p[0], p[1]]);
  }
  return { ok: true, value: out };
}

function sellers(v: unknown): Parsed<string[]> {
  if (!Array.isArray(v)) return { ok: false, error: 'sellerCodes debe ser una lista' };
  if (v.length > MAX_SELLERS) return { ok: false, error: `Demasiados vendedores (máximo ${MAX_SELLERS})` };
  const out: string[] = [];
  for (const c of v) {
    if (typeof c !== 'string' || !c.trim() || c.trim().length > MAX_CODE) return { ok: false, error: 'Código de vendedor inválido' };
    if (!out.includes(c.trim())) out.push(c.trim());
  }
  return { ok: true, value: out };
}

export function parseAreaCreate(body: unknown): Parsed<{ name: string; color: string; ring: Ring; sellerCodes: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const n = name(body.name); if (!n.ok) return n;
  const c = color(body.color); if (!c.ok) return c;
  const r = ring(body.ring); if (!r.ok) return r;
  const s = sellers(body.sellerCodes ?? []); if (!s.ok) return s;
  return { ok: true, value: { name: n.value, color: c.value, ring: r.value, sellerCodes: s.value } };
}

export function parseAreaPatch(body: unknown): Parsed<{ name?: string; color?: string; ring?: Ring; sellerCodes?: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const out: { name?: string; color?: string; ring?: Ring; sellerCodes?: string[] } = {};
  if ('name' in body) { const n = name(body.name); if (!n.ok) return n; out.name = n.value; }
  if ('color' in body) { const c = color(body.color); if (!c.ok) return c; out.color = c.value; }
  if ('ring' in body) { const r = ring(body.ring); if (!r.ok) return r; out.ring = r.value; }
  if ('sellerCodes' in body) { const s = sellers(body.sellerCodes); if (!s.ok) return s; out.sellerCodes = s.value; }
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, value: out };
}
```

- [ ] **Step 6: Write the repo**

```ts
// lib/geo/areas-repo.ts
import { eq, inArray } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from './routes-repo';
import {
  validatePolygon, polygonsOverlap, normalizeRing, toGeoJsonPolygon, fromGeoJsonPolygon,
  polygonErrorMessage, type PolygonError, type Ring,
} from './geometry';

export interface AreaDto { id: number; name: string; color: string; ring: Ring; sellerCodes: string[] }

export class AreaNotFoundError extends Error {
  constructor() { super('Zona no encontrada'); this.name = 'AreaNotFoundError'; }
}
export class DuplicateAreaError extends Error {
  constructor() { super('Ya existe una zona con ese nombre'); this.name = 'DuplicateAreaError'; }
}
export class InvalidPolygonError extends Error {
  constructor(public reason: PolygonError) { super(polygonErrorMessage(reason)); this.name = 'InvalidPolygonError'; }
}
export class AreaOverlapError extends Error {
  constructor(public conflict: { id: number; name: string }) {
    super(`La zona se superpone con «${conflict.name}»`);
    this.name = 'AreaOverlapError';
  }
}

function isUniqueViolation(err: unknown): boolean {
  const text = (e: unknown) => (e instanceof Error ? e.message : '');
  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  return /UNIQUE constraint failed/i.test(text(err)) || /UNIQUE constraint failed/i.test(text(cause));
}

function toDtos(db: AppDb, ids?: number[]): AreaDto[] {
  const base = db.select().from(schema.salesAreas);
  const rows = (ids ? base.where(inArray(schema.salesAreas.id, ids)) : base).orderBy(schema.salesAreas.id).all();
  if (rows.length === 0) return [];
  const sellers = db.select().from(schema.salesAreaSellers)
    .where(inArray(schema.salesAreaSellers.areaId, rows.map(r => r.id))).all();
  return rows.flatMap(r => {
    const ring = fromGeoJsonPolygon(r.polygon);
    if (!ring) return [];                    // a corrupt row must not take the whole map down
    return [{ id: r.id, name: r.name, color: r.color, ring, sellerCodes: sellers.filter(s => s.areaId === r.id).map(s => s.sellerCode) }];
  });
}

export function listAreas(db: AppDb): AreaDto[] {
  return toDtos(db);
}

// Validity first, then overlap against every OTHER area.
function assertRingAllowed(db: AppDb, ring: Ring, selfId: number | null): Ring {
  const open = normalizeRing(ring);
  const v = validatePolygon(open);
  if (!v.ok) throw new InvalidPolygonError(v.error);
  for (const other of toDtos(db)) {
    if (other.id !== selfId && polygonsOverlap(open, other.ring)) throw new AreaOverlapError({ id: other.id, name: other.name });
  }
  return open;
}

export function createArea(
  db: AppDb, input: { name: string; color: string; ring: Ring; sellerCodes: string[] },
): AreaDto {
  const ring = assertRingAllowed(db, input.ring, null);
  try {
    return db.transaction(tx => {
      const row = tx.insert(schema.salesAreas)
        .values({ name: input.name, color: input.color, polygon: toGeoJsonPolygon(ring), createdAt: Date.now() })
        .returning().get()!;
      for (const sellerCode of input.sellerCodes) tx.insert(schema.salesAreaSellers).values({ areaId: row.id, sellerCode }).run();
      return { id: row.id, name: row.name, color: row.color, ring, sellerCodes: [...input.sellerCodes] };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateAreaError();
    throw err;
  }
}

export function updateArea(
  db: AppDb, id: number, patch: { name?: string; color?: string; ring?: Ring; sellerCodes?: string[] },
): AreaDto {
  const existing = db.select().from(schema.salesAreas).where(eq(schema.salesAreas.id, id)).get();
  if (!existing) throw new AreaNotFoundError();
  const ring = patch.ring ? assertRingAllowed(db, patch.ring, id) : null;

  try {
    db.transaction(tx => {
      tx.update(schema.salesAreas).set({
        name: patch.name ?? existing.name,
        color: patch.color ?? existing.color,
        polygon: ring ? toGeoJsonPolygon(ring) : existing.polygon,
      }).where(eq(schema.salesAreas.id, id)).run();
      if (patch.sellerCodes !== undefined) {
        tx.delete(schema.salesAreaSellers).where(eq(schema.salesAreaSellers.areaId, id)).run();
        for (const sellerCode of patch.sellerCodes) tx.insert(schema.salesAreaSellers).values({ areaId: id, sellerCode }).run();
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateAreaError();
    throw err;
  }
  return toDtos(db, [id])[0];
}

export function deleteArea(db: AppDb, id: number): void {
  const existing = db.select().from(schema.salesAreas).where(eq(schema.salesAreas.id, id)).get();
  if (!existing) throw new AreaNotFoundError();
  db.delete(schema.salesAreas).where(eq(schema.salesAreas.id, id)).run();   // seller rows cascade
}
```

- [ ] **Step 7: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/area-validation.test.ts __tests__/unit/geo/areas-repo.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts migrations/sqlite lib/geo/area-validation.ts lib/geo/areas-repo.ts \
  __tests__/unit/geo/area-validation.test.ts __tests__/unit/geo/areas-repo.test.ts
git commit -m "feat(geo): sales areas persistence with validity and overlap checks

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Area matching, revenue aggregation, type/filter extensions

**Files:**
- Modify: `lib/geo/types.ts`, `lib/geo/merge.ts`, `lib/geo/filters.ts`
- Create: `lib/geo/area-match.ts`, `lib/geo/layers.ts`
- Test: `__tests__/unit/geo/area-match.test.ts`, `__tests__/unit/geo/layers.test.ts`
- Modify tests: `__tests__/unit/geo/filters.test.ts`, `__tests__/unit/geo/merge.test.ts`

**Interfaces:**
- Consumes: `AreaDto` (Task 2), `pointInPolygon` (Task 1).
- Produces:
  ```ts
  // types.ts — MapCustomer gains:
  //   areaId: number | null; areaName: string | null; areaSellerCodes: string[]; sellerMismatch: boolean;
  // MapPayload gains: areas: AreaDto[];
  // area-match.ts
  export function applyAreaMatch(customers: MapCustomer[], areas: AreaDto[]): MapCustomer[];
  export interface AreaStats { areaId: number; revenueUsd: number; customers: number }
  export function areaRevenue(customers: MapCustomer[], areas: AreaDto[]): Map<number, AreaStats>;
  // layers.ts
  export function heatPoints(customers: MapCustomer[]): [number, number, number][];   // [lat, lng, revenueUsd]
  // filters.ts — MapFilters gains: area: number | null   (URL key `area`)
  ```

- [ ] **Step 1: Extend the types**

In `lib/geo/types.ts`: add `import type { AreaDto } from './areas-repo';` (type-only), add to `MapCustomer`:

```ts
  areaId: number | null;
  areaName: string | null;
  areaSellerCodes: string[];
  /** Inside an area that has sellers, but the customer's own seller (coVen) is not one of them. */
  sellerMismatch: boolean;
```

and to `MapPayload`: `areas: AreaDto[];`.

In `lib/geo/merge.ts`, inside the object returned by `mergeCustomers`, add `areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false,` (matching is applied afterwards by `applyAreaMatch`).

- [ ] **Step 2: Write the failing tests**

```ts
// __tests__/unit/geo/area-match.test.ts
import { describe, test, expect } from 'bun:test';
import { applyAreaMatch, areaRevenue } from '@/lib/geo/area-match';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { MapCustomer } from '@/lib/geo/types';

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '000001', sellerName: 'Ana', direc1: null, dirEnt2: null,
  lat: null, lng: null, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

// ring is [lng, lat]
const west: AreaDto = { id: 1, name: 'Oeste', color: '#111111', ring: [[-68, 9], [-66, 9], [-66, 11], [-68, 11]], sellerCodes: ['000001'] };
const east: AreaDto = { id: 2, name: 'Este', color: '#222222', ring: [[-66, 9], [-64, 9], [-64, 11], [-66, 11]], sellerCodes: ['000002', '000003'] };
const noSellers: AreaDto = { id: 3, name: 'Libre', color: '#333333', ring: [[-70, 9], [-68.5, 9], [-68.5, 11], [-70, 11]], sellerCodes: [] };

describe('applyAreaMatch', () => {
  test('matches by point in polygon (customer lat/lng → ring [lng, lat])', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -67 })], [west, east]);
    expect(c).toMatchObject({ areaId: 1, areaName: 'Oeste', areaSellerCodes: ['000001'], sellerMismatch: false });
  });
  test('flags a mismatch when the customer\'s seller is not among the area\'s sellers', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -65, coVen: '000001' })], [west, east]);
    expect(c).toMatchObject({ areaId: 2, sellerMismatch: true });
  });
  test('any of several sellers satisfies the area', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -65, coVen: '000003' })], [west, east]);
    expect(c.sellerMismatch).toBe(false);
  });
  test('an area with no sellers never produces a mismatch', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -69, coVen: '000009' })], [noSellers]);
    expect(c).toMatchObject({ areaId: 3, sellerMismatch: false });
  });
  test('outside every area, or without coordinates: no match and no mismatch', () => {
    const rows = applyAreaMatch([cust({ coCli: 'A', lat: 5, lng: -60 }), cust({ coCli: 'B' })], [west, east]);
    for (const r of rows) expect(r).toMatchObject({ areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false });
  });
  test('a customer exactly on the shared border matches the lowest area id, once', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -66 })], [east, west]);   // input order must not matter
    expect(c.areaId).toBe(1);
  });
  test('does not mutate its input', () => {
    const input = [cust({ coCli: 'A', lat: 10, lng: -67 })];
    applyAreaMatch(input, [west]);
    expect(input[0].areaId).toBeNull();
  });
});

describe('areaRevenue', () => {
  test('sums USD per area, counts customers, includes empty areas, ignores unmatched', () => {
    const matched = applyAreaMatch([
      cust({ coCli: 'A', lat: 10, lng: -67, revenueUsd: 100 }),
      cust({ coCli: 'B', lat: 10, lng: -67, revenueUsd: 50 }),
      cust({ coCli: 'C', lat: 10, lng: -65, revenueUsd: null }),
      cust({ coCli: 'D', lat: 5, lng: -60, revenueUsd: 999 }),
    ], [west, east]);
    const stats = areaRevenue(matched, [west, east, noSellers]);
    expect(stats.get(1)).toEqual({ areaId: 1, revenueUsd: 150, customers: 2 });
    expect(stats.get(2)).toEqual({ areaId: 2, revenueUsd: 0, customers: 1 });     // null USD counts as 0
    expect(stats.get(3)).toEqual({ areaId: 3, revenueUsd: 0, customers: 0 });
  });
});
```

```ts
// __tests__/unit/geo/layers.test.ts
import { describe, test, expect } from 'bun:test';
import { heatPoints } from '@/lib/geo/layers';
import type { MapCustomer } from '@/lib/geo/types';

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '1', sellerName: null, direc1: null, dirEnt2: null,
  lat: null, lng: null, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

describe('heatPoints', () => {
  test('only located customers with positive USD revenue, weighted by revenue', () => {
    expect(heatPoints([
      cust({ coCli: 'A', lat: 10, lng: -66, revenueUsd: 200 }),
      cust({ coCli: 'B', lat: 10, lng: -66, revenueUsd: 0 }),
      cust({ coCli: 'C', lat: 10, lng: -66, revenueUsd: null }),
      cust({ coCli: 'D', revenueUsd: 50 }),
    ])).toEqual([[10, -66, 200]]);
  });
  test('empty input → empty output', () => expect(heatPoints([])).toEqual([]));
});
```

Update existing tests: in `__tests__/unit/geo/filters.test.ts` add `area: null` to `base`, add `areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false` to the `cust` helper, change the expected `parseFilters` full-object assertions to include `area: null` / `area: 5`, and add:

```ts
  test('area filter: parse, serialize, apply, and clear when the area no longer exists', () => {
    expect(parseFilters(new URLSearchParams('area=5'), NOW).area).toBe(5);
    expect(parseFilters(new URLSearchParams('area=x'), NOW).area).toBeNull();
    expect(serializeFilters({ ...base, area: 5 }, NOW).toString()).toBe('area=5');
    const rows = [cust({ coCli: 'A', areaId: 5 }), cust({ coCli: 'B', areaId: 6 }), cust({ coCli: 'C' })];
    expect(applyFilters(rows, { ...base, area: 5 }).map(r => r.coCli)).toEqual(['A']);
    expect(normalizeFilters({ ...base, area: 9 }, [], [{ id: 5, name: 'N', color: '#000000', ring: [], sellerCodes: [] }]).area).toBeNull();
    expect(filterChips({ ...base, area: 5 }, { sellers: [], routes: [], areas: [{ id: 5, name: 'Norte', color: '#000000', ring: [], sellerCodes: [] }] }, NOW)
      .find(c => c.key === 'area')!.label).toBe('Zona: Norte');
  });
```

(`normalizeFilters` and `filterChips` gain an `areas` parameter — see Step 4.) In `__tests__/unit/geo/merge.test.ts` add to the first test: `expect(c).toMatchObject({ areaId: null, sellerMismatch: false })`.

- [ ] **Step 3: Run to verify they fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/`
Expected: FAIL — `area-match`/`layers` modules missing; filters tests fail on the new `area` field/signatures.

- [ ] **Step 4: Implement**

```ts
// lib/geo/area-match.ts
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
```

```ts
// lib/geo/layers.ts
import type { MapCustomer } from './types';

// [lat, lng, weight] for leaflet.heat — located customers with revenue only.
export function heatPoints(customers: MapCustomer[]): [number, number, number][] {
  return customers
    .filter(c => c.lat !== null && c.lng !== null && c.revenueUsd !== null && c.revenueUsd > 0)
    .map(c => [c.lat!, c.lng!, c.revenueUsd!]);
}
```

`lib/geo/filters.ts` changes: add `area: number | null` to `MapFilters`; `parseFilters` reads `area` with the same `/^\d+$/` rule as `route`; `serializeFilters` writes `area` when non-null; `applyFilters` adds `(f.area === null || c.areaId === f.area)`; `normalizeFilters(f, routes, areas)` also clears `area` when no area with that id exists (add `areas: AreaDto[] = []` as a third parameter; Plan 2 call sites pass it in Task 6); `filterChips(f, ctx, now)` — `ctx` gains `areas: AreaDto[]` and pushes `{ key: 'area', label: \`Zona: ${name}\` }` after `route`; `FilterChip['key']` gains `'area'`. Plan 2's `FilterPanel.clear()` gets `if (key === 'area') next.area = null;` in Task 6.

- [ ] **Step 5: Run to verify they pass, then type-check**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/ && bunx tsc --noEmit`
Expected: PASS. `tsc` will report errors at the Plan 2 call sites of `normalizeFilters`/`filterChips`/`MapPayload`/`MapCustomer` literals — fix them in Task 5 (API payload) and Task 6 (UI); until then keep `tsc` red only for those call sites. If you prefer a green tree at every commit, make `areas` optional (`areas: AreaDto[] = []`) in both functions and keep the defaults as written.

- [ ] **Step 6: Commit**

```bash
git add lib/geo __tests__/unit/geo
git commit -m "feat(geo): area matching, area revenue, heat points, area filter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Color scale (choropleth)

**Files:**
- Create: `lib/geo/color-scale.ts`
- Test: `__tests__/unit/geo/color-scale.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Scale { min: number; max: number; breaks: number[]; colorFor(value: number): string }
  export function buildScale(values: number[], steps?: number): Scale;   // default 5 legend stops
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/color-scale.test.ts
import { describe, test, expect } from 'bun:test';
import { buildScale } from '@/lib/geo/color-scale';

const HEX = /^#[0-9a-f]{6}$/;
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('buildScale', () => {
  test('min is lightest, max is darkest, values in between are monotonic', () => {
    const s = buildScale([0, 50, 100]);
    expect(s.min).toBe(0);
    expect(s.max).toBe(100);
    const lums = [0, 25, 50, 75, 100].map(v => luminance(s.colorFor(v)));
    for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeLessThan(lums[i - 1]);
    expect(s.colorFor(0)).toMatch(HEX);
  });
  test('values outside the range clamp', () => {
    const s = buildScale([10, 20]);
    expect(s.colorFor(-5)).toBe(s.colorFor(10));
    expect(s.colorFor(999)).toBe(s.colorFor(20));
  });
  test('legend breaks span min..max with the requested number of stops', () => {
    expect(buildScale([0, 100], 5).breaks).toEqual([0, 25, 50, 75, 100]);
  });
  test('all values equal: single break, lightest colour, no NaN', () => {
    const s = buildScale([7, 7, 7]);
    expect(s.breaks).toEqual([7]);
    expect(s.colorFor(7)).toMatch(HEX);
  });
  test('empty input and non-finite values are ignored safely', () => {
    const empty = buildScale([]);
    expect(empty).toMatchObject({ min: 0, max: 0, breaks: [0] });
    expect(buildScale([NaN, 5, Infinity]).max).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/color-scale.test.ts` → FAIL (module missing).

```ts
// lib/geo/color-scale.ts
//
// Single-hue sequential scale (blue-100 → blue-900). A numeric legend is
// always rendered next to it, so colour is never the only carrier of the value.
const LOW: [number, number, number] = [219, 234, 254];
const HIGH: [number, number, number] = [30, 58, 138];

export interface Scale {
  min: number;
  max: number;
  breaks: number[];
  colorFor(value: number): string;
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

function mix(t: number): string {
  const c = LOW.map((lo, i) => lo + (HIGH[i] - lo) * t);
  return `#${hex(c[0])}${hex(c[1])}${hex(c[2])}`;
}

export function buildScale(values: number[], steps = 5): Scale {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const t = (v: number) => (max === min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min))));
  const breaks = max === min ? [min] : Array.from({ length: steps }, (_, i) => min + ((max - min) * i) / (steps - 1));
  return { min, max, breaks, colorFor: v => mix(t(v)) };
}
```

Run again → PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/geo/color-scale.ts __tests__/unit/geo/color-scale.test.ts
git commit -m "feat(geo): sequential colour scale for the area choropleth

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Zonas API and payload wiring

**Files:**
- Create: `app/api/mapa/zonas/route.ts`, `app/api/mapa/zonas/[id]/route.ts`
- Modify: `app/api/mapa/clientes/route.ts`
- Modify: `app/api/mapa/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `requireGeoAccess` (Plan 2), `parseAreaCreate`/`parseAreaPatch`, `createArea`/`updateArea`/`deleteArea`/`listAreas` + error classes (Task 2), `applyAreaMatch` (Task 3), `polygonErrorMessage` via `InvalidPolygonError.message`.
- Produces:
  ```
  POST   /api/mapa/zonas        body { name, color, ring, sellerCodes? } → 201 { item: AreaDto } | 400 | 409 { error, conflictAreaId? }
  PATCH  /api/mapa/zonas/[id]   body { name?, color?, ring?, sellerCodes? } → { item: AreaDto } | 400 | 404 | 409
  DELETE /api/mapa/zonas/[id]   → { ok: true } | 404
  GET    /api/mapa/clientes     → MapPayload now includes `areas` and per-customer match fields
  ```

- [ ] **Step 1: Extend the failing auth test**

Append to `app/api/mapa/__tests__/auth.test.ts`:

```ts
import { POST as postZona } from '../zonas/route';
import { PATCH as patchZona, DELETE as deleteZona } from '../zonas/[id]/route';

describe('/api/mapa/zonas rejects unauthenticated requests with 401', () => {
  test('POST zonas', async () => {
    expect((await postZona(json('http://localhost/api/mapa/zonas', 'POST', { name: 'x' }))).status).toBe(401);
  });
  test('PATCH / DELETE zonas/[id]', async () => {
    expect((await patchZona(json('http://localhost/api/mapa/zonas/1', 'PATCH', { name: 'x' }), ctx({ id: '1' }))).status).toBe(401);
    expect((await deleteZona(json('http://localhost/api/mapa/zonas/1', 'DELETE'), ctx({ id: '1' }))).status).toBe(401);
  });
});
```

Run: `bun test --isolate --env-file=.env.local app/api/mapa/__tests__/auth.test.ts`
Expected: FAIL — `../zonas/route` not found.

- [ ] **Step 2: Write the routes**

```ts
// app/api/mapa/zonas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseAreaCreate } from '@/lib/geo/area-validation';
import { createArea, DuplicateAreaError, InvalidPolygonError, AreaOverlapError } from '@/lib/geo/areas-repo';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const parsed = parseAreaCreate(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = createArea(getDb(), parsed.value);
    captureEvent(auth.session.sub, 'mapa_area_created', { vertices: item.ring.length, sellers: item.sellerCodes.length });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidPolygonError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof AreaOverlapError) return NextResponse.json({ error: err.message, conflictAreaId: err.conflict.id }, { status: 409 });
    if (err instanceof DuplicateAreaError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('POST /api/mapa/zonas failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

```ts
// app/api/mapa/zonas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseAreaPatch } from '@/lib/geo/area-validation';
import {
  updateArea, deleteArea, AreaNotFoundError, DuplicateAreaError, InvalidPolygonError, AreaOverlapError,
} from '@/lib/geo/areas-repo';

export const dynamic = 'force-dynamic';

const parseId = (raw: string) => (/^\d+$/.test(raw) ? parseInt(raw, 10) : null);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
  const parsed = parseAreaPatch(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = updateArea(getDb(), id, parsed.value);
    captureEvent(auth.session.sub, 'mapa_area_updated', { shape: Boolean(parsed.value.ring), sellers: parsed.value.sellerCodes?.length });
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof AreaNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof InvalidPolygonError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof AreaOverlapError) return NextResponse.json({ error: err.message, conflictAreaId: err.conflict.id }, { status: 409 });
    if (err instanceof DuplicateAreaError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('PATCH /api/mapa/zonas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
  try {
    deleteArea(getDb(), id);
    captureEvent(auth.session.sub, 'mapa_area_deleted', {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AreaNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('DELETE /api/mapa/zonas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Add areas and matching to `GET /api/mapa/clientes`**

In `app/api/mapa/clientes/route.ts`: `import { listAreas } from '@/lib/geo/areas-repo'; import { applyAreaMatch } from '@/lib/geo/area-match';`. Replace the payload construction with:

```ts
    const db = getDb();
    const routes = listRoutes(db);
    const areas = listAreas(db);
    const customers = applyAreaMatch(mergeCustomers(erpCustomers, revenue, routes), areas);

    const payload: MapPayload = {
      dateRange, customers, sellers: distinctSellers(customers), routes, areas, paretoThresholds: PARETO_THRESHOLDS,
    };
```

(and drop the now-duplicated `const routes = listRoutes(getDb());` / `const customers = mergeCustomers(...)` lines from Plan 2).

- [ ] **Step 4: Run tests, type-check, commit**

Run: `bun test --isolate --env-file=.env.local app/api/mapa/__tests__/auth.test.ts __tests__/unit/geo/ && bunx tsc --noEmit`
Expected: PASS. Remaining `tsc` errors, if any, are the UI call sites handled in Task 6.

```bash
git add app/api/mapa
git commit -m "feat(mapa): zonas API; clientes payload carries areas and matches

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Map layers (areas, choropleth, density), toggles, legend, filter/popup/table updates

**Files:**
- Modify: `package.json` / lockfile (`bun add @geoman-io/leaflet-geoman-free leaflet.heat`)
- Create: `types/leaflet-heat.d.ts`, `types/leaflet-heat-module.d.ts`
- Create: `app/(app)/mapa/components/area-polygons.tsx`, `heat-layer.tsx`, `layer-toggles.tsx`, `choropleth-legend.tsx`
- Modify: `app/(app)/mapa/components/customer-map.tsx`, `customer-popup.tsx`, `customer-table.tsx`, `filter-panel.tsx`, `app/(app)/mapa/mapa-client.tsx`

**Interfaces:**
- Consumes: `AreaDto`, `AreaStats`/`areaRevenue`, `buildScale`/`Scale`, `heatPoints`, `ringToLatLngs`, `MapFilters` (with `area`), Plan 2's components.
- Produces:
  ```ts
  export interface LayerState { pins: boolean; areas: boolean; choropleth: boolean; density: boolean }
  export function AreaPolygons(props: { areas: AreaDto[]; stats: Map<number, AreaStats>; scale: Scale | null; highlightId: number | null }): JSX.Element;
  export function HeatLayer(props: { points: [number, number, number][] }): null;
  export function LayerToggles(props: { layers: LayerState; onChange: (l: LayerState) => void }): JSX.Element;
  export function ChoroplethLegend(props: { scale: Scale }): JSX.Element;
  // CustomerMap gains props:
  //   showPins?: boolean (default true);  focus?: { lat: number; lng: number; key: number } | null;
  ```

- [ ] **Step 1: Install and type the plugins**

Run: `bun add @geoman-io/leaflet-geoman-free leaflet.heat`

```ts
// types/leaflet-heat.d.ts
import 'leaflet';

declare module 'leaflet' {
  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }
  function heatLayer(latlngs: Array<[number, number, number?]>, options?: HeatLayerOptions): Layer;
}
```

```ts
// types/leaflet-heat-module.d.ts
declare module 'leaflet.heat';
```

Confirm `tsconfig.json` `include` covers `**/*.ts` (Next's default does); if it lists explicit folders, add `types`.

- [ ] **Step 2: Write the layer components**

```tsx
// app/(app)/mapa/components/area-polygons.tsx
'use client';

import { Polygon, Tooltip } from 'react-leaflet';
import { ringToLatLngs } from '@/lib/geo/geometry';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { AreaStats } from '@/lib/geo/area-match';
import type { Scale } from '@/lib/geo/color-scale';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Non-interactive so pins and the "place location" click keep working
// above/through the polygons. Every area keeps a dark boundary and a
// permanent direct label, so fill colour is never the only signal.
export function AreaPolygons({
  areas, stats, scale, highlightId,
}: { areas: AreaDto[]; stats: Map<number, AreaStats>; scale: Scale | null; highlightId: number | null }) {
  return (
    <>
      {areas.map(a => {
        const s = stats.get(a.id);
        const highlighted = a.id === highlightId;
        return (
          <Polygon
            key={`${a.id}-${a.ring.length}`}
            positions={ringToLatLngs(a.ring)}
            interactive={false}
            pathOptions={{
              color: highlighted ? '#dc2626' : '#111827',
              weight: highlighted ? 4 : 2,
              dashArray: highlighted ? '6 4' : undefined,
              fillColor: scale ? scale.colorFor(s?.revenueUsd ?? 0) : a.color,
              fillOpacity: scale ? 0.65 : 0.2,
            }}
          >
            <Tooltip permanent direction="center" className="!bg-white !text-gray-900 !shadow">
              <strong>{a.name}</strong>
              {scale && <><br />{usd.format(s?.revenueUsd ?? 0)}</>}
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
```

```tsx
// app/(app)/mapa/components/heat-layer.tsx
'use client';

import 'leaflet.heat';
import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

// Weights are normalised to 0..1 against the max so the gradient always
// spans the data. An empty/zero set adds nothing (and so cannot throw).
export function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const max = Math.max(...points.map(p => p[2]));
    if (!(max > 0)) return;
    const layer = L.heatLayer(points.map(([lat, lng, w]) => [lat, lng, w / max] as [number, number, number]), {
      radius: 35, blur: 25, minOpacity: 0.3,
    }).addTo(map);
    return () => { layer.remove(); };
  }, [points, map]);
  return null;
}
```

```tsx
// app/(app)/mapa/components/layer-toggles.tsx
'use client';

export interface LayerState { pins: boolean; areas: boolean; choropleth: boolean; density: boolean }

const LABELS: [keyof LayerState, string][] = [
  ['pins', 'Clientes (pines)'],
  ['areas', 'Zonas'],
  ['choropleth', 'Ingresos por zona'],
  ['density', 'Densidad de ingresos'],
];

export function LayerToggles({ layers, onChange }: { layers: LayerState; onChange: (l: LayerState) => void }) {
  return (
    <fieldset className="space-y-1 p-4 pt-0">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Capas</legend>
      {LABELS.map(([key, label]) => (
        <label key={key} className="flex min-h-11 items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={layers[key]}
            onChange={e => onChange({ ...layers, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
```

```tsx
// app/(app)/mapa/components/choropleth-legend.tsx
'use client';

import type { Scale } from '@/lib/geo/color-scale';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ChoroplethLegend({ scale }: { scale: Scale }) {
  return (
    <div className="absolute bottom-6 left-3 z-[500] rounded-md bg-white p-3 text-xs text-gray-800 shadow" role="group" aria-label="Leyenda de ingresos por zona">
      <p className="mb-1 font-semibold">Ingresos por zona (USD)</p>
      <ul className="space-y-1">
        {scale.breaks.map(b => (
          <li key={b} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-6 rounded-sm border border-gray-400" style={{ background: scale.colorFor(b) }} />
            <span className="tabular-nums">{usd.format(b)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-gray-500">Clientes según los filtros activos</p>
    </div>
  );
}
```

- [ ] **Step 3: Extend `CustomerMap`**

In `customer-map.tsx` add to `CustomerMapProps`: `showPins?: boolean; focus?: { lat: number; lng: number; key: number } | null;`. Render the pin markers only when `showPins !== false`. Add:

```tsx
function FocusOn({ focus }: { focus: { lat: number; lng: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 14), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, map]);
  return null;
}
```

and mount `<FocusOn focus={focus ?? null} />` next to `<FitBounds … />`.

- [ ] **Step 4: Update popup, table, filter panel**

- `customer-popup.tsx`: add a row `<dt>Zona</dt><dd>{customer.areaName ?? 'Sin zona'}</dd>` after "Vendedor", and, when `customer.sellerMismatch`, below the grid:
  ```tsx
  <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900" role="note">
    Vendedor distinto al de la zona ({customer.areaSellerCodes.join(', ')})
  </p>
  ```
- `customer-table.tsx`: add a `Zona` column (text `c.areaName ?? '—'`, plus a `⚠ vendedor distinto` suffix when `c.sellerMismatch`).
- `filter-panel.tsx`: add `areas: AreaDto[]` to `Props`; after the Ruta block add a `Zona` `SearchableSelect` (`value={filters.area === null ? null : String(filters.area)}`, `onChange={v => onChange({ ...filters, area: v === null ? null : Number(v) })}`, options from `areas`, `allLabel="Todas las zonas"`); pass `areas` into `filterChips(filters, { sellers, routes, areas })`; in `clear()` add `if (key === 'area') next.area = null;`.

- [ ] **Step 5: Wire layers into `mapa-client.tsx`**

Add state and derived data:

```tsx
  const [layers, setLayers] = useState<LayerState>({ pins: true, areas: true, choropleth: false, density: false });
  const [highlightAreaId, setHighlightAreaId] = useState<number | null>(null);
  const areas = payload?.areas ?? [];
  const stats = useMemo(() => areaRevenue(visible, areas), [visible, areas]);
  const scale = useMemo(() => (layers.choropleth ? buildScale([...stats.values()].map(s => s.revenueUsd)) : null), [layers.choropleth, stats]);
  const heat = useMemo(() => (layers.density ? heatPoints(visible) : []), [layers.density, visible]);
```

Update the existing calls: `normalizeFilters(next, payload?.routes ?? [], payload?.areas ?? [])`; `<FilterPanel … areas={areas} />`; render `<LayerToggles layers={layers} onChange={setLayers} />` directly under `FilterPanel` in the left aside; pass `showPins={layers.pins}` to `CustomerMap` and mount as its children:

```tsx
              {(layers.areas || layers.choropleth) && <AreaPolygons areas={areas} stats={stats} scale={scale} highlightId={highlightAreaId} />}
              {layers.density && <HeatLayer points={heat} />}
```

and, after `<CustomerMap …/>` inside the map wrapper `div`, `{scale && <ChoroplethLegend scale={scale} />}`. Also fix the `fitKey` behaviour: replace the effect's `setFitKey(k => k + 1)` with a ref so re-fetches that do not change the period (area/route saves in Tasks 7–8) don't re-fit the map:

```tsx
  const lastRange = useRef<string | null>(null);
  // inside .then(p => { … }):
  setPayload(p);
  if (lastRange.current !== filters.dateRange) { lastRange.current = filters.dateRange; setFitKey(k => k + 1); }
```

and add `reloadKey` state (`const [reloadKey, setReloadKey] = useState(0)`) included in that effect's dependency array so Task 7 can force a reload after an area save.

- [ ] **Step 6: Verify in the browser and commit**

Run: `bun dev`; with at least one area created through the API (use `curl`/DevTools `fetch('/api/mapa/zonas', { method: 'POST', … })` with a valid ring around some located customers — the drawing UI arrives in Task 7). Check: Zonas layer outlines + labels, "Ingresos por zona" toggles the choropleth with a numeric legend and the lowest color for an empty area, "Densidad" shows a heat blob and toggling it off removes it, "Clientes (pines)" off hides pins, the popup shows Zona and the mismatch note, the table has the Zona column, the Zona filter chip works. `bunx tsc --noEmit` clean.

```bash
git add package.json bun.lock types "app/(app)/mapa"
git commit -m "feat(mapa): area, choropleth and density layers with legend and toggles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Drawing and editing areas (Geoman) + Zonas panel

**Files:**
- Create: `app/(app)/mapa/components/area-drawing.tsx`, `areas-panel.tsx`
- Modify: `app/(app)/mapa/mapa-client.tsx`

**Interfaces:**
- Consumes: `Ring`, `ringFromLatLngs`, `ringToLatLngs` (Task 1); `AreaDto`, `AreaStats`; `MapSeller`; `Modal`; `POST/PATCH/DELETE /api/mapa/zonas` (Task 5).
- Produces:
  ```ts
  export interface AreaDrawingProps {
    mode: 'idle' | 'draw' | 'edit';
    editRing: Ring | null;                 // seeds the editable layer when mode becomes 'edit'
    onDrawn: (ring: Ring) => void;
    onEdited: (ring: Ring) => void;
    onCancel: () => void;
  }
  export function AreaDrawing(props: AreaDrawingProps): null;      // must be rendered inside <MapContainer> (CustomerMap children)

  export interface AreaDraft {
    id: number | null; name: string; color: string; sellerCodes: string[]; ring: Ring | null;
    phase: 'draw' | 'form' | 'shape'; saving: boolean; error: string | null;
  }
  export function AreasPanel(props: {
    areas: AreaDto[]; stats: Map<number, AreaStats>; sellers: MapSeller[];
    draft: AreaDraft | null;
    onStartDraw: () => void;
    onEditArea: (area: AreaDto) => void;
    onChangeDraft: (patch: Partial<AreaDraft>) => void;
    onEditShape: () => void;
    onDoneShape: () => void;
    onSave: () => void;
    onCancel: () => void;
    onDelete: (area: AreaDto) => Promise<string | null>;       // resolves to an error message, or null on success
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the Geoman integration**

```tsx
// app/(app)/mapa/components/area-drawing.tsx
'use client';

import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { ringFromLatLngs, ringToLatLngs, type Ring } from '@/lib/geo/geometry';

export interface AreaDrawingProps {
  mode: 'idle' | 'draw' | 'edit';
  editRing: Ring | null;
  onDrawn: (ring: Ring) => void;
  onEdited: (ring: Ring) => void;
  onCancel: () => void;
}

// Callbacks live in a ref so the effects depend ONLY on `mode`: a parent
// re-render with fresh closures must never tear down an in-progress drawing.
export function AreaDrawing({ mode, editRing, onDrawn, onEdited, onCancel }: AreaDrawingProps) {
  const map = useMap();
  const cb = useRef({ onDrawn, onEdited, onCancel });
  cb.current = { onDrawn, onEdited, onCancel };

  // Draw a new polygon: click to add points, click the first point to close, Esc cancels.
  useEffect(() => {
    if (mode !== 'draw') return;
    map.pm.enableDraw('Polygon', {
      allowSelfIntersection: false,
      snappable: false,
      templineStyle: { color: '#2563eb' },
      hintlineStyle: { color: '#2563eb', dashArray: [5, 5] },
      pathOptions: { color: '#2563eb' },
    });
    const onCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      const ring = ringFromLatLngs(layer.getLatLngs() as L.LatLng[][]);
      layer.remove();                       // the saved area is rendered from state, not from this layer
      cb.current.onDrawn(ring);
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cb.current.onCancel(); };
    map.on('pm:create', onCreate as L.LeafletEventHandlerFn);
    document.addEventListener('keydown', onKey);
    return () => {
      map.off('pm:create', onCreate as L.LeafletEventHandlerFn);
      document.removeEventListener('keydown', onKey);
      map.pm.disableDraw();
    };
  }, [mode, map]);

  // Edit an existing/just-drawn shape: drag vertices, add points on edges.
  useEffect(() => {
    if (mode !== 'edit' || !editRing) return;
    const layer = L.polygon(ringToLatLngs(editRing), { color: '#2563eb', weight: 3, fillOpacity: 0.1 }).addTo(map);
    layer.pm.enable({ allowSelfIntersection: false });
    const emit = () => cb.current.onEdited(ringFromLatLngs(layer.getLatLngs() as L.LatLng[][]));
    for (const ev of ['pm:edit', 'pm:vertexadded', 'pm:markerdragend', 'pm:vertexremoved']) layer.on(ev, emit);
    return () => { layer.pm.disable(); layer.remove(); };
    // editRing seeds the layer once per entry into 'edit' mode; later ring updates come FROM this layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, map]);

  return null;
}
```

- [ ] **Step 2: Write the Zonas panel**

```tsx
// app/(app)/mapa/components/areas-panel.tsx
'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { AreaStats } from '@/lib/geo/area-match';
import type { Ring } from '@/lib/geo/geometry';
import type { MapSeller } from '@/lib/geo/types';

export interface AreaDraft {
  id: number | null;
  name: string;
  color: string;
  sellerCodes: string[];
  ring: Ring | null;
  phase: 'draw' | 'form' | 'shape';
  saving: boolean;
  error: string | null;
}

interface Props {
  areas: AreaDto[];
  stats: Map<number, AreaStats>;
  sellers: MapSeller[];
  draft: AreaDraft | null;
  onStartDraw: () => void;
  onEditArea: (area: AreaDto) => void;
  onChangeDraft: (patch: Partial<AreaDraft>) => void;
  onEditShape: () => void;
  onDoneShape: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (area: AreaDto) => Promise<string | null>;
}

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const btn = 'min-h-11 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const field = 'min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function AreasPanel(p: Props) {
  const [deleting, setDeleting] = useState<AreaDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const sellerName = (code: string) => p.sellers.find(s => s.code === code)?.name ?? code;

  return (
    <section aria-label="Zonas" className="space-y-4 p-4">
      {p.draft === null && (
        <button type="button" onClick={p.onStartDraw} className={`${btn} w-full border-blue-600 bg-blue-600 font-medium text-white hover:bg-blue-700`}>
          Dibujar nueva zona
        </button>
      )}

      {p.draft?.phase === 'draw' && (
        <div role="status" className="space-y-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Dibujando zona</p>
          <p>Haga clic en el mapa para agregar puntos y clic en el primer punto para cerrar. Esc cancela.</p>
          <button type="button" onClick={p.onCancel} className={`${btn} border-blue-600 bg-white text-blue-800`}>Cancelar</button>
        </div>
      )}

      {p.draft?.phase === 'shape' && (
        <div role="status" className="space-y-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Editando la forma</p>
          <p>Arrastre los puntos para ajustar los bordes. Los bordes no pueden cruzarse.</p>
          <button type="button" onClick={p.onDoneShape} className={`${btn} border-blue-600 bg-blue-600 font-medium text-white`}>Listo</button>
        </div>
      )}

      {p.draft?.phase === 'form' && (
        <form onSubmit={e => { e.preventDefault(); p.onSave(); }} aria-label={p.draft.id === null ? 'Nueva zona' : 'Editar zona'} className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <div>
            <label htmlFor="area-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre</label>
            <input id="area-name" className={field} value={p.draft.name} onChange={e => p.onChangeDraft({ name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="area-color" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Color</label>
            <input id="area-color" type="color" className="h-11 w-16 cursor-pointer rounded-md border border-gray-300" value={p.draft.color} onChange={e => p.onChangeDraft({ color: e.target.value })} />
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Vendedores de la zona</legend>
            <ul className="max-h-40 overflow-auto">
              {p.sellers.map(s => (
                <li key={s.code}>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-gray-800">
                    <input type="checkbox" className="h-4 w-4" checked={p.draft!.sellerCodes.includes(s.code)}
                      onChange={e => p.onChangeDraft({ sellerCodes: e.target.checked ? [...p.draft!.sellerCodes, s.code] : p.draft!.sellerCodes.filter(c => c !== s.code) })} />
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {p.draft.error && <p role="alert" className="text-sm text-red-700">{p.draft.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={p.draft.saving} className={`${btn} border-blue-600 bg-blue-600 font-medium text-white disabled:opacity-60`}>{p.draft.saving ? 'Guardando…' : 'Guardar zona'}</button>
            <button type="button" onClick={p.onEditShape} className={`${btn} border-gray-300 bg-white`}>Editar forma</button>
            <button type="button" onClick={p.onCancel} disabled={p.draft.saving} className={`${btn} border-gray-300 bg-white`}>Cancelar</button>
          </div>
        </form>
      )}

      {p.areas.length === 0 ? <p className="text-sm text-gray-500">Aún no hay zonas.</p> : (
        <ul aria-label="Zonas existentes" className="divide-y divide-gray-100">
          {p.areas.map(a => {
            const s = p.stats.get(a.id);
            return (
              <li key={a.id} className="space-y-2 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-gray-400" style={{ background: a.color }} />{a.name}
                </p>
                <p className="text-xs text-gray-500">
                  {a.sellerCodes.length ? a.sellerCodes.map(sellerName).join(', ') : 'Sin vendedores'} · {s?.customers ?? 0} clientes · {usd.format(s?.revenueUsd ?? 0)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`${btn} border-gray-300 hover:bg-gray-50`} onClick={() => p.onEditArea(a)}>Editar</button>
                  <button type="button" className={`${btn} border-red-300 text-red-700 hover:bg-red-50`} onClick={() => { setDeleteError(null); setDeleting(a); }}>Eliminar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <Modal title="Eliminar zona" onClose={() => setDeleting(null)}>
          <p className="text-sm text-gray-700">¿Eliminar la zona «{deleting.name}»? Sus clientes quedarán sin zona.</p>
          {deleteError && <p role="alert" className="mt-2 text-sm text-red-700">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={`${btn} border-gray-300`} onClick={() => setDeleting(null)}>Cancelar</button>
            <button type="button" className={`${btn} border-red-600 bg-red-600 font-medium text-white`}
              onClick={async () => { const err = await p.onDelete(deleting); if (err) setDeleteError(err); else setDeleting(null); }}>
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Wire the draft state machine into `mapa-client.tsx`**

Add (alongside the Task 6 state):

```tsx
  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null);

  const startDraw = useCallback(() => {
    setDraft(null);                                               // cancel any customer-location edit
    setAreaDraft({ id: null, name: '', color: '#2563eb', sellerCodes: [], ring: null, phase: 'draw', saving: false, error: null });
    setHighlightAreaId(null);
  }, []);

  const editArea = useCallback((a: AreaDto) => {
    setDraft(null);
    setAreaDraft({ id: a.id, name: a.name, color: a.color, sellerCodes: a.sellerCodes, ring: a.ring, phase: 'form', saving: false, error: null });
    setHighlightAreaId(null);
  }, []);

  const onDrawn = useCallback((ring: Ring) => setAreaDraft(d => d && { ...d, ring, phase: 'form' }), []);
  const onShapeEdited = useCallback((ring: Ring) => setAreaDraft(d => d && { ...d, ring }), []);
  const cancelArea = useCallback(() => { setAreaDraft(null); setHighlightAreaId(null); }, []);

  async function saveArea() {
    if (!areaDraft?.ring) return;
    setAreaDraft({ ...areaDraft, saving: true, error: null });
    const body = { name: areaDraft.name, color: areaDraft.color, ring: areaDraft.ring, sellerCodes: areaDraft.sellerCodes };
    const res = await fetch(areaDraft.id === null ? '/api/mapa/zonas' : `/api/mapa/zonas/${areaDraft.id}`, {
      method: areaDraft.id === null ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setHighlightAreaId(json?.conflictAreaId ?? null);           // overlap: highlight the area we collide with
      setAreaDraft(d => d && { ...d, saving: false, error: json?.error ?? 'Error al guardar la zona' });
      return;
    }
    setAreaDraft(null); setHighlightAreaId(null);
    setReloadKey(k => k + 1);                                     // matches/revenue change when an area changes
  }

  async function deleteAreaById(a: AreaDto): Promise<string | null> {
    const res = await fetch(`/api/mapa/zonas/${a.id}`, { method: 'DELETE' });
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? 'Error al eliminar la zona';
    setReloadKey(k => k + 1);
    return null;
  }
```

Mutual exclusion with Plan 2's location editing: at the top of `startEditing` (Task 9 of Plan 2) add `setAreaDraft(null);`. Render, as map children inside `CustomerMap`:

```tsx
              <AreaDrawing
                mode={areaDraft?.phase === 'draw' ? 'draw' : areaDraft?.phase === 'shape' ? 'edit' : 'idle'}
                editRing={areaDraft?.ring ?? null}
                onDrawn={onDrawn}
                onEdited={onShapeEdited}
                onCancel={cancelArea}
              />
```

Add `'areas'` to the `rightTab` union with a third `role="tab"` button `Zonas ({areas.length})` and render:

```tsx
        <AreasPanel
          areas={areas} stats={stats} sellers={sellers} draft={areaDraft}
          onStartDraw={startDraw} onEditArea={editArea}
          onChangeDraft={patch => setAreaDraft(d => d && { ...d, ...patch })}
          onEditShape={() => setAreaDraft(d => d && { ...d, phase: 'shape' })}
          onDoneShape={() => setAreaDraft(d => d && { ...d, phase: 'form' })}
          onSave={saveArea} onCancel={cancelArea} onDelete={deleteAreaById}
        />
```

Also: when `areaDraft` is non-null and `view === 'table'`, switch `view` to `'map'` (drawing needs the map): `useEffect(() => { if (areaDraft && view === 'table') setView('map'); }, [areaDraft, view]);`. While drawing/editing a shape, keep the new/edited polygon visible only through `AreaDrawing`'s own layer (the saved copy of an area being edited is still rendered by `AreaPolygons` until the save succeeds — acceptable and makes the "before" visible).

- [ ] **Step 4: Verify in the browser and commit**

Run `bun dev` as an admin on `/mapa` → Zonas tab: "Dibujar nueva zona" → click 4 points and click the first to close → the form appears; name it, pick sellers, Guardar → the area appears with a label and the customers inside get the area in popups/table; draw a second area overlapping the first → red error "La zona se superpone con «…»" and the first area is highlighted red/dashed; draw a bow-tie → "Los bordes de la zona se cruzan entre sí" (Geoman itself also blocks it); "Editar" an area → "Editar forma" → drag a vertex → Listo → Guardar; Esc during drawing cancels with no area created; Eliminar → modal above the map → customers show "Sin zona". `bunx tsc --noEmit` clean.

```bash
git add "app/(app)/mapa"
git commit -m "feat(mapa): draw, edit and delete sales areas with Geoman

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Discrepancias panel (mismatches and customers outside every area)

**Files:**
- Create: `app/(app)/mapa/components/mismatch-panel.tsx`
- Test: `__tests__/unit/geo/discrepancies.test.ts`
- Create: `lib/geo/discrepancies.ts`
- Modify: `app/(app)/mapa/mapa-client.tsx`

**Interfaces:**
- Consumes: `MapCustomer`, `MapSeller` (Plan 2/Task 3).
- Produces:
  ```ts
  // lib/geo/discrepancies.ts
  export interface Discrepancies { mismatched: MapCustomer[]; outside: MapCustomer[] }
  export function findDiscrepancies(customers: MapCustomer[], hasAreas: boolean): Discrepancies;
  // mismatch-panel.tsx
  export function MismatchPanel(props: { customers: MapCustomer[]; hasAreas: boolean; sellers: MapSeller[]; onFocus: (coCli: string) => void }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/discrepancies.test.ts
import { describe, test, expect } from 'bun:test';
import { findDiscrepancies } from '@/lib/geo/discrepancies';
import type { MapCustomer } from '@/lib/geo/types';

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '1', sellerName: null, direc1: null, dirEnt2: null,
  lat: 10, lng: -66, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

describe('findDiscrepancies', () => {
  const rows = [
    cust({ coCli: 'ok', areaId: 1, areaName: 'N', areaSellerCodes: ['1'] }),
    cust({ coCli: 'bad', areaId: 1, areaName: 'N', areaSellerCodes: ['2'], sellerMismatch: true }),
    cust({ coCli: 'out' }),
    cust({ coCli: 'nocoords', lat: null, lng: null }),
  ];
  test('mismatched = flagged customers; outside = located customers in no area', () => {
    const d = findDiscrepancies(rows, true);
    expect(d.mismatched.map(c => c.coCli)).toEqual(['bad']);
    expect(d.outside.map(c => c.coCli)).toEqual(['out']);
  });
  test('with no areas defined nothing is "outside" (there is nothing to be outside of)', () => {
    expect(findDiscrepancies(rows, false).outside).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/discrepancies.test.ts` → FAIL (module missing).

```ts
// lib/geo/discrepancies.ts
import type { MapCustomer } from './types';

export interface Discrepancies { mismatched: MapCustomer[]; outside: MapCustomer[] }

export function findDiscrepancies(customers: MapCustomer[], hasAreas: boolean): Discrepancies {
  return {
    mismatched: customers.filter(c => c.sellerMismatch),
    outside: hasAreas ? customers.filter(c => c.lat !== null && c.areaId === null) : [],
  };
}
```

Run again → PASS.

- [ ] **Step 3: Write the panel**

```tsx
// app/(app)/mapa/components/mismatch-panel.tsx
'use client';

import { findDiscrepancies } from '@/lib/geo/discrepancies';
import type { MapCustomer, MapSeller } from '@/lib/geo/types';

interface Props { customers: MapCustomer[]; hasAreas: boolean; sellers: MapSeller[]; onFocus: (coCli: string) => void }

const btn = 'min-h-11 shrink-0 rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function MismatchPanel({ customers, hasAreas, sellers, onFocus }: Props) {
  const { mismatched, outside } = findDiscrepancies(customers, hasAreas);
  const sellerName = (code: string) => sellers.find(s => s.code === code)?.name ?? code;

  if (!hasAreas) return <p className="p-4 text-sm text-gray-500">Defina zonas para ver discrepancias.</p>;

  return (
    <div>
      <h3 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-600">Vendedor distinto al de la zona ({mismatched.length})</h3>
      {mismatched.length === 0 ? <p className="px-4 py-2 text-sm text-gray-500">Sin discrepancias.</p> : (
        <ul aria-label="Clientes con vendedor distinto al de la zona" className="divide-y divide-gray-100">
          {mismatched.map(c => (
            <li key={c.coCli} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {c.sellerName ?? c.coVen} · zona «{c.areaName}» ({c.areaSellerCodes.map(sellerName).join(', ')})
                </p>
              </div>
              <button type="button" className={btn} onClick={() => onFocus(c.coCli)}>Ver</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-600">Fuera de toda zona ({outside.length})</h3>
      {outside.length === 0 ? <p className="px-4 py-2 text-sm text-gray-500">Todos los clientes ubicados están en una zona.</p> : (
        <ul aria-label="Clientes fuera de toda zona" className="divide-y divide-gray-100">
          {outside.map(c => (
            <li key={c.coCli} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                <p className="truncate text-xs text-gray-500">{c.sellerName ?? c.coVen}</p>
              </div>
              <button type="button" className={btn} onClick={() => onFocus(c.coCli)}>Ver</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount it in `mapa-client.tsx`**

Add `'mismatch'` to `rightTab` with a fourth tab button `Discrepancias (N)` where `N = discrepancies.mismatched.length + discrepancies.outside.length` (compute with `useMemo(() => findDiscrepancies(payload?.customers ?? [], areas.length > 0), …)`). Add `const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);` and

```tsx
  const focusCustomer = useCallback((coCli: string) => {
    const c = payload?.customers.find(x => x.coCli === coCli);
    if (!c || c.lat === null || c.lng === null) return;
    setView('map'); setSelected(coCli);
    setFocus(f => ({ lat: c.lat!, lng: c.lng!, key: (f?.key ?? 0) + 1 }));
  }, [payload]);
```

Pass `focus={focus}` to `CustomerMap` and render `<MismatchPanel customers={payload?.customers ?? []} hasAreas={areas.length > 0} sellers={sellers} onFocus={focusCustomer} />` for that tab.

- [ ] **Step 5: Verify and commit**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/ && bunx tsc --noEmit`; in the browser create two areas with different sellers and confirm the Discrepancias tab lists a customer whose `coVen` differs, "Ver" recentres the map on it, and customers outside every area are listed separately.

```bash
git add lib/geo/discrepancies.ts __tests__/unit/geo/discrepancies.test.ts "app/(app)/mapa"
git commit -m "feat(mapa): discrepancias panel (seller mismatches, outside every area)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: E2E, docs, final verification

**Files:**
- Modify: `e2e/mapa.spec.ts`
- Modify: `AGENTS.md`, `docs/superpowers/specs/2026-09-30-customer-map-design.md`

- [ ] **Step 1: Add the e2e area flows**

Append to `e2e/mapa.spec.ts`:

```ts
// @mssql — the page loads ERP + DWH data; the area flows themselves only need SQLite.
test.describe('mapa sales areas @mssql', () => {
  async function drawSquare(page: import('@playwright/test').Page, box: { x: number; y: number; width: number; height: number }, fx: number, fy: number, size: number) {
    const p = (dx: number, dy: number) => ({ x: box.x + box.width * (fx + dx), y: box.y + box.height * (fy + dy) });
    const pts = [p(0, 0), p(size, 0), p(size, size), p(0, size)];
    for (const pt of pts) await page.mouse.click(pt.x, pt.y);
    await page.mouse.click(pts[0].x, pts[0].y);              // clicking the first point closes the polygon
  }

  test('draw, save, reject an overlapping area, then delete', async ({ adminPage }) => {
    const suffix = Date.now();
    await adminPage.goto('/mapa');
    const map = adminPage.getByTestId('customer-map');
    await expect(map).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    const box = (await map.boundingBox())!;

    // first area
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await drawSquare(adminPage, box, 0.2, 0.2, 0.2);
    await adminPage.getByLabel('Nombre').fill(`E2E Zona A ${suffix}`);
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    const list = adminPage.getByRole('list', { name: 'Zonas existentes' });
    await expect(list.getByText(`E2E Zona A ${suffix}`)).toBeVisible();

    // overlapping second area is rejected and names the first
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await drawSquare(adminPage, box, 0.3, 0.3, 0.2);
    await adminPage.getByLabel('Nombre').fill(`E2E Zona B ${suffix}`);
    await adminPage.getByRole('button', { name: 'Guardar zona' }).click();
    await expect(adminPage.getByRole('alert')).toContainText(`E2E Zona A ${suffix}`);
    await adminPage.getByRole('button', { name: 'Cancelar' }).click();

    // delete the first
    await list.locator('li', { hasText: `E2E Zona A ${suffix}` }).getByRole('button', { name: 'Eliminar' }).click();
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(`E2E Zona A ${suffix}`)).not.toBeVisible();
  });

  test('Esc cancels drawing without creating an area', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole('tab', { name: /Zonas/ }).click();
    await adminPage.getByRole('button', { name: 'Dibujar nueva zona' }).click();
    await expect(adminPage.getByText('Dibujando zona')).toBeVisible();
    await adminPage.keyboard.press('Escape');
    await expect(adminPage.getByText('Dibujando zona')).not.toBeVisible();
  });

  test('layer toggles show the choropleth legend', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });
    await adminPage.getByLabel('Ingresos por zona').check();
    await expect(adminPage.getByRole('group', { name: 'Leyenda de ingresos por zona' })).toBeVisible();
    await adminPage.getByLabel('Densidad de ingresos').check();
    await adminPage.getByLabel('Clientes (pines)').uncheck();
  });
});
```

(The drawn squares sit on the default Venezuela view regardless of data. The map `boundingBox` fractions avoid the panels because the map container excludes them. If Geoman ignores the synthetic first-point click, replace the last click with `adminPage.mouse.dblclick(...)` on the last vertex — Geoman's other completion gesture — rather than loosening the assertions.)

- [ ] **Step 2: Run the e2e specs**

Run: `bun run e2e:seed && bun run e2e -- e2e/mapa.spec.ts`, and, with the ERP mock + DWH available, `bun run e2e:mssql -- e2e/mapa.spec.ts`. `SQLITE_PATH` must be pinned to `e2e/.tmp`.
Expected: Plan 2's access tests still PASS; the three area flows PASS under `@mssql`.

- [ ] **Step 3: Update `AGENTS.md`**

In the "Customer Map (`/mapa`)" section added by Plan 2 add: sales areas live in SQLite (`sales_areas`, `sales_area_sellers`), polygons are GeoJSON `[lng, lat]`; areas cannot overlap (shared borders are fine); matching is computed on read in `GET /api/mapa/clientes` via `lib/geo/area-match.ts` and is never stored or written to the ERP; mismatch = customer's `co_ven` not among the area's sellers; geometry is dependency-free (`lib/geo/geometry.ts`). Add `lib/geo/{geometry,area-validation,areas-repo,area-match,color-scale,layers,discrepancies}.ts` to the Directory Map and `app/api/mapa/zonas/` to the API list.

- [ ] **Step 4: Final spec check and full verification**

In the spec, confirm the Sales areas section matches what shipped (mismatch rule: "area has ≥ 1 seller and the customer's seller is not among them"; areas with no sellers produce no mismatch; border customers resolve to the lowest area id). Edit any sentence that differs.

Run: `bunx tsc --noEmit && bun run lint && bun run test:unit && bun run build`
Expected: no type errors, no new lint errors, all unit tests pass, production build succeeds (this proves Leaflet/Geoman/leaflet.heat stay out of the server bundle behind `ssr: false`).

- [ ] **Step 5: Commit**

```bash
git add e2e/mapa.spec.ts AGENTS.md docs/superpowers/specs/2026-09-30-customer-map-design.md
git commit -m "test(mapa): e2e for sales areas; docs: areas in AGENTS.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (done by plan author)

- **Spec coverage (Section 3):** polygons stored in SQLite with name/color → Task 2; many sellers per area → Task 2 (`sales_area_sellers`); no overlaps with the error naming and highlighting the conflict → Tasks 1, 2, 5, 7; validity (≥ 3 vertices, no self-intersection) → Tasks 1, 2; auto-match on read, never persisted/never written to the ERP → Task 3 + Task 5; mismatch list and "outside every area" → Tasks 3, 8; choropleth with numeric legend, boundary and direct labels → Tasks 4, 6; density layer → Tasks 3, 6; layer toggles → Task 6; area filter + popup/table zone info → Tasks 3, 6; draw/edit with a mode banner and Esc cancel → Task 7; delete confirmation via `Modal` → Task 7; tests/docs → Task 9.
- **Placeholders:** none. The two "if Geoman/typing misbehaves" notes name a concrete fallback, not a deferral.
- **Type consistency:** `Ring`/`Point` (Task 1) are used unchanged by Tasks 2, 3, 6, 7; `AreaDto` (Task 2) is the only area shape in the payload, filters, layers and panels; `AreaStats`, `Scale`, `LayerState`, `AreaDraft` are defined once; `MapFilters.area`, `MapCustomer.areaId/areaName/areaSellerCodes/sellerMismatch` and `MapPayload.areas` are introduced in Task 3 and consumed with identical names afterwards; Plan 2's `normalizeFilters`/`filterChips` get an explicit extra `areas` parameter, defaulted so the tree stays green between tasks.
- **Review Focus coverage:** bow-tie/degenerate/closed rings → Task 1 + Task 2 tests; winding independence → Task 1 tests; shared-edge accepted vs identical/nested/diamond rejected → Task 1 and Task 2 tests; self-edit and duplicate-name → Task 2 tests; border customer determinism → Task 3 test; no-seller area and no-coordinate customers → Task 3 tests; empty/equal-value scale → Task 4 tests; empty heat set → Task 3 test + `HeatLayer` guard; delete cascade → Task 2 test; mode exclusivity (draw vs location edit) → Task 7 wiring (`startDraw` clears the location draft, `startEditing` clears the area draft) and the e2e Esc test.
