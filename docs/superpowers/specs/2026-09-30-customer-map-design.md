# Customer Map, Routes and Sales Areas — Design

Date: 2026-09-30
Status: awaiting spec review

## Goal

Let the business see **where customers are** and **which sales areas each
Captador (seller) covers**, on a map: revenue heatmaps, sales-area
management, automatic customer-to-area matching, customer popups
(revenue, segment), route (customer group) filtering, and editing of a
customer's delivery address and coordinates. A geocoding script pre-fills
coordinates so the map works from day one.

## Decisions (agreed during brainstorming)

| Topic | Decision |
|---|---|
| Route | A named group of customers a seller visits. App-owned (SQLite). A seller has many routes; a customer may be in several. |
| Map unit | Each `saCliente` row is one pin. Stores with no ERP row are out of scope (data model leaves room). |
| Coordinate storage | ERP `saCliente.campo1` (varchar(60)). `campo1`–`campo8` are all empty today (144 customers), so `campo1` is free. |
| Coordinate syntax | `Coordenadas: (lat, lng)`, e.g. `Coordenadas: (10.480600, -66.903600)`. Order is **lat, lng**. |
| Validation | Venezuela bounding box (≈ lat 0.6–12.3, lng −73.4 to −59.8). Swapped values are rejected with `SWAPPED_SUSPECTED`. Decimal separator is a dot only (a comma is ambiguous with the lat/lng separator). |
| Delivery address | ERP `saCliente.dir_ent2`, edited from the map. |
| Geocoding | Script, providers: Nominatim (OSM) then Google fallback (`--provider osm\|google\|both`, default `both`). Dry-run by default; `--apply` writes; only fills empty `campo1` unless `--force`. Low-confidence and out-of-box results are never written, even with `--apply`; they are listed for manual placement. |
| Data merge | Coordinates read live from the ERP, revenue/segment from the DWH, merged in TypeScript by `CustomerCode`. No DWH schema change. |
| DWH rule | `AGENTS.md` rule "never query dim/fact outside the analytics routes" is relaxed: any module may read the DWH through `getDwhPool()` using `.input()` for user-controlled values. |
| Sales areas | Polygons in SQLite. Several sellers per area. No overlaps between areas. Customer-to-area match is computed on read (point-in-polygon), never stored, never written back to the ERP. |
| Mismatch | Customer whose `co_ven` is not among its area's sellers; also customers outside every area. |
| Heatmap | Two toggleable layers: per-area choropleth (revenue total) and point-density (`leaflet.heat`, weighted by revenue), plus the pin layer. |
| Access | New module `'geo'`, enforced independently on the page and every `/api/mapa/*` route. |
| Cleanup | Remove the `rutas` tab stub (`analitica-client.tsx:50`) and any dead references. |

## Delivery order (separate plans)

1. **Foundations** — coordinate module, ERP write procedure, geocoding script, remove Rutas stub, `AGENTS.md` update.
2. **Map and routes** — `/mapa`, pins, popups, filters, location editing, routes.
3. **Sales areas** — drawing, seller assignment, auto-match, mismatch list, heatmap layers.

## Plans

Dependency order; each plan must be merged before the next starts.

1. `docs/superpowers/plans/2026-09-30-customer-map-1-foundations.md`
2. `docs/superpowers/plans/2026-09-30-customer-map-2-map-and-routes.md`
3. `docs/superpowers/plans/2026-09-30-customer-map-3-sales-areas.md`

## 1. Foundations

### Coordinate module — `lib/geo/coordinates.ts` (pure)

- `parseCoordinates(raw: string): { lat: number; lng: number } | null` —
  accepts `Coordenadas: (10.4806, -66.9036)`, tolerant of whitespace and
  case; returns `null` for anything else.
- `validateCoordinates(c)` — Venezuela bounding box. Typed errors
  `OUT_OF_RANGE` and `SWAPPED_SUSPECTED` (swapping lat/lng would land
  inside the box).
- `formatCoordinates(c)` — canonical string, 6 decimals (~38 chars, fits
  varchar(60)). The only way the app produces the string; round-trips
  through `parseCoordinates`.

### ERP write procedure — `migrations/mssql/NNNN_pApiActualizarUbicacionCliente.sql`

`CREATE OR ALTER`. Parameters `@co_cli`, `@campo1`, `@dir_ent2`; NULL means
"leave unchanged". Updates only those two columns. Errors on unknown
`co_cli`. Stamps modified-by/date audit fields following the convention of
the existing `pApiCrearAjusteInventario` (verify before writing). The app
never runs raw `UPDATE` on `saCliente`.

### Geocoding script — `scripts/geocode-customers.ts` (bun)

- Selects active customers with empty `campo1` (all with `--force`).
- Address: `dir_ent2`, falling back to `direc1` (132/144 have `dir_ent2`,
  144/144 have `direc1`); appends "Venezuela"; normalizes whitespace and
  common abbreviations (`Av.`, `C.C.`).
- Nominatim first (1 req/s, proper `User-Agent`); on no/low-importance
  result falls back to Google when `GOOGLE_MAPS_API_KEY` is set.
- Every candidate passes `validateCoordinates`; out-of-box results are
  discarded.
- Dry-run prints customer, address used, provider, coordinates,
  confidence (Nominatim importance / Google `location_type`). `--apply`
  calls the write procedure. Failures and low-confidence rows are listed
  for manual placement. Safe to re-run.

### Cleanup

Remove the `rutas` entry and its `TabStub` import if unused; grep e2e
tests and docs for "Rutas y Logística".

## 2. Map and routes

### Data (SQLite, Drizzle, `lib/db/schema.ts` + migration in `migrations/sqlite/`)

