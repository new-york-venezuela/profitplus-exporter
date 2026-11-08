# Prospect Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Analítica sub-tab "Perfil de prospecto" that, given store type + route (or map pin) + margin, shows expected weekly units (with range), product mix, the store's weekly benefit and the closest peer customers.

**Architecture:** Pure, unit-tested modules in `lib/prospect/` (benefit maths, geo/nearest route, peer selection with fallback, aggregation) fed by one DWH SQL fetch plus ERP coordinates merged in TypeScript by customer code. One read-only API route `GET /api/dwh/prospecto` gated on `'dwh'`; one client tab with a client-only pin map. Nothing is written anywhere.

**Tech Stack:** Next.js 16 App Router, Bun test (`bun:test`), mssql (`getDwhPool`, `getPool`), react-leaflet (already installed), Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-08-prospect-profile-design.md`

## Global Constraints

- DWH reads via `getDwhPool()`, every user value through `.input()`; ERP only via `getPool()` and only for `saCliente.campo1` coordinates (reuse `fetchErpCustomers` from `lib/geo/map-data.ts` + `parseCoordinates` from `lib/geo/coordinates.ts`). Merge ERP+DWH in TypeScript by trimmed customer code, never in SQL.
- No `middleware.ts`: the page is already behind the Analítica page gate; the new API route must call `requireDwhAccess(request)` itself and return `{ error: string }` with 401/403.
- Store type = `Dim_Segment.SegmentName` of the CURRENT row's `ErpSegmentCode` (`parseGrupo` in `lib/clientes/scope.ts` validates the code). Route = current `Dim_Customer.ZoneCode` joined to `dim.Dim_Zone` with `IsRoute = 1` (`RouteNumber`).
- Consignment roots excluded from peers, mix and every total, by customer code via `getFlaggedRootCodes(dateWhere, DEFAULT_ROOT_SHARE_THRESHOLD)` in `app/api/dwh/lib/consignment.ts`.
- Window: fixed last 12 complete ISO weeks ending last Sunday; the global date-range selector does not apply. Weekly units = total units / weeks since the customer's first invoice in the window (idle weeks count as 0, minimum 1 week).
- Headline = median of peers' weekly units, range = interquartile (p25–p75). Minimum peers = 5; fallback chain: same type + same route → same type in the 2 nearest routes (centroid of located customers; routes without located customers skipped) → same type everywhere. Always report tier and peer count.
- Benefit: margin `m` is a share of the store's shelf price (confirmed). Per product: `cost` = Σ NetAmount USD / Σ units over the peers (volume-weighted); `shelf = cost / (1 − m)`; weekly benefit = Σ products of `headlineUnits × productShare × (shelf − cost)`. Example: 10 units, cost 3.92, m 30% → shelf 5.60 → 16.80/week. Only the store's benefit; not ours.
- Amounts USD only. Missing USD cost is `null` → "Sin datos", never 0; a result with any such product is `incomplete: true` and the UI shows a warning.
- Out of scope: benefit per m², facings, anything stored in SQLite/ERP/DWH, ML.
- Spanish UI text, `es-VE` number formatting (`app/(app)/analitica/lib/format.ts`).

## Review Focus

- Zero peers for a type/route/whole-type → response `peers: []`, headline `null`, UI says "Sin pares suficientes", never `NaN` or 0.
- Margin of 0 → benefit 0; margin ≥ 100% or negative or non-numeric → 400 `{ error }`.
- Pin outside Venezuela or swapped lat/lng → 400 (use `validateCoordinates`); pin with no located routed customers → no route suggestion, user must pick.
- Peer whose first invoice is inside the last week: divides by 1 week, not by 12 and not by 0.
- A product with units but no USD amount (no FX rate) → that product's cost `null`, `incomplete: true`, benefit sums the rest.
- Unrouted customers (zone not a route) are excluded and counted in `excludedNoRoute`.
- Prospect type whose group has fewer than 5 customers (e.g. Cadena) → fallback exhausted, tier `type_all`, low-peer note shown.

---

### Task 1: Benefit maths

**Files:**
- Create: `lib/prospect/benefit.ts`
- Test: `lib/prospect/__tests__/benefit.test.ts`

**Interfaces:**
- Produces:
  - `export function parseMargin(raw: string | null | undefined): number | null` — percent string ("30", "30.5") → fraction (0.30); `null` if not finite or outside `[0, 99.9]`.
  - `export function shelfPrice(costUsd: number, margin: number): number` — `cost / (1 − margin)`.
  - `export interface MixLine { productCode: string; productName: string; share: number; costUsd: number | null }`
  - `export function weeklyBenefit(units: number, mix: MixLine[], margin: number): { benefitUsd: number; incomplete: boolean }`

- [ ] **Step 1: Write failing tests** — `shelfPrice(3.92, 0.3)` ≈ 5.6; `weeklyBenefit(10, [{share:1,costUsd:3.92,...}], 0.3).benefitUsd` ≈ 16.8; two-product mix splits by share; a line with `costUsd: null` is skipped and sets `incomplete: true`; margin 0 → 0; `parseMargin('30')` → 0.3, `parseMargin('100')`, `parseMargin('-1')`, `parseMargin('abc')`, `parseMargin(null)` → `null`.
- [ ] **Step 2: Run** `bun test lib/prospect/__tests__/benefit.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the four exports above in `lib/prospect/benefit.ts` (pure, no I/O).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `git add lib/prospect && git commit -m "feat(prospect): benefit maths"`

