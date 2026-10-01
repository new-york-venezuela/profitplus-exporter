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

// All points on one line (a bow-tie has signed area 0 but is not degenerate).
function collinear(ring: Ring): boolean {
  return ring.every(p => Math.abs(cross(ring[0], ring[1], p)) < EPS);
}

export function validatePolygon(input: Ring): { ok: true } | { ok: false; error: PolygonError } {
  if (input.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return { ok: false, error: 'NON_FINITE' };
  const ring = normalizeRing(input);
  if (ring.length < 3) return { ok: false, error: 'TOO_FEW_VERTICES' };
  if (ring.some(([lng, lat]) => lng < -180 || lng > 180 || lat < -90 || lat > 90)) return { ok: false, error: 'OUT_OF_RANGE' };
  if (collinear(ring)) return { ok: false, error: 'ZERO_AREA' };

  const es = edges(ring);
  const n = es.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) {
        // Adjacent edges legitimately share one endpoint; they only conflict if they double back collinearly.
        // (the wrap-around pair i=0, j=n-1 meets at es[i][0] instead of es[i][1])
        const [a, b] = j === i + 1 ? es[i] : es[j]; const [, d] = j === i + 1 ? es[j] : es[i];
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

// Inside-intervals of a polygon along the horizontal line at height y
// (y must not pass through a vertex).
function scanIntervals(ring: Ring, y: number): [number, number][] {
  const xs: number[] = [];
  for (const [a, b] of edges(ring)) {
    if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
  }
  xs.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

// Interiors intersect iff some edges properly cross, or a vertex of one is
// strictly inside the other, or — for shapes whose vertices only touch the
// other's boundary (identical, diamond-in-square, shifted rectangles on the
// same band) — some horizontal scanline, taken between two consecutive vertex
// heights of either polygon, has inside-intervals that overlap with positive
// length. The scanline test is exact for simple polygons: if the interiors
// share any area, they share it on a band between vertex heights.
// Shared borders and shared corners do NOT overlap.
export function polygonsOverlap(a: Ring, b: Ring): boolean {
  const ea = edges(a), eb = edges(b);
  for (const [p, q] of ea) for (const [r, s] of eb) if (properCross(p, q, r, s)) return true;
  if (a.some(p => pointInPolygon(p, b, 'outside'))) return true;
  if (b.some(p => pointInPolygon(p, a, 'outside'))) return true;
  const ys = [...new Set([...a, ...b].map(p => p[1]))].sort((p, q) => p - q);
  for (let i = 0; i + 1 < ys.length; i++) {
    const y = (ys[i] + ys[i + 1]) / 2;
    const ia = scanIntervals(a, y), ib = scanIntervals(b, y);
    for (const [l1, r1] of ia) for (const [l2, r2] of ib) if (Math.min(r1, r2) - Math.max(l1, l2) > EPS) return true;
  }
  return false;
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