- `routes` (`id`, `name`, `sellerCode`)
- `route_customers` (`routeId`, `customerCode`) — composite key
- (sales-area tables are in section 3)

### API (every route: `getSessionFromRequest` + `hasGeoAccess` → 403; errors `{ error }`; PostHog capture per convention)

- `GET /api/mapa/clientes?dateRange=` — customers + coordinates (ERP,
  live), revenue USD (per row via `usdConversionJoin`/`dualAmountExpr` from `app/api/dwh/lib/query-builder.ts`, never a single current rate), Pareto segment, matched
  area, routes, default seller. Merged in TypeScript by customer code.
- `PATCH /api/mapa/clientes/[co_cli]/ubicacion` — validates with the
  coordinate module, calls the ERP procedure.
- `GET/POST/PATCH/DELETE /api/mapa/rutas` (+ membership endpoints).

### Pareto segment

Same definition as the analytics Clientes tab (`app/api/dwh/clientes/route.ts`): customers ranked by period net sales (BS), bucketed by cumulative share — A ≤ 20%, B ≤ 50%, C the rest (`PARETO_THRESHOLDS`). No revenue in period = grey/none.

### Page `/mapa`

`page.tsx` is a Server Component (session + `hasGeoAccess`, redirect to
`/reports/ventas` on denial). The map is a client leaf loaded with
`next/dynamic` (`ssr: false`) and a fixed-height skeleton.

- **Filters** (AND): period (default `getPreviousMonthRange()`), seller,
  route (scoped to seller), segment, sales area, "no coordinates".
  Seller/route use `SearchableSelect`. Active filters render as wrapping
  chips with remove buttons and a "Clear all". State is synced to the URL.
- **Pins**: colored by segment **and** marked with a letter (A/B/C) so
  color is not the only signal. Popup: name, code, period revenue (USD),
  segment, default seller, area seller(s), delivery address, routes,
  mismatch badge. Actions: Edit location, Add to route.
- **Edit location**: drag pin or click map, edit address, explicit
  Save/Cancel; nothing is written on drop. Field-level error text (e.g.
  "Suspected swapped lat/lng").
- **Unlocated list**: customers without coordinates; click enters
  "place on map" mode.
- **Routes panel**: create/rename/delete, assign seller, add/remove
  customers (multi-select or from a popup). Filtering by route fits map
  bounds to its customers. Delete uses the existing `Modal`.
- **Table view toggle**: sortable table of the same data (keyboard and
  screen-reader fallback).

## 3. Sales areas

### Data

- `sales_areas` (`id`, `name`, `color`, `polygon` — GeoJSON text)
- `sales_area_sellers` (`areaId`, `sellerCode`)

### Rules

- Polygon must have ≥ 3 vertices and not self-intersect.
- Areas must not overlap; the error names the conflicting area.
- Pure functions in `lib/geo/`: point-in-polygon, polygon validity,
  polygon overlap (no external geometry library).
- Auto-match on read: each customer tested against all polygons;
  result is added to the `/api/mapa/clientes` payload.
- `GET/POST/PATCH/DELETE /api/mapa/zonas`.

### UI

- Draw/edit polygons with `@geoman-io/leaflet-geoman-free`; mode banner
  ("Drawing area, double-click to finish, Esc to cancel"); name, color,
  one or more sellers.
- **Mismatches panel**: customers whose `co_ven` is not among the area's
  sellers, and customers outside every area.
- **Layers**: pins (default on), area choropleth (sequential scale,
  numeric legend with scale breaks, visible boundary and direct label per
  area), density (`leaflet.heat`, revenue-weighted).

## UX requirements (from ui-ux-pro-max review)

- Style: data-dense dashboard, low motion; reuse the app's existing
  Tailwind 4 tokens (do not adopt a new palette or fonts).
- Layout: full-height map; filter panel left, lists panel right; on narrow
  screens panels collapse to bottom sheets and the map keeps ≥ ~50% height.
- Accessibility: contrast ≥ 4.5:1 light and dark; visible focus rings;
  pins keyboard-focusable (Enter opens popup); labeled map controls; color
  never the only signal; numeric legends; `prefers-reduced-motion`
  respected (no animated fly-to).
- Interaction: ≥ 44px hit targets for panel controls and edit handles; no
  hover-only affordances.
- Performance: client leaf + dynamic import; skeleton prevents layout
  shift; marker rendering isolated in its own layer so clustering can be
  added later.

## Access and docs

- `'geo'` added to the `module` enum in `lib/db/schema.ts`,
  `VALID_MODULES` in `app/api/admin/users/[id]/modules/route.ts`, a
  `lib/geo/access.ts` `hasGeoAccess()` mirroring `hasDwhAccess()`, and a
  checkbox column in `app/(app)/admin/users/users-client.tsx`. Sidebar
  link gated on the module.
- `AGENTS.md`: relax the DWH rule, document `/mapa`, `lib/geo/`, the
  coordinate syntax and the `'geo'` module.

## Testing

- Unit: coordinate parse/validate/format (valid, swapped, out-of-box,
  malformed, round-trip); point-in-polygon; polygon validity/overlap;
  Pareto classification.
- Script: provider calls with a mocked `fetch`.
- Routes: mock pools like the existing DWH route tests; 403 without
  access on every route.
- ERP write procedure: integration test under `test:mssql` (writes to the
  ERP — non-production instance only).
- E2E: Playwright smoke on the production build — load `/mapa`, open a
  popup, toggle table view, URL-synced filters. `SQLITE_PATH` must be
  pinned to `e2e/.tmp` (see dev DB wipe hazards).

## Out of scope

Stores without a `saCliente` row, per-route visit schedules, writing the
matched seller back to the ERP, marker clustering.