### Task 2: Geo helpers (nearest routes)

**Files:**
- Create: `lib/prospect/geo.ts`
- Test: `lib/prospect/__tests__/geo.test.ts`

**Interfaces:**
- Consumes: `LatLng` from `lib/geo/coordinates.ts`.
- Produces:
  - `export function distanceKm(a: LatLng, b: LatLng): number` — haversine.
  - `export interface LocatedCustomer { routeNumber: number | null; point: LatLng | null }`
  - `export function routeCentroids(customers: LocatedCustomer[]): Map<number, LatLng>` — mean lat/lng of located customers per route; routes with none are absent.
  - `export function nearestRoutes(point: LatLng, centroids: Map<number, LatLng>, n: number): number[]` — route numbers, closest first.
  - `export function suggestRoute(point: LatLng, customers: LocatedCustomer[], k?: number): number | null` — majority route among the `k` (default 3) nearest located, routed customers; ties go to the single nearest; `null` if there are none.

- [ ] **Step 1: Write failing tests** — distance Caracas (10.4806,-66.9036) to itself 0 and to (10.5,-66.9) under 5 km; centroid ignores customers without point or route; `nearestRoutes` orders by distance and respects `n`; `suggestRoute` majority beats single nearest, tie → nearest, empty → `null`.
- [ ] **Step 2: Run** `bun test lib/prospect/__tests__/geo.test.ts` — FAIL.
- [ ] **Step 3: Implement** in `lib/prospect/geo.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(prospect): nearest-route helpers`

### Task 3: Peer selection with fallback

**Files:**
- Create: `lib/prospect/peers.ts`
- Test: `lib/prospect/__tests__/peers.test.ts`

**Interfaces:**
- Consumes: `distanceKm`, `nearestRoutes`, `routeCentroids` from Task 2.
- Produces:
  - `export const MIN_PEERS = 5`
  - `export interface PeerCandidate { code: string; name: string; typeCode: string; routeNumber: number | null; point: LatLng | null; weeklyUnits: number }`
  - `export type PeerTier = 'type_route' | 'type_near_routes' | 'type_all'`
  - `export function selectPeers(candidates: PeerCandidate[], q: { typeCode: string; routeNumber: number; pin: LatLng | null }): { tier: PeerTier; peers: PeerCandidate[] }` — candidates already exclude consignment, unrouted and no-sales customers. A tier is accepted when it yields ≥ `MIN_PEERS`; otherwise widen; the last tier (`type_all`) is returned whatever its size (possibly empty). Within the result, order by: same route first, then distance to `pin` ascending (candidates with no point last; no pin → by `weeklyUnits` descending).

- [ ] **Step 1: Write failing tests** — 5 same-type-same-route → tier `type_route`; 4 on the route + 2 on a near route → `type_near_routes` includes the near-route peers; far-away routes (not among the 2 nearest by centroid) are not included at tier 2; fewer than 5 everywhere → `type_all` with all same-type; other types never appear; zero → `{tier:'type_all', peers:[]}`; ordering with a pin puts no-coordinate peers last.
- [ ] **Step 2: Run** `bun test lib/prospect/__tests__/peers.test.ts` — FAIL.
- [ ] **Step 3: Implement** `selectPeers`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(prospect): peer selection with fallback tiers`

### Task 4: Aggregation (weekly units, quartiles, mix, response shape)

**Files:**
- Create: `lib/prospect/aggregate.ts`, `lib/prospect/window.ts`
- Test: `lib/prospect/__tests__/aggregate.test.ts`, `lib/prospect/__tests__/window.test.ts`

**Interfaces:**
- Consumes: `weeklyBenefit`, `MixLine` (Task 1); `PeerCandidate` (Task 3). Look at `lib/seguimiento/iso-date.ts` / `iso-weeks.ts` for existing date helpers before writing `window.ts`.
- Produces:
  - `window.ts`: `export function prospectWindow(now: Date): { startKey: number; endKey: number }` — `yyyymmdd` keys; end = the most recent Sunday strictly before today (if today is a Sunday, the Sunday a week earlier), start = the Monday 83 days before that end. `export function weeksActive(firstKey: number, endKey: number): number` — `max(1, ceil(days/7))`.
  - `aggregate.ts`:
    - `export function quantile(sorted: number[], q: number): number | null` (linear interpolation, `null` on empty)
    - `export interface ProductTotals { productCode: string; productName: string; units: number; usdNet: number | null; usdUnits: number }` — `usdUnits` = units that had a USD amount; `usdNet` null if `usdUnits` is 0.
    - `export function buildMix(rows: ProductTotals[], topN?: number): MixLine[]` — share by units, `costUsd = usdNet / usdUnits`, top 8 plus an `otros` line (`productCode: 'OTROS'`, cost = weighted by usdUnits of the merged lines, `null` if none).
    - `export interface ProspectResult { tier: PeerTier; peerCount: number; lowPeers: boolean; units: { median: number; p25: number; p75: number } | null; mix: MixLine[]; benefit: { medianUsd: number; p25Usd: number; p75Usd: number; incomplete: boolean } | null; peers: PeerView[]; excludedNoRoute: number }`
    - `export function buildResult(args: { tier; peers: PeerCandidate[]; products: ProductTotals[]; margin: number; excludedNoRoute: number }): ProspectResult` — `units`/`benefit` are `null` when there are no peers; `lowPeers = peerCount < MIN_PEERS`; benefit at p25/median/p75 units via `weeklyBenefit`. `PeerView` = `{ code, name, typeName?: string, routeNumber, weeklyUnits, weeklyBenefitUsd: number | null }` (per-peer benefit uses that peer's own units and the shared mix).

- [ ] **Step 1: Write failing tests** — `weeksActive(20260210, 20260301)` etc. (boundary: first invoice on the last day → 1); `prospectWindow` for a Wednesday and for a Sunday returns a Monday start 83 days before the end Sunday, end Sunday < today; `quantile([1,2,3,4],0.5)` = 2.5, empty → `null`; `buildMix` shares sum to 1, top-8 + otros, null cost when no USD; `buildResult` with the spec example (one product, cost 3.92, 10 units median, margin 0.3) → `benefit.medianUsd ≈ 16.8`; empty peers → `units: null`, `benefit: null`, `lowPeers: true`; a null-cost product → `incomplete: true`.
- [ ] **Step 2: Run** `bun test lib/prospect/__tests__/` — FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(prospect): window and aggregation`

### Task 5: SQL + API route

**Files:**
- Create: `lib/prospect/queries.ts`, `app/api/dwh/prospecto/route.ts`
- Test: `app/api/dwh/prospecto/__tests__/route.test.ts` (copy the mocking style of `app/api/dwh/clientes/__tests__/route.test.ts`)

**Interfaces:**
- Consumes: Tasks 1–4; `requireDwhAccess` (`lib/dwh/access.ts`); `getDwhPool`, `getPool`; `fetchErpCustomers`; `parseCoordinates`, `validateCoordinates`; `getFlaggedRootCodes`; `usdConversionJoin`/`dualAmountExpr` in `app/api/dwh/lib/query-builder.ts` (read them for the exact USD expression and reuse, as `fetchRevenue` in `lib/geo/map-data.ts` does).
- Produces:
  - `queries.ts`: `export async function fetchProspectBase(pool, w: {startKey:number;endKey:number}): Promise<{ customers: BaseCustomer[]; products: ProductRow[] }>` where `BaseCustomer = { code; name; typeCode; typeName; routeNumber: number|null; firstKey: number|null; units: number }` (current rows, `IsInactive = 0`, `IsVoided = 0` sales in window only for `Dim_Product.LineName IN ('Panaderia','Pasteleria','Pizza')`) and `ProductRow = { customerCode; productCode; productName; units; usdNet: number|null; usdUnits: number }`. Dates via `.input('startKey')/.input('endKey')`.
  - `GET /api/dwh/prospecto?section=options` → `{ types: {code,name,count}[]; routes: {number,name,customers}[] }`.
  - `GET /api/dwh/prospecto?tipo=<code>&ruta=<n>&margen=<pct>[&lat=&lng=]` → `ProspectResult` plus `suggestedRoute: number | null` (when lat/lng given).
  - `GET /api/dwh/prospecto?section=suggest&lat=&lng=` → `{ route: number | null }` (cheap pin → route call).
  - Errors: `{ error }` with 400 for bad `tipo` (`parseGrupo`), `ruta` (`parseRuta`), `margen` (`parseMargin`), or invalid coordinates (`validateCoordinates`); 401/403 from `requireDwhAccess`.

- [ ] **Step 1: Write failing route tests** — unauthenticated → 401; no module grant → 403; `margen=100` → 400; `lat=999&lng=0` → 400; happy path with mocked `fetchProspectBase`/`fetchErpCustomers` returns `peerCount`, `tier`, `benefit.medianUsd`; consignment-root customer is excluded (mock `getFlaggedRootCodes`); customers without a route counted in `excludedNoRoute`; `section=options` lists types with counts.
- [ ] **Step 2: Run** `bun test --env-file=.env.local app/api/dwh/prospecto` — FAIL.
- [ ] **Step 3: Implement** `fetchProspectBase` (two queries, one per customer totals and one per customer×product) and the route handler: compute window → fetch base + ERP customers + flagged roots in parallel → merge by trimmed code → build `PeerCandidate[]` (type-matching candidate pool excludes consignment, no-route, zero-sales) → `selectPeers` → `ProductTotals` pooled over the selected peers only → `buildResult`.
- [ ] **Step 4: Run** the tests, then `bun --env-file=.env.local -e` a one-off call against the local copy with `tipo=` a real Supermercado code and `ruta=7`; Expected: a plausible non-empty result (local data is a stale copy: not a production fact).
- [ ] **Step 5: Commit** `feat(prospect): API route`

### Task 6: Tab UI, pin picker, registry, docs

**Files:**
- Create: `app/(app)/analitica/tabs/tab-prospecto.tsx`, `app/(app)/analitica/components/prospecto/pin-picker.tsx` (client-only; load it with `next/dynamic` and `ssr: false` the way `app/(app)/mapa/mapa-loader.tsx` loads the map), `app/(app)/analitica/components/prospecto/result-panel.tsx`
- Modify: `app/(app)/analitica/lib/tab-keys.ts` (add `'prospecto'` after `'clientes'`, label `Perfil de prospecto`), `app/(app)/analitica/analitica-client.tsx` (`TAB_COMPONENTS`), `app/(app)/analitica/types.ts` (add `ProspectoResponse` mirroring `ProspectResult` + `suggestedRoute`), `AGENTS.md` (directory map + one "Prospect profile" paragraph pointing at the spec)
- Test: `app/(app)/analitica/components/__tests__/prospecto.test.tsx` (React Testing Library, `import { screen } from 'test/dom-setup'` first — see AGENTS.md "Component tests"); extend the tab-keys test in `app/(app)/analitica/lib/__tests__/` if one exists.

**Interfaces:**
- Consumes: `GET /api/dwh/prospecto` (Task 5).
- Produces: `export default function TabProspecto(props: TabComponentProps)`; layout A: inputs row (type via native `<select>`, route via `SearchableSelect`, margin number input default 30, optional pin button that opens the picker and calls `section=suggest` then pre-fills the route, overridable), headline cards (units/week with range, benefit/week with range, peer count + tier text), mix list, closest-peers list. Warnings: `incomplete` → banner "Algunos productos no tienen costo (Sin datos)"; `lowPeers` → "Pocos pares (n): tómelo como referencia"; `excludedNoRoute > 0` → "n clientes sin ruta no se consideraron". `benefit` or `units` `null` renders "Sin datos", never `$0.00`.

- [ ] **Step 1: Write failing tests** — `resolveActiveTab('prospecto')` returns `'prospecto'`; component renders headline from a mocked fetch; `lowPeers` and `incomplete` banners appear; `benefit: null` shows "Sin datos" and no "$0"; changing the margin refetches with `margen=` in the URL.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local .test.tsx` limited to these files — FAIL.
- [ ] **Step 3: Implement** the files above. Pin picker: react-leaflet `MapContainer` centred on Caracas, one draggable marker, emits `LatLng`; Leaflet imports only inside the client-only tree.
- [ ] **Step 4: Run** the new tests, then `bun run test:unit` and `bunx tsc --noEmit`; Expected: no new failures.
- [ ] **Step 5: Manual check** — `bun dev`, open `/analitica?tab=prospecto`, pick Supermercado + Ruta 7 + 30%; confirm numbers match a hand calculation on three peers; drop a pin and confirm a route is proposed and can be overridden.
- [ ] **Step 6: Commit** `feat(prospect): Perfil de prospecto tab`

---

## Self-review

- Spec coverage: inputs (type, route, pin, margin) → Tasks 5–6; outputs (units+range, mix, benefit, peers) → Task 4/6; peers fallback, min 5 → Task 3; window, gaps → Task 4; consignment/unrouted exclusion → Task 5; per-product price/benefit → Tasks 1, 4; "Sin datos" invariant → Tasks 4, 6; gating twice → Task 5 (route) and existing page gate; no storage, no per-m² → respected.
- Types: `MixLine` (T1) used in T4; `PeerCandidate`/`PeerTier` (T3) used in T4/T5; `LatLng` reused from existing code.
- Not covered by tests I could not write in advance: the exact `usdConversionJoin` output shape (Task 5 step 3 says to read and reuse it).
