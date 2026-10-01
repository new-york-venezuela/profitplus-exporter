# Customer Map — Plan 2 of 3: Map and Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Series:** Plan 2 of 3 — `customer-map-1-foundations` → **`customer-map-2-map-and-routes`** → `customer-map-3-sales-areas`.
> **Depends on:** Plan 1 (`docs/superpowers/plans/2026-09-30-customer-map-1-foundations.md`) merged to `main`. This plan imports `lib/geo/coordinates.ts` (`parseCoordinates`, `validateCoordinates`, `formatCoordinates`, `coordinateErrorMessage`, `LatLng`, `CoordinateError`) and `lib/geo/erp-location.ts` (`updateCustomerLocation`, `CustomerNotFoundError`), and requires the `pApiActualizarUbicacionCliente` procedure to be installed (`bun run migrate:mssql`).
> **Blocks:** Plan 3 (extends `MapCustomer`, `MapPayload`, `/api/mapa/clientes`, `mapa-client.tsx`). Do not start Plan 3 until every task here is merged.

**Goal:** A `/mapa` page, gated by a new `'geo'` module, showing every ERP customer as a pin with revenue/Pareto popup, URL-synced filters (period, seller, route, segment, no-coordinates), a table fallback view, customer location editing (coordinates + delivery address, written to the ERP), and app-owned customer routes.

**Architecture:** `GET /api/mapa/clientes` reads customers live from the ERP and period revenue from the DWH through their own pools and merges them in TypeScript by customer code; routes live in SQLite. Pure functions (`parseFilters`, `applyFilters`, `assignPareto`, `mergeCustomers`, route/location validators) carry the logic and are unit-tested; the Leaflet UI is a client-only leaf loaded with `next/dynamic` (`ssr: false`).

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle + `bun:sqlite`, `mssql`, `leaflet` + `react-leaflet`, Tailwind 4, `bun:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-customer-map-design.md` (as amended by Plan 1, Task 5).

## Global Constraints

- Module gate `'geo'` is enforced **twice, independently**: the page redirects (`redirect('/reports/ventas')`), every `/api/mapa/*` route returns `401`/`403` itself. Admins bypass.
- Errors are `{ error: string }` with an HTTP status. User-visible text is Spanish.
- Revenue = sales net (`fact.Fact_Sales.NetAmount`, `IsVoided = 0`), USD **per row** via `usdConversionJoin('fs')` + `dualAmountExpr('fs', 'NetAmount', 'RevenueBs', 'RevenueUsd')` from `app/api/dwh/lib/query-builder.ts` — never a single current rate. Period filter via `buildDateWhereClause(dateRange, 'fs')`.
- Pareto matches the analytics Clientes tab exactly (`app/api/dwh/clientes/route.ts`): rank by period net sales (BS) descending, cumulative share after adding the row: A ≤ 0.2, B ≤ 0.5, C otherwise. (Known quirk, kept on purpose for consistency: a single dominant customer whose own share exceeds 20% is labelled B or C.)
- Date ranges use the dashboard's format: `month:YYYY-MM`, `ytd:YYYY`, `custom:YYYY-MM-DD:YYYY-MM-DD`. Default period = previous month.
- Coordinates are read/written only via `lib/geo/coordinates.ts`; the ERP is written only via `updateCustomerLocation`. Invalid or unparseable `campo1` never plots a pin.
- ERP queries use `.input()` for every user-controlled value; DWH queries here take only the validated `dateRange` string (passed through `buildDateWhereClause`, which only emits digits from a regex match).
- Any `<select>` over a growable list uses `lib/components/searchable-select.tsx`; fixed small enums use native `<select>`.
- No hover-only affordances; panel controls ≥ 44px hit area (the shared `SearchableSelect` is reused unchanged, per the repo convention, and is the one exception); visible focus rings; `prefers-reduced-motion` respected (map never animates `fitBounds`/`flyTo`); pin color is never the only signal (pins carry the A/B/C letter).
- The map wrapper must be `isolate`d (`relative z-0`) so Leaflet panes (z-index up to 1000) stay below the app's `Modal` (`z-50`).
- Unit tests live in `__tests__/unit/geo/`; run `bun test --isolate --env-file=.env.local <file>`.
- Playwright specs that need the ERP/DWH are tagged `@mssql` (excluded from default CI).
- e2e/dev DB hazard: any script that touches SQLite must have `SQLITE_PATH` pinned to `e2e/.tmp` (see `e2e:seed`).

## Review Focus

- A customer whose `campo1` is out-of-box, swapped or free text: must NOT be plotted, must appear in the "sin coordenadas" list and the table with the reason.
- A customer with revenue in the DWH but inactive/absent in the ERP active list: ignored, not a crash. A customer with no revenue: shown grey with no Pareto, revenue 0.
- DWH customer codes are `char`-padded and the dimension is SCD2 (several rows per customer): revenue must be summed across versions and matched to the ERP code after `RTRIM`.
- Changing the seller filter while a route of a different seller is selected: the route filter must clear.
- Two routes of the same seller with the same name: rejected (`409`), not silently duplicated.
- Saving a location with only one of lat/lng, a swapped pair, or a point outside Venezuela: rejected with a field-level message; nothing written.
- `dateRange` garbage from the URL: `400`, never interpolated into SQL.
- A user without the `geo` grant calling `/api/mapa/*` directly: `403`; no session: `401`.
- Deleting a route: its memberships go with it (cascade); customers are untouched.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/schema.ts` | add `'geo'` module enum value; `routes`, `routeCustomers` tables |
| `migrations/sqlite/0006_*.sql` (+ meta) | generated by `drizzle-kit` |
| `lib/geo/access.ts` | `hasGeoAccess`, `requireGeoAccess` |
| `lib/geo/types.ts` | `Pareto`, `PARETO_THRESHOLDS`, `RouteDto`, `MapCustomer`, `MapSeller`, `MapPayload` |
| `lib/geo/pareto.ts` | `assignPareto` |
| `lib/geo/merge.ts` | `mergeCustomers`, `distinctSellers` |
| `lib/geo/map-data.ts` | `fetchErpCustomers`, `fetchRevenue` (SQL) |
| `lib/geo/date-range.ts` | `previousMonthRange`, `periodOptions`, `isValidDateRange` |
| `lib/geo/filters.ts` | `parseFilters`, `serializeFilters`, `normalizeFilters`, `applyFilters`, `filterChips` |
| `lib/geo/routes-repo.ts` | SQLite CRUD for routes |
| `lib/geo/route-validation.ts` | `parseRouteCreate`, `parseRoutePatch` |
| `lib/geo/location-patch.ts` | `parseLocationPatch` |
| `app/api/mapa/clientes/route.ts` | GET merged payload |
| `app/api/mapa/clientes/[co_cli]/ubicacion/route.ts` | PATCH location |
| `app/api/mapa/rutas/route.ts`, `app/api/mapa/rutas/[id]/route.ts` | routes API |
| `app/(app)/mapa/page.tsx`, `mapa-loader.tsx`, `mapa-client.tsx` | page shell + orchestration |
| `app/(app)/mapa/components/*.tsx` | `customer-map`, `filter-panel`, `customer-table`, `location-editor`, `routes-panel`, `unlocated-list` |
| `components/sidebar.tsx`, `app/(app)/layout.tsx`, `app/(app)/admin/users/users-client.tsx`, `app/api/admin/users/[id]/modules/route.ts` | module wiring |
| `e2e/mapa.spec.ts`, `AGENTS.md` | e2e + docs |

---

### Task 1: The `'geo'` module (schema, access helper, admin UI, sidebar)

**Files:**
- Modify: `lib/db/schema.ts` (module enum)
- Create: `lib/geo/access.ts`
- Test: `__tests__/unit/geo/access.test.ts`
- Modify: `app/api/admin/users/[id]/modules/route.ts` (`VALID_MODULES`)
- Modify: `app/(app)/admin/users/users-client.tsx`
- Modify: `app/(app)/layout.tsx`, `components/sidebar.tsx`

**Interfaces:**
- Produces:
  ```ts
  export async function hasGeoAccess(db: BunSQLiteDatabase<typeof schema>, userId: string, role: 'user'|'admin'): Promise<boolean>;
  export type GeoAccessResult = { ok: true; session: SessionPayload } | { ok: false; response: NextResponse };
  export async function requireGeoAccess(request: NextRequest): Promise<GeoAccessResult>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/access.test.ts
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import { hasGeoAccess } from '@/lib/geo/access';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

beforeAll(() => { migrate(db, { migrationsFolder: './migrations/sqlite' }); });
afterEach(() => { sqlite.exec('DELETE FROM user_modules'); sqlite.exec('DELETE FROM users'); });

function addUser(role: 'user' | 'admin') {
  return db.insert(schema.users).values({
    email: `${role}@example.com`, name: role, passwordHash: 'x', role, createdAt: Date.now(),
  }).returning({ id: schema.users.id }).get()!.id;
}

describe('hasGeoAccess', () => {
  test('admin always has access', async () => {
    expect(await hasGeoAccess(db, String(addUser('admin')), 'admin')).toBe(true);
  });
  test('user without a grant has none', async () => {
    expect(await hasGeoAccess(db, String(addUser('user')), 'user')).toBe(false);
  });
  test('user with the geo grant has access', async () => {
    const id = addUser('user');
    db.insert(schema.userModules).values({ userId: id, module: 'geo' }).run();
    expect(await hasGeoAccess(db, String(id), 'user')).toBe(true);
  });
  test('an inventory/dwh grant does not imply geo', async () => {
    const id = addUser('user');
    db.insert(schema.userModules).values({ userId: id, module: 'dwh' }).run();
    expect(await hasGeoAccess(db, String(id), 'user')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/access.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/access` (and a TS error on `'geo'`).

- [ ] **Step 3: Add `'geo'` to the schema enum**

In `lib/db/schema.ts`, `userModules.module` enum becomes `['inventory', 'dwh', 'pricing_view', 'pricing_edit', 'geo']`. (The column is `text` with no `CHECK` constraint, so no SQL migration is generated or needed; run `bunx drizzle-kit generate --name check_geo_module` — if it reports "No schema changes", delete nothing and continue.)

- [ ] **Step 4: Write the access helper**

```ts
// lib/geo/access.ts
import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';

export async function hasGeoAccess(
  db: BunSQLiteDatabase<typeof schema>,
  userId: string,
  role: 'user' | 'admin',
): Promise<boolean> {
  if (role === 'admin') return true;
  const grant = db
    .select({ id: schema.userModules.id })
    .from(schema.userModules)
    .where(and(eq(schema.userModules.userId, parseInt(userId, 10)), eq(schema.userModules.module, 'geo')))
    .get();
  return grant !== undefined;
}

export type GeoAccessResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export async function requireGeoAccess(request: NextRequest): Promise<GeoAccessResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const allowed = await hasGeoAccess(getDb(), session.sub, session.role);
  if (!allowed) return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
  return { ok: true, session };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/access.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire the admin API and UI**

1. `app/api/admin/users/[id]/modules/route.ts`: `VALID_MODULES = ['inventory', 'dwh', 'pricing_view', 'pricing_edit', 'geo'] as const`.
2. `app/(app)/admin/users/users-client.tsx`: change `handleToggleModule(user: UserRow, moduleName: 'inventory' | 'dwh')` to accept `'inventory' | 'dwh' | 'geo'`; add `'Mapa'` to the header array after `'Analítica'`; add a `<td>` after the Analítica cell:
   ```tsx
   <td className="px-4 py-3">
     <label className="inline-flex items-center gap-2 text-xs text-gray-700">
       <input
         type="checkbox"
         checked={user.modules.includes('geo')}
         onChange={() => handleToggleModule(user, 'geo')}
         disabled={user.role === 'admin'}
         className="rounded border-gray-300"
       />
       {user.role === 'admin' ? 'Incluido (admin)' : 'Mapa'}
     </label>
   </td>
   ```
3. `e2e/admin-users.spec.ts` (~line 56 comment and any column-count/header assertions): run `grep -n "Analítica\|nth(\|columnheader" e2e/admin-users.spec.ts` and update any assertion that counts columns or indexes cells after Analítica.
4. `app/(app)/layout.tsx`: `import { hasGeoAccess } from '@/lib/geo/access';`, `const canSeeMapa = await hasGeoAccess(db, session.sub, session.role);`, pass `canSeeMapa={canSeeMapa}` to `<Sidebar … />`.
5. `components/sidebar.tsx`: add `canSeeMapa: boolean` to `Props` and the destructuring, and, directly after the `canSeeAnalitica` block:
   ```tsx
   {canSeeMapa && (
     <>
       <p className="px-2 mt-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
         Geografía
       </p>
       <Link href="/mapa" className={navClass('/mapa')}>
         Mapa de Clientes
       </Link>
     </>
   )}
   ```

- [ ] **Step 7: Type-check, run affected tests, commit**

Run: `bunx tsc --noEmit && bun test --isolate --env-file=.env.local __tests__/unit/geo/access.test.ts`
Expected: clean, PASS.

```bash
git add lib/db/schema.ts lib/geo/access.ts __tests__/unit/geo/access.test.ts \
  "app/api/admin/users/[id]/modules/route.ts" "app/(app)/admin/users/users-client.tsx" \
  "app/(app)/layout.tsx" components/sidebar.tsx e2e/admin-users.spec.ts
git commit -m "feat(geo): 'geo' module grant, access helper, admin checkbox, sidebar link

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types, Pareto and date-range helpers

**Files:**
- Create: `lib/geo/types.ts`, `lib/geo/pareto.ts`, `lib/geo/date-range.ts`
- Test: `__tests__/unit/geo/pareto.test.ts`, `__tests__/unit/geo/date-range.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type Pareto = 'A' | 'B' | 'C';
  export const PARETO_THRESHOLDS: { readonly a: 0.2; readonly b: 0.5 };
  export interface RouteDto { id: number; name: string; sellerCode: string; customerCodes: string[] }
  export interface MapCustomer {
    coCli: string; name: string; rif: string | null;
    coVen: string; sellerName: string | null;
    direc1: string | null; dirEnt2: string | null;
    lat: number | null; lng: number | null;
    coordinatesIssue: CoordinateError | 'UNPARSEABLE' | null;
    revenueBs: number; revenueUsd: number | null;
    pareto: Pareto | null;
    routeIds: number[];
  }
  export interface MapSeller { code: string; name: string }
  export interface MapPayload { dateRange: string; customers: MapCustomer[]; sellers: MapSeller[]; routes: RouteDto[]; paretoThresholds: typeof PARETO_THRESHOLDS }
  // pareto.ts
  export function assignPareto(rows: { coCli: string; revenueBs: number }[]): Map<string, Pareto>;
  // date-range.ts
  export function previousMonthRange(now?: Date): string;               // 'month:YYYY-MM'
  export function periodOptions(now?: Date): { value: string; label: string }[];
  export function isValidDateRange(value: string): boolean;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/unit/geo/pareto.test.ts
import { describe, test, expect } from 'bun:test';
import { assignPareto } from '@/lib/geo/pareto';

describe('assignPareto (same buckets as the analytics Clientes tab)', () => {
  test('ranks by revenue and buckets by cumulative share: A ≤ 20%, B ≤ 50%, C rest', () => {
    // total 100, ranked descending: c6=30 (cum .30 → B), c5=20 (.50 → B), c3=15 (.65 → C), c4=15 (.80 → C), c1/c2=10 (.90, 1.0 → C)
    const rows = [
      { coCli: 'c1', revenueBs: 10 }, { coCli: 'c2', revenueBs: 10 },
      { coCli: 'c3', revenueBs: 15 }, { coCli: 'c4', revenueBs: 15 },
      { coCli: 'c5', revenueBs: 20 }, { coCli: 'c6', revenueBs: 30 },
    ];
    const m = assignPareto(rows);
    // descending: c6(30) → cum .30 → B ; c5(20) → .50 → B ; c3(15) → .65 → C ...
    expect(m.get('c6')).toBe('B');
    expect(m.get('c5')).toBe('B');
    expect(m.get('c3')).toBe('C');
    expect(m.get('c1')).toBe('C');
  });
  test('documented quirk: a customer holding >20% on their own cannot be A', () => {
    const m = assignPareto([{ coCli: 'big', revenueBs: 90 }, { coCli: 'small', revenueBs: 10 }]);
    expect(m.get('big')).toBe('C'); // cum share 0.9, matches app/api/dwh/clientes/route.ts
    expect(m.get('small')).toBe('C');
  });
  test('many small customers produce A at the top', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ coCli: `c${i}`, revenueBs: 5 })); // each 5%
    const m = assignPareto(rows);
    const letters = rows.map(r => m.get(r.coCli));
    expect(letters.filter(l => l === 'A').length).toBe(4);   // cum .05 .10 .15 .20
    expect(letters.filter(l => l === 'B').length).toBe(6);   // .25 … .50
    expect(letters.filter(l => l === 'C').length).toBe(10);
  });
  test('zero, negative and missing revenue get no entry', () => {
    const m = assignPareto([{ coCli: 'a', revenueBs: 0 }, { coCli: 'b', revenueBs: -5 }, { coCli: 'c', revenueBs: 10 }]);
    expect(m.has('a')).toBe(false);
    expect(m.has('b')).toBe(false);
    expect(m.get('c')).toBe('C');
  });
  test('empty input → empty map, no division by zero', () => {
    expect(assignPareto([]).size).toBe(0);
  });
  test('does not mutate its input order', () => {
    const rows = [{ coCli: 'a', revenueBs: 1 }, { coCli: 'b', revenueBs: 9 }];
    assignPareto(rows);
    expect(rows[0].coCli).toBe('a');
  });
});
```

```ts
// __tests__/unit/geo/date-range.test.ts
import { describe, test, expect } from 'bun:test';
import { previousMonthRange, periodOptions, isValidDateRange } from '@/lib/geo/date-range';

describe('previousMonthRange', () => {
  test('mid-year', () => expect(previousMonthRange(new Date(2026, 8, 30))).toBe('month:2026-08'));
  test('January wraps to December of the previous year', () => expect(previousMonthRange(new Date(2026, 0, 15))).toBe('month:2025-12'));
});

describe('periodOptions', () => {
  const opts = periodOptions(new Date(2026, 8, 30));
  test('starts with the current month, then walks back 12 months, then YTD', () => {
    expect(opts[0]).toEqual({ value: 'month:2026-09', label: 'Septiembre 2026' });
    expect(opts[1]).toEqual({ value: 'month:2026-08', label: 'Agosto 2026' });
    expect(opts.at(-2)!.value).toBe('month:2025-09');
    expect(opts.at(-1)).toEqual({ value: 'ytd:2026', label: 'Año 2026 (acumulado)' });
  });
  test('every option is a valid range', () => {
    for (const o of opts) expect(isValidDateRange(o.value)).toBe(true);
  });
});

describe('isValidDateRange', () => {
  test('accepts the dashboard formats', () => {
    for (const v of ['month:2026-08', 'ytd:2026', 'custom:2026-01-01:2026-01-31']) expect(isValidDateRange(v)).toBe(true);
  });
  test('rejects garbage, injection attempts and bad months', () => {
    for (const v of ['', '12m', 'month:2026-13', 'month:2026-00', "month:2026-08'; DROP TABLE x;--", 'ytd:20', 'custom:2026-01-01', 'month:2026-8'])
      expect(isValidDateRange(v)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/pareto.test.ts __tests__/unit/geo/date-range.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/geo/types.ts
import type { CoordinateError } from './coordinates';

export type Pareto = 'A' | 'B' | 'C';

// Same thresholds as app/api/dwh/clientes/route.ts (PARETO_THRESHOLDS).
export const PARETO_THRESHOLDS = { a: 0.2, b: 0.5 } as const;

export interface RouteDto {
  id: number;
  name: string;
  sellerCode: string;
  customerCodes: string[];
}

export interface MapCustomer {
  coCli: string;
  name: string;
  rif: string | null;
  coVen: string;
  sellerName: string | null;
  direc1: string | null;
  dirEnt2: string | null;
  lat: number | null;
  lng: number | null;
  /** Why this customer has no pin although campo1 is non-empty. */
  coordinatesIssue: CoordinateError | 'UNPARSEABLE' | null;
  revenueBs: number;
  revenueUsd: number | null;
  pareto: Pareto | null;
  routeIds: number[];
}

export interface MapSeller { code: string; name: string }

export interface MapPayload {
  dateRange: string;
  customers: MapCustomer[];
  sellers: MapSeller[];
  routes: RouteDto[];
  paretoThresholds: typeof PARETO_THRESHOLDS;
}
```

```ts
// lib/geo/pareto.ts
import { PARETO_THRESHOLDS, type Pareto } from './types';

// Mirrors app/api/dwh/clientes/route.ts so a customer has the same segment
// on /analitica and on /mapa: rank by period net sales (BS) descending,
// bucket by the cumulative share INCLUDING the row itself.
export function assignPareto(rows: { coCli: string; revenueBs: number }[]): Map<string, Pareto> {
  const ranked = rows.filter(r => r.revenueBs > 0).sort((a, b) => b.revenueBs - a.revenueBs);
  const total = ranked.reduce((s, r) => s + r.revenueBs, 0);
  const out = new Map<string, Pareto>();
  let cumulative = 0;
  for (const r of ranked) {
    cumulative += r.revenueBs;
    const share = total > 0 ? cumulative / total : 0;
    out.set(r.coCli, share <= PARETO_THRESHOLDS.a ? 'A' : share <= PARETO_THRESHOLDS.b ? 'B' : 'C');
  }
  return out;
}
```

```ts
// lib/geo/date-range.ts
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const RANGE_RE = /^(?:month:\d{4}-(?:0[1-9]|1[0-2])|ytd:\d{4}|custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;

const monthValue = (year: number, monthIndex: number) => `month:${year}-${String(monthIndex + 1).padStart(2, '0')}`;

export function isValidDateRange(value: string): boolean {
  return RANGE_RE.test(value);
}

export function previousMonthRange(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthValue(d.getFullYear(), d.getMonth());
}

export function periodOptions(now: Date = new Date()): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ value: monthValue(d.getFullYear(), d.getMonth()), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  options.push({ value: `ytd:${now.getFullYear()}`, label: `Año ${now.getFullYear()} (acumulado)` });
  return options;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/pareto.test.ts __tests__/unit/geo/date-range.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/geo/types.ts lib/geo/pareto.ts lib/geo/date-range.ts __tests__/unit/geo/pareto.test.ts __tests__/unit/geo/date-range.test.ts
git commit -m "feat(geo): map types, dashboard-consistent Pareto, date-range helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Customer merge (ERP + revenue + routes) and data fetchers

**Files:**
- Create: `lib/geo/merge.ts`, `lib/geo/map-data.ts`
- Test: `__tests__/unit/geo/merge.test.ts`

**Interfaces:**
- Consumes: `parseCoordinates`, `validateCoordinates` (Plan 1); `assignPareto`, `MapCustomer`, `MapSeller`, `RouteDto` (Task 2); `buildDateWhereClause`, `usdConversionJoin`, `dualAmountExpr` from `@/app/api/dwh/lib/query-builder`.
- Produces:
  ```ts
  export interface ErpCustomerRow { coCli: string; name: string; rif: string | null; coVen: string; sellerName: string | null; direc1: string | null; dirEnt2: string | null; campo1: string | null }
  export interface RevenueRow { coCli: string; revenueBs: number; revenueUsd: number | null }
  export function mergeCustomers(erp: ErpCustomerRow[], revenue: RevenueRow[], routes: RouteDto[]): MapCustomer[];
  export function distinctSellers(customers: MapCustomer[]): MapSeller[];
  export function fetchErpCustomers(pool: sql.ConnectionPool): Promise<ErpCustomerRow[]>;
  export function fetchRevenue(dwhPool: sql.ConnectionPool, dateRange: string): Promise<RevenueRow[]>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/merge.test.ts
import { describe, test, expect } from 'bun:test';
import { mergeCustomers, distinctSellers, type ErpCustomerRow } from '@/lib/geo/merge';

const erp = (over: Partial<ErpCustomerRow> & { coCli: string }): ErpCustomerRow => ({
  name: over.coCli, rif: null, coVen: '000001', sellerName: 'Ana', direc1: null, dirEnt2: null, campo1: null, ...over,
});

describe('mergeCustomers', () => {
  test('parses valid coordinates into lat/lng', () => {
    const [c] = mergeCustomers([erp({ coCli: 'A', campo1: 'Coordenadas: (10.5, -66.9)' })], [], []);
    expect(c).toMatchObject({ lat: 10.5, lng: -66.9, coordinatesIssue: null });
  });
  test('empty / null campo1 → no pin and NO issue (just unlocated)', () => {
    const rows = mergeCustomers([erp({ coCli: 'A', campo1: null }), erp({ coCli: 'B', campo1: '   ' })], [], []);
    for (const c of rows) expect(c).toMatchObject({ lat: null, lng: null, coordinatesIssue: null });
  });
  test('free text in campo1 → no pin, UNPARSEABLE', () => {
    const [c] = mergeCustomers([erp({ coCli: 'A', campo1: 'llamar antes' })], [], []);
    expect(c).toMatchObject({ lat: null, lng: null, coordinatesIssue: 'UNPARSEABLE' });
  });
  test('swapped and out-of-box coordinates are never plotted', () => {
    const rows = mergeCustomers([
      erp({ coCli: 'S', campo1: 'Coordenadas: (-66.9, 10.5)' }),
      erp({ coCli: 'O', campo1: 'Coordenadas: (40.4, -3.7)' }),
    ], [], []);
    expect(rows[0]).toMatchObject({ lat: null, lng: null, coordinatesIssue: 'SWAPPED_SUSPECTED' });
    expect(rows[1]).toMatchObject({ lat: null, lng: null, coordinatesIssue: 'OUT_OF_RANGE' });
  });
  test('joins revenue by trimmed code; customers without revenue get 0 and no Pareto', () => {
    const rows = mergeCustomers(
      [erp({ coCli: 'A' }), erp({ coCli: 'B' })],
      [{ coCli: 'A', revenueBs: 100, revenueUsd: 2.5 }],
      [],
    );
    expect(rows.find(r => r.coCli === 'A')).toMatchObject({ revenueBs: 100, revenueUsd: 2.5, pareto: 'C' });
    expect(rows.find(r => r.coCli === 'B')).toMatchObject({ revenueBs: 0, revenueUsd: 0, pareto: null });
  });
  test('revenue for a customer not in the ERP active list is ignored', () => {
    const rows = mergeCustomers([erp({ coCli: 'A' })], [{ coCli: 'GHOST', revenueBs: 999, revenueUsd: 9 }], []);
    expect(rows.map(r => r.coCli)).toEqual(['A']);
  });
  test('null USD (no exchange rate) stays null, not 0', () => {
    const [c] = mergeCustomers([erp({ coCli: 'A' })], [{ coCli: 'A', revenueBs: 10, revenueUsd: null }], []);
    expect(c.revenueUsd).toBeNull();
  });
  test('attaches the ids of every route containing the customer', () => {
    const rows = mergeCustomers(
      [erp({ coCli: 'A' }), erp({ coCli: 'B' })],
      [],
      [
        { id: 1, name: 'R1', sellerCode: '000001', customerCodes: ['A', 'B'] },
        { id: 2, name: 'R2', sellerCode: '000001', customerCodes: ['A'] },
      ],
    );
    expect(rows.find(r => r.coCli === 'A')!.routeIds).toEqual([1, 2]);
    expect(rows.find(r => r.coCli === 'B')!.routeIds).toEqual([1]);
  });
});

describe('distinctSellers', () => {
  test('unique by code, sorted by name, falls back to the code when the name is missing', () => {
    const rows = mergeCustomers([
      erp({ coCli: 'A', coVen: '000002', sellerName: 'Zoe' }),
      erp({ coCli: 'B', coVen: '000001', sellerName: 'Ana' }),
      erp({ coCli: 'C', coVen: '000001', sellerName: 'Ana' }),
      erp({ coCli: 'D', coVen: '000003', sellerName: null }),
    ], [], []);
    expect(distinctSellers(rows)).toEqual([
      { code: '000001', name: 'Ana' }, { code: '000003', name: '000003' }, { code: '000002', name: 'Zoe' },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/merge.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/merge`.

- [ ] **Step 3: Write `merge.ts`**

```ts
// lib/geo/merge.ts
import { parseCoordinates, validateCoordinates } from './coordinates';
import { assignPareto } from './pareto';
import type { MapCustomer, MapSeller, RouteDto } from './types';

export interface ErpCustomerRow {
  coCli: string; name: string; rif: string | null;
  coVen: string; sellerName: string | null;
  direc1: string | null; dirEnt2: string | null; campo1: string | null;
}

export interface RevenueRow { coCli: string; revenueBs: number; revenueUsd: number | null }

const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

function locate(campo1: string | null): Pick<MapCustomer, 'lat' | 'lng' | 'coordinatesIssue'> {
  if (!campo1 || !campo1.trim()) return { lat: null, lng: null, coordinatesIssue: null };
  const parsed = parseCoordinates(campo1);
  if (!parsed) return { lat: null, lng: null, coordinatesIssue: 'UNPARSEABLE' };
  const v = validateCoordinates(parsed);
  if (!v.ok) return { lat: null, lng: null, coordinatesIssue: v.error };
  return { lat: parsed.lat, lng: parsed.lng, coordinatesIssue: null };
}

export function mergeCustomers(erp: ErpCustomerRow[], revenue: RevenueRow[], routes: RouteDto[]): MapCustomer[] {
  const known = new Set(erp.map(c => c.coCli.trim()));
  const revenueByCode = new Map<string, RevenueRow>();
  for (const r of revenue) {
    const code = r.coCli.trim();
    if (!known.has(code)) continue;
    const prev = revenueByCode.get(code);
    revenueByCode.set(code, prev
      ? { coCli: code, revenueBs: prev.revenueBs + r.revenueBs, revenueUsd: prev.revenueUsd === null && r.revenueUsd === null ? null : (prev.revenueUsd ?? 0) + (r.revenueUsd ?? 0) }
      : { ...r, coCli: code });
  }
  const pareto = assignPareto([...revenueByCode.values()]);

  const routeIdsByCustomer = new Map<string, number[]>();
  for (const route of routes) {
    for (const code of route.customerCodes) {
      const list = routeIdsByCustomer.get(code) ?? [];
      list.push(route.id);
      routeIdsByCustomer.set(code, list);
    }
  }

  return erp.map(c => {
    const code = c.coCli.trim();
    const rev = revenueByCode.get(code);
    return {
      coCli: code,
      name: c.name.trim(),
      rif: blankToNull(c.rif),
      coVen: c.coVen.trim(),
      sellerName: blankToNull(c.sellerName),
      direc1: blankToNull(c.direc1),
      dirEnt2: blankToNull(c.dirEnt2),
      ...locate(c.campo1),
      revenueBs: rev?.revenueBs ?? 0,
      revenueUsd: rev ? rev.revenueUsd : 0,
      pareto: pareto.get(code) ?? null,
      routeIds: routeIdsByCustomer.get(code) ?? [],
    };
  });
}

export function distinctSellers(customers: MapCustomer[]): MapSeller[] {
  const byCode = new Map<string, MapSeller>();
  for (const c of customers) {
    if (!byCode.has(c.coVen)) byCode.set(c.coVen, { code: c.coVen, name: c.sellerName ?? c.coVen });
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
```

- [ ] **Step 4: Write `map-data.ts` (SQL; verified by the Task 5 smoke run and the `@mssql` e2e)**

```ts
// lib/geo/map-data.ts
import type sql from 'mssql';
import { buildDateWhereClause, usdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import type { ErpCustomerRow, RevenueRow } from './merge';

// Live ERP read. Active customers only; RTRIM because char() columns are
// space-padded. campo1 holds the "Coordenadas: (lat, lng)" text.
export async function fetchErpCustomers(pool: sql.ConnectionPool): Promise<ErpCustomerRow[]> {
  const result = await pool.request().query(`
    SELECT RTRIM(c.co_cli)   AS coCli,
           RTRIM(c.cli_des)  AS name,
           RTRIM(c.rif)      AS rif,
           RTRIM(c.co_ven)   AS coVen,
           RTRIM(v.ven_des)  AS sellerName,
           RTRIM(c.direc1)   AS direc1,
           RTRIM(c.dir_ent2) AS dirEnt2,
           RTRIM(c.campo1)   AS campo1
    FROM saCliente c
    LEFT JOIN saVendedor v ON v.co_ven = c.co_ven
    WHERE c.inactivo = 0
    ORDER BY c.cli_des
  `);
  return result.recordset as ErpCustomerRow[];
}

// DWH read. Dim_Customer is SCD2 (several rows per customer) and
// CustomerCode is char-padded, so group by RTRIM(CustomerCode). `dateRange`
// must already be validated with isValidDateRange(); buildDateWhereClause
// only ever emits digits matched by a regex.
export async function fetchRevenue(dwhPool: sql.ConnectionPool, dateRange: string): Promise<RevenueRow[]> {
  const result = await dwhPool.request().query(`
    SELECT RTRIM(c.CustomerCode) AS coCli,
           ${dualAmountExpr('fs', 'NetAmount', 'RevenueBs', 'RevenueUsd')}
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    ${usdConversionJoin('fs')}
    WHERE fs.IsVoided = 0 ${buildDateWhereClause(dateRange, 'fs')}
    GROUP BY RTRIM(c.CustomerCode)
  `);
  return result.recordset.map((r: { coCli: string; RevenueBs: number | null; RevenueUsd: number | null }) => ({
    coCli: r.coCli,
    revenueBs: Number(r.RevenueBs ?? 0),
    revenueUsd: r.RevenueUsd === null ? null : Number(r.RevenueUsd),
  }));
}
```

- [ ] **Step 5: Run the test to verify it passes, then type-check**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/merge.test.ts && bunx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/geo/merge.ts lib/geo/map-data.ts __tests__/unit/geo/merge.test.ts
git commit -m "feat(geo): merge ERP customers with DWH revenue and routes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Routes persistence (SQLite) and validators

**Files:**
- Modify: `lib/db/schema.ts` (add `routes`, `routeCustomers`)
- Create (generated): `migrations/sqlite/0006_*.sql` + `meta/*`
- Create: `lib/geo/routes-repo.ts`, `lib/geo/route-validation.ts`
- Test: `__tests__/unit/geo/routes-repo.test.ts`, `__tests__/unit/geo/route-validation.test.ts`

**Interfaces:**
- Consumes: `RouteDto` (Task 2).
- Produces:
  ```ts
  export type AppDb = BunSQLiteDatabase<typeof schema>;
  export class DuplicateRouteError extends Error {}
  export class RouteNotFoundError extends Error {}
  export function listRoutes(db: AppDb): RouteDto[];
  export function createRoute(db: AppDb, input: { name: string; sellerCode: string }): RouteDto;
  export function updateRoute(db: AppDb, id: number, patch: { name?: string; sellerCode?: string; customerCodes?: string[] }): RouteDto;
  export function deleteRoute(db: AppDb, id: number): void;
  // route-validation.ts
  export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
  export function parseRouteCreate(body: unknown): Parsed<{ name: string; sellerCode: string }>;
  export function parseRoutePatch(body: unknown): Parsed<{ name?: string; sellerCode?: string; customerCodes?: string[] }>;
  ```

- [ ] **Step 1: Add the tables to the schema and generate the migration**

Append to `lib/db/schema.ts`:

```ts
export const routes = sqliteTable('routes', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  name:       text('name').notNull(),
  sellerCode: text('seller_code').notNull(),          // saVendedor.co_ven, trimmed
  createdAt:  integer('created_at').notNull(),        // unix ms
}, (t) => ({
  uniq: unique('routes_seller_name_unique').on(t.sellerCode, t.name),
}));

export type Route    = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;

export const routeCustomers = sqliteTable('route_customers', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  routeId:      integer('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  customerCode: text('customer_code').notNull(),      // saCliente.co_cli, trimmed
}, (t) => ({
  uniq: unique('route_customers_route_customer_unique').on(t.routeId, t.customerCode),
}));

export type RouteCustomer    = typeof routeCustomers.$inferSelect;
export type NewRouteCustomer = typeof routeCustomers.$inferInsert;
```

Run: `bunx drizzle-kit generate --name geo_routes` (with `SQLITE_PATH` unset or pointed at `e2e/.tmp`; generate does not open the DB).
Expected: a new `migrations/sqlite/0006_geo_routes.sql` containing both `CREATE TABLE`s and the unique indexes, plus an updated `migrations/sqlite/meta/_journal.json` and a `0006_snapshot.json`. Open the SQL and confirm `ON DELETE cascade` is present on `route_customers`.

- [ ] **Step 2: Write the failing validator tests**

```ts
// __tests__/unit/geo/route-validation.test.ts
import { describe, test, expect } from 'bun:test';
import { parseRouteCreate, parseRoutePatch } from '@/lib/geo/route-validation';

describe('parseRouteCreate', () => {
  test('accepts and trims', () => {
    expect(parseRouteCreate({ name: '  Ruta Lunes  ', sellerCode: ' 000001 ' }))
      .toEqual({ ok: true, value: { name: 'Ruta Lunes', sellerCode: '000001' } });
  });
  test('rejects non-objects, blank/long names and missing seller', () => {
    for (const body of [null, 'x', [], { sellerCode: '1' }, { name: '   ', sellerCode: '1' },
      { name: 'x'.repeat(81), sellerCode: '1' }, { name: 'ok' }, { name: 'ok', sellerCode: '' },
      { name: 'ok', sellerCode: 'x'.repeat(17) }, { name: 5, sellerCode: '1' }]) {
      expect(parseRouteCreate(body).ok).toBe(false);
    }
  });
});

describe('parseRoutePatch', () => {
  test('accepts any subset and dedupes/trims customerCodes', () => {
    expect(parseRoutePatch({ customerCodes: [' A ', 'A', 'B'] })).toEqual({ ok: true, value: { customerCodes: ['A', 'B'] } });
    expect(parseRoutePatch({ name: 'N' })).toEqual({ ok: true, value: { name: 'N' } });
    expect(parseRoutePatch({ customerCodes: [] })).toEqual({ ok: true, value: { customerCodes: [] } });
  });
  test('rejects empty patch, wrong types, blank codes and oversized lists', () => {
    for (const body of [{}, null, { name: '' }, { sellerCode: '' }, { customerCodes: 'A' },
      { customerCodes: ['A', ''] }, { customerCodes: [1] }, { customerCodes: Array.from({ length: 2001 }, (_, i) => `C${i}`) }]) {
      expect(parseRoutePatch(body).ok).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Write the failing repo tests**

```ts
// __tests__/unit/geo/routes-repo.test.ts
import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import {
  listRoutes, createRoute, updateRoute, deleteRoute, DuplicateRouteError, RouteNotFoundError,
} from '@/lib/geo/routes-repo';

const sqlite = new Database(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
const db = drizzle(sqlite, { schema });

beforeAll(() => { migrate(db, { migrationsFolder: './migrations/sqlite' }); });
beforeEach(() => { sqlite.exec('DELETE FROM route_customers'); sqlite.exec('DELETE FROM routes'); });

describe('routes repo', () => {
  test('create then list', () => {
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    expect(r).toMatchObject({ name: 'Lunes', sellerCode: '000001', customerCodes: [] });
    expect(listRoutes(db)).toEqual([r]);
  });
  test('same name for the same seller is a DuplicateRouteError; same name for another seller is fine', () => {
    createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    expect(() => createRoute(db, { name: 'Lunes', sellerCode: '000001' })).toThrow(DuplicateRouteError);
    expect(createRoute(db, { name: 'Lunes', sellerCode: '000002' }).id).toBeGreaterThan(0);
  });
  test('updateRoute replaces membership atomically and renames', () => {
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    expect(updateRoute(db, r.id, { customerCodes: ['A', 'B'] }).customerCodes.sort()).toEqual(['A', 'B']);
    const again = updateRoute(db, r.id, { name: 'Martes', customerCodes: ['B', 'C'] });
    expect(again.name).toBe('Martes');
    expect(again.customerCodes.sort()).toEqual(['B', 'C']);
  });
  test('renaming into a duplicate throws and leaves membership unchanged', () => {
    createRoute(db, { name: 'Martes', sellerCode: '000001' });
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    updateRoute(db, r.id, { customerCodes: ['A'] });
    expect(() => updateRoute(db, r.id, { name: 'Martes', customerCodes: ['Z'] })).toThrow(DuplicateRouteError);
    expect(listRoutes(db).find(x => x.id === r.id)!.customerCodes).toEqual(['A']);
  });
  test('unknown id → RouteNotFoundError (update and delete)', () => {
    expect(() => updateRoute(db, 999, { name: 'x' })).toThrow(RouteNotFoundError);
    expect(() => deleteRoute(db, 999)).toThrow(RouteNotFoundError);
  });
  test('deleting a route cascades its memberships', () => {
    const r = createRoute(db, { name: 'Lunes', sellerCode: '000001' });
    updateRoute(db, r.id, { customerCodes: ['A'] });
    deleteRoute(db, r.id);
    expect(listRoutes(db)).toEqual([]);
    expect(sqlite.query('SELECT COUNT(*) AS n FROM route_customers').get()).toEqual({ n: 0 });
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/route-validation.test.ts __tests__/unit/geo/routes-repo.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Write the validators**

```ts
// lib/geo/route-validation.ts
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_NAME = 80;
const MAX_CODE = 16;       // saCliente.co_cli is char(16)
const MAX_MEMBERS = 2000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function name(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Nombre requerido' };
  if (v.trim().length > MAX_NAME) return { ok: false, error: `Nombre demasiado largo (máximo ${MAX_NAME})` };
  return { ok: true, value: v.trim() };
}

function sellerCode(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Vendedor requerido' };
  if (v.trim().length > MAX_CODE) return { ok: false, error: 'Código de vendedor inválido' };
  return { ok: true, value: v.trim() };
}

export function parseRouteCreate(body: unknown): Parsed<{ name: string; sellerCode: string }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const n = name(body.name); if (!n.ok) return n;
  const s = sellerCode(body.sellerCode); if (!s.ok) return s;
  return { ok: true, value: { name: n.value, sellerCode: s.value } };
}

export function parseRoutePatch(body: unknown): Parsed<{ name?: string; sellerCode?: string; customerCodes?: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Datos inválidos' };
  const out: { name?: string; sellerCode?: string; customerCodes?: string[] } = {};
  if ('name' in body) { const n = name(body.name); if (!n.ok) return n; out.name = n.value; }
  if ('sellerCode' in body) { const s = sellerCode(body.sellerCode); if (!s.ok) return s; out.sellerCode = s.value; }
  if ('customerCodes' in body) {
    const list = body.customerCodes;
    if (!Array.isArray(list)) return { ok: false, error: 'customerCodes debe ser una lista' };
    if (list.length > MAX_MEMBERS) return { ok: false, error: `Demasiados clientes (máximo ${MAX_MEMBERS})` };
    const codes: string[] = [];
    for (const c of list) {
      if (typeof c !== 'string' || !c.trim() || c.trim().length > MAX_CODE) return { ok: false, error: 'Código de cliente inválido' };
      if (!codes.includes(c.trim())) codes.push(c.trim());
    }
    out.customerCodes = codes;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, value: out };
}
```

- [ ] **Step 6: Write the repo**

```ts
// lib/geo/routes-repo.ts
import { eq, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import type { RouteDto } from './types';

export type AppDb = BunSQLiteDatabase<typeof schema>;

export class DuplicateRouteError extends Error {
  constructor() { super('Ya existe una ruta con ese nombre para este vendedor'); this.name = 'DuplicateRouteError'; }
}
export class RouteNotFoundError extends Error {
  constructor() { super('Ruta no encontrada'); this.name = 'RouteNotFoundError'; }
}

function isUniqueViolation(err: unknown): boolean {
  const text = (e: unknown) => (e instanceof Error ? e.message : '');
  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  return /UNIQUE constraint failed/i.test(text(err)) || /UNIQUE constraint failed/i.test(text(cause));
}

function toDtos(db: AppDb, ids?: number[]): RouteDto[] {
  const base = db.select().from(schema.routes);
  const rows = (ids ? base.where(inArray(schema.routes.id, ids)) : base).orderBy(schema.routes.name).all();
  if (rows.length === 0) return [];
  const members = db.select().from(schema.routeCustomers)
    .where(inArray(schema.routeCustomers.routeId, rows.map(r => r.id))).all();
  return rows.map(r => ({
    id: r.id, name: r.name, sellerCode: r.sellerCode,
    customerCodes: members.filter(m => m.routeId === r.id).map(m => m.customerCode),
  }));
}

export function listRoutes(db: AppDb): RouteDto[] {
  return toDtos(db);
}

export function createRoute(db: AppDb, input: { name: string; sellerCode: string }): RouteDto {
  try {
    const row = db.insert(schema.routes)
      .values({ name: input.name, sellerCode: input.sellerCode, createdAt: Date.now() })
      .returning().get()!;
    return { id: row.id, name: row.name, sellerCode: row.sellerCode, customerCodes: [] };
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateRouteError();
    throw err;
  }
}

export function updateRoute(
  db: AppDb, id: number, patch: { name?: string; sellerCode?: string; customerCodes?: string[] },
): RouteDto {
  try {
    db.transaction(tx => {
      const existing = tx.select().from(schema.routes).where(eq(schema.routes.id, id)).get();
      if (!existing) throw new RouteNotFoundError();
      if (patch.name !== undefined || patch.sellerCode !== undefined) {
        tx.update(schema.routes)
          .set({ name: patch.name ?? existing.name, sellerCode: patch.sellerCode ?? existing.sellerCode })
          .where(eq(schema.routes.id, id)).run();
      }
      if (patch.customerCodes !== undefined) {
        tx.delete(schema.routeCustomers).where(eq(schema.routeCustomers.routeId, id)).run();
        for (const customerCode of patch.customerCodes) {
          tx.insert(schema.routeCustomers).values({ routeId: id, customerCode }).run();
        }
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateRouteError();
    throw err;
  }
  return toDtos(db, [id])[0];
}

export function deleteRoute(db: AppDb, id: number): void {
  const existing = db.select().from(schema.routes).where(eq(schema.routes.id, id)).get();
  if (!existing) throw new RouteNotFoundError();
  db.delete(schema.routes).where(eq(schema.routes.id, id)).run();   // memberships cascade (FK ON DELETE CASCADE)
}
```

- [ ] **Step 7: Run to verify they pass**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/route-validation.test.ts __tests__/unit/geo/routes-repo.test.ts`
Expected: PASS. If the transactional-rollback test fails (membership changed after a duplicate rename), confirm `db.transaction` rolls back on throw — drizzle's bun-sqlite transaction does; the failure would mean the throw escaped before the rename ran, which is also acceptable only if membership is unchanged.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts migrations/sqlite lib/geo/routes-repo.ts lib/geo/route-validation.ts \
  __tests__/unit/geo/routes-repo.test.ts __tests__/unit/geo/route-validation.test.ts
git commit -m "feat(geo): routes tables, repo and validators

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: API routes (`clientes`, `ubicacion`, `rutas`)

**Files:**
- Create: `lib/geo/location-patch.ts`
- Test: `__tests__/unit/geo/location-patch.test.ts`
- Create: `app/api/mapa/clientes/route.ts`
- Create: `app/api/mapa/clientes/[co_cli]/ubicacion/route.ts`
- Create: `app/api/mapa/rutas/route.ts`, `app/api/mapa/rutas/[id]/route.ts`
- Test: `app/api/mapa/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 and Plan 1.
- Produces:
  ```ts
  // location-patch.ts
  export interface LocationPatchValue { campo1?: string; coordinates?: LatLng; dirEnt2?: string }
  export function parseLocationPatch(body: unknown): { ok: true; value: LocationPatchValue } | { ok: false; error: string; field?: 'coordinates' | 'dirEnt2' };
  // HTTP
  // GET   /api/mapa/clientes?dateRange=      → MapPayload
  // PATCH /api/mapa/clientes/[co_cli]/ubicacion  body { lat?, lng?, dirEnt2? } → { ok: true, coordinates?: LatLng, dirEnt2?: string }
  // POST  /api/mapa/rutas                    body { name, sellerCode } → 201 { item: RouteDto } | 409
  // PATCH /api/mapa/rutas/[id]               body { name?, sellerCode?, customerCodes? } → { item: RouteDto } | 404 | 409
  // DELETE /api/mapa/rutas/[id]              → { ok: true } | 404
  ```

- [ ] **Step 1: Write the failing location-patch tests**

```ts
// __tests__/unit/geo/location-patch.test.ts
import { describe, test, expect } from 'bun:test';
import { parseLocationPatch } from '@/lib/geo/location-patch';

describe('parseLocationPatch', () => {
  test('coordinates only → canonical campo1', () => {
    expect(parseLocationPatch({ lat: 10.4806, lng: -66.9036 })).toEqual({
      ok: true,
      value: { coordinates: { lat: 10.4806, lng: -66.9036 }, campo1: 'Coordenadas: (10.480600, -66.903600)' },
    });
  });
  test('address only is trimmed', () => {
    expect(parseLocationPatch({ dirEnt2: '  Av. Principal  ' })).toEqual({ ok: true, value: { dirEnt2: 'Av. Principal' } });
  });
  test('both together', () => {
    const r = parseLocationPatch({ lat: 10, lng: -66, dirEnt2: 'X' });
    expect(r.ok && r.value.campo1 && r.value.dirEnt2).toBe('X');
  });
  test('only one of lat/lng is rejected with a coordinates field error', () => {
    expect(parseLocationPatch({ lat: 10 })).toMatchObject({ ok: false, field: 'coordinates' });
    expect(parseLocationPatch({ lng: -66 })).toMatchObject({ ok: false, field: 'coordinates' });
  });
  test('non-numbers and NaN are rejected', () => {
    expect(parseLocationPatch({ lat: '10', lng: -66 })).toMatchObject({ ok: false, field: 'coordinates' });
    expect(parseLocationPatch({ lat: NaN, lng: -66 })).toMatchObject({ ok: false, field: 'coordinates' });
  });
  test('swapped pair is rejected with the Spanish swapped message', () => {
    const r = parseLocationPatch({ lat: -66.9, lng: 10.5 });
    expect(r).toMatchObject({ ok: false, field: 'coordinates' });
    expect(!r.ok && r.error).toContain('invertid');
  });
  test('outside Venezuela is rejected', () => {
    const r = parseLocationPatch({ lat: 40.4, lng: -3.7 });
    expect(r).toMatchObject({ ok: false, field: 'coordinates' });
    expect(!r.ok && r.error).toContain('Venezuela');
  });
  test('empty body, non-objects, blank or over-long address are rejected', () => {
    expect(parseLocationPatch({}).ok).toBe(false);
    expect(parseLocationPatch(null).ok).toBe(false);
    expect(parseLocationPatch({ dirEnt2: '   ' })).toMatchObject({ ok: false, field: 'dirEnt2' });
    expect(parseLocationPatch({ dirEnt2: 'x'.repeat(501) })).toMatchObject({ ok: false, field: 'dirEnt2' });
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/location-patch.test.ts` → FAIL (module missing).

```ts
// lib/geo/location-patch.ts
import { validateCoordinates, formatCoordinates, coordinateErrorMessage, type LatLng } from './coordinates';

export interface LocationPatchValue { campo1?: string; coordinates?: LatLng; dirEnt2?: string }

type Result =
  | { ok: true; value: LocationPatchValue }
  | { ok: false; error: string; field?: 'coordinates' | 'dirEnt2' };

const MAX_ADDRESS = 500;

export function parseLocationPatch(body: unknown): Result {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Datos inválidos' };
  const b = body as Record<string, unknown>;
  const value: LocationPatchValue = {};

  const hasLat = 'lat' in b;
  const hasLng = 'lng' in b;
  if (hasLat || hasLng) {
    if (!hasLat || !hasLng) return { ok: false, field: 'coordinates', error: 'Indique latitud y longitud' };
    if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
      return { ok: false, field: 'coordinates', error: 'Latitud y longitud deben ser números' };
    }
    const c = { lat: b.lat, lng: b.lng };
    const v = validateCoordinates(c);
    if (!v.ok) return { ok: false, field: 'coordinates', error: coordinateErrorMessage(v.error) };
    value.coordinates = c;
    value.campo1 = formatCoordinates(c);
  }

  if ('dirEnt2' in b) {
    if (typeof b.dirEnt2 !== 'string' || !b.dirEnt2.trim()) return { ok: false, field: 'dirEnt2', error: 'La dirección no puede estar vacía' };
    if (b.dirEnt2.trim().length > MAX_ADDRESS) return { ok: false, field: 'dirEnt2', error: `Dirección demasiado larga (máximo ${MAX_ADDRESS})` };
    value.dirEnt2 = b.dirEnt2.trim();
  }

  if (!value.campo1 && !value.dirEnt2) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, value };
}
```

Run again → PASS.

- [ ] **Step 3: Write the failing auth test for all four route files**

```ts
// app/api/mapa/__tests__/auth.test.ts
import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET as getClientes } from '../clientes/route';
import { PATCH as patchUbicacion } from '../clientes/[co_cli]/ubicacion/route';
import { POST as postRuta } from '../rutas/route';
import { PATCH as patchRuta, DELETE as deleteRuta } from '../rutas/[id]/route';

const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });

describe('/api/mapa/* reject unauthenticated requests with 401', () => {
  test('GET clientes', async () => {
    expect((await getClientes(new NextRequest('http://localhost/api/mapa/clientes'))).status).toBe(401);
  });
  test('PATCH ubicacion', async () => {
    const res = await patchUbicacion(json('http://localhost/api/mapa/clientes/A/ubicacion', 'PATCH', { lat: 10, lng: -66 }), ctx({ co_cli: 'A' }));
    expect(res.status).toBe(401);
  });
  test('POST rutas', async () => {
    expect((await postRuta(json('http://localhost/api/mapa/rutas', 'POST', { name: 'x', sellerCode: '1' }))).status).toBe(401);
  });
  test('PATCH / DELETE rutas/[id]', async () => {
    expect((await patchRuta(json('http://localhost/api/mapa/rutas/1', 'PATCH', { name: 'x' }), ctx({ id: '1' }))).status).toBe(401);
    expect((await deleteRuta(json('http://localhost/api/mapa/rutas/1', 'DELETE'), ctx({ id: '1' }))).status).toBe(401);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local app/api/mapa/__tests__/auth.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 5: Write `GET /api/mapa/clientes`**

```ts
// app/api/mapa/clientes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getPool } from '@/lib/db/mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { fetchErpCustomers, fetchRevenue } from '@/lib/geo/map-data';
import { mergeCustomers, distinctSellers } from '@/lib/geo/merge';
import { listRoutes } from '@/lib/geo/routes-repo';
import { isValidDateRange, previousMonthRange } from '@/lib/geo/date-range';
import { PARETO_THRESHOLDS, type MapPayload } from '@/lib/geo/types';

export const dynamic = 'force-dynamic';

// The one place the app merges ERP (live) and DWH (pre-aggregated) data —
// in TypeScript, by customer code. See AGENTS.md ("Database" section).
export async function GET(request: NextRequest) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const param = new URL(request.url).searchParams.get('dateRange');
  if (param !== null && !isValidDateRange(param)) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }
  const dateRange = param ?? previousMonthRange();

  try {
    const [erpPool, dwhPool] = await Promise.all([getPool(), getDwhPool()]);
    const [erpCustomers, revenue] = await Promise.all([
      fetchErpCustomers(erpPool),
      fetchRevenue(dwhPool, dateRange),
    ]);
    const routes = listRoutes(getDb());
    const customers = mergeCustomers(erpCustomers, revenue, routes);

    const payload: MapPayload = {
      dateRange, customers, sellers: distinctSellers(customers), routes, paretoThresholds: PARETO_THRESHOLDS,
    };
    captureEvent(auth.session.sub, 'mapa_viewed', { dateRange, customers: customers.length });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('GET /api/mapa/clientes failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar los datos del mapa' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write `PATCH …/ubicacion`**

```ts
// app/api/mapa/clientes/[co_cli]/ubicacion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getPool } from '@/lib/db/mssql';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseLocationPatch } from '@/lib/geo/location-patch';
import { updateCustomerLocation, CustomerNotFoundError } from '@/lib/geo/erp-location';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ co_cli: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const { co_cli } = await params;
  const body = await request.json().catch(() => null);
  const parsed = parseLocationPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });

  try {
    await updateCustomerLocation(await getPool(), {
      coCli: decodeURIComponent(co_cli),
      campo1: parsed.value.campo1,
      dirEnt2: parsed.value.dirEnt2,
    });
    captureEvent(auth.session.sub, 'mapa_location_updated', {
      coordinates: Boolean(parsed.value.campo1), address: Boolean(parsed.value.dirEnt2),
    });
    return NextResponse.json({ ok: true, coordinates: parsed.value.coordinates, dirEnt2: parsed.value.dirEnt2 });
  } catch (err) {
    if (err instanceof CustomerNotFoundError) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    console.error('PATCH ubicacion failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error al actualizar en Profit Plus' }, { status: 500 });
  }
}
```

- [ ] **Step 7: Write the routes API**

```ts
// app/api/mapa/rutas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseRouteCreate } from '@/lib/geo/route-validation';
import { createRoute, DuplicateRouteError } from '@/lib/geo/routes-repo';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const parsed = parseRouteCreate(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = createRoute(getDb(), parsed.value);
    captureEvent(auth.session.sub, 'mapa_route_created', {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateRouteError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('POST /api/mapa/rutas failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

```ts
// app/api/mapa/rutas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireGeoAccess } from '@/lib/geo/access';
import { getDb } from '@/lib/db/sqlite';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseRoutePatch } from '@/lib/geo/route-validation';
import { updateRoute, deleteRoute, DuplicateRouteError, RouteNotFoundError } from '@/lib/geo/routes-repo';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
  const parsed = parseRoutePatch(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = updateRoute(getDb(), id, parsed.value);
    captureEvent(auth.session.sub, 'mapa_route_updated', { members: parsed.value.customerCodes?.length });
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof RouteNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof DuplicateRouteError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('PATCH /api/mapa/rutas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireGeoAccess(request);
  if (!auth.ok) return auth.response;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
  try {
    deleteRoute(getDb(), id);
    captureEvent(auth.session.sub, 'mapa_route_deleted', {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RouteNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('DELETE /api/mapa/rutas/[id] failed', err);
    captureException(err, auth.session.sub);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 8: Run tests, type-check, and smoke the live payload**

Run: `bun test --isolate --env-file=.env.local app/api/mapa/__tests__/auth.test.ts __tests__/unit/geo/ && bunx tsc --noEmit`
Expected: PASS, clean.

Smoke (read-only, real ERP + DWH): create `scratch-payload.ts` in the scratchpad directory:
```ts
import { getPool } from '@/lib/db/mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { fetchErpCustomers, fetchRevenue } from '@/lib/geo/map-data';
import { mergeCustomers } from '@/lib/geo/merge';
import { previousMonthRange } from '@/lib/geo/date-range';
const [e, d] = [await getPool(), await getDwhPool()];
const rows = mergeCustomers(await fetchErpCustomers(e), await fetchRevenue(d, previousMonthRange()), []);
console.log(rows.length, rows.filter(r => r.revenueBs > 0).length, rows.filter(r => r.pareto === 'A').length);
process.exit(0);
```
Run: `bun --env-file=.env.local <that file>`. Expected: first number = 144 active customers (or the current active count); second ≥ 1 if the previous month has sales; no exception.

- [ ] **Step 9: Commit**

```bash
git add lib/geo/location-patch.ts __tests__/unit/geo/location-patch.test.ts app/api/mapa
git commit -m "feat(geo): /api/mapa clientes, ubicacion and rutas endpoints

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Filters (URL-synced) — pure logic

**Files:**
- Create: `lib/geo/filters.ts`
- Test: `__tests__/unit/geo/filters.test.ts`

**Interfaces:**
- Consumes: `MapCustomer`, `MapSeller`, `RouteDto`, `Pareto` (Task 2); `previousMonthRange`, `periodOptions` (Task 2).
- Produces:
  ```ts
  export interface MapFilters { dateRange: string; seller: string | null; route: number | null; pareto: Pareto | null; noCoords: boolean }
  export function parseFilters(params: URLSearchParams, now?: Date): MapFilters;
  export function serializeFilters(f: MapFilters, now?: Date): URLSearchParams;   // omits defaults
  export function normalizeFilters(f: MapFilters, routes: RouteDto[]): MapFilters;
  export function applyFilters(customers: MapCustomer[], f: MapFilters): MapCustomer[];
  export interface FilterChip { key: 'dateRange' | 'seller' | 'route' | 'pareto' | 'noCoords'; label: string }
  export function filterChips(f: MapFilters, ctx: { sellers: MapSeller[]; routes: RouteDto[] }, now?: Date): FilterChip[];
  ```
  URL keys: `dateRange`, `seller`, `route`, `pareto`, `noCoords=1`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/filters.test.ts
import { describe, test, expect } from 'bun:test';
import { parseFilters, serializeFilters, normalizeFilters, applyFilters, filterChips, type MapFilters } from '@/lib/geo/filters';
import type { MapCustomer, RouteDto } from '@/lib/geo/types';

const NOW = new Date(2026, 8, 30);
const base: MapFilters = { dateRange: 'month:2026-08', seller: null, route: null, pareto: null, noCoords: false };

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '000001', sellerName: 'Ana', direc1: null, dirEnt2: null,
  lat: 10, lng: -66, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [], ...over,
});

describe('parseFilters / serializeFilters', () => {
  test('empty params → defaults (previous month)', () => {
    expect(parseFilters(new URLSearchParams(), NOW)).toEqual(base);
  });
  test('parses every key', () => {
    const f = parseFilters(new URLSearchParams('dateRange=ytd:2026&seller=000002&route=7&pareto=B&noCoords=1'), NOW);
    expect(f).toEqual({ dateRange: 'ytd:2026', seller: '000002', route: 7, pareto: 'B', noCoords: true });
  });
  test('garbage values fall back to defaults instead of throwing', () => {
    const f = parseFilters(new URLSearchParams("dateRange=evil';--&route=abc&pareto=Z&noCoords=maybe"), NOW);
    expect(f).toEqual(base);
  });
  test('serialize omits defaults and round-trips', () => {
    expect(serializeFilters(base, NOW).toString()).toBe('');
    const f: MapFilters = { dateRange: 'ytd:2026', seller: '000002', route: 7, pareto: 'A', noCoords: true };
    expect(parseFilters(serializeFilters(f, NOW), NOW)).toEqual(f);
  });
});

describe('normalizeFilters', () => {
  const routes: RouteDto[] = [
    { id: 1, name: 'R1', sellerCode: '000001', customerCodes: [] },
    { id: 2, name: 'R2', sellerCode: '000002', customerCodes: [] },
  ];
  test('clears a route that belongs to a different seller', () => {
    expect(normalizeFilters({ ...base, seller: '000001', route: 2 }, routes).route).toBeNull();
  });
  test('keeps a route that matches the seller, or any route when no seller is set', () => {
    expect(normalizeFilters({ ...base, seller: '000001', route: 1 }, routes).route).toBe(1);
    expect(normalizeFilters({ ...base, route: 2 }, routes).route).toBe(2);
  });
  test('clears a route id that no longer exists', () => {
    expect(normalizeFilters({ ...base, route: 99 }, routes).route).toBeNull();
  });
});

describe('applyFilters', () => {
  const rows = [
    cust({ coCli: 'A', coVen: '000001', pareto: 'A', routeIds: [1] }),
    cust({ coCli: 'B', coVen: '000002', pareto: 'B', routeIds: [1, 2] }),
    cust({ coCli: 'C', coVen: '000001', pareto: null, lat: null, lng: null }),
  ];
  const codes = (f: Partial<MapFilters>) => applyFilters(rows, { ...base, ...f }).map(r => r.coCli);
  test('no filters → everyone', () => expect(codes({})).toEqual(['A', 'B', 'C']));
  test('seller', () => expect(codes({ seller: '000001' })).toEqual(['A', 'C']));
  test('route', () => expect(codes({ route: 1 })).toEqual(['A', 'B']));
  test('pareto', () => expect(codes({ pareto: 'B' })).toEqual(['B']));
  test('noCoords keeps only customers without a pin', () => expect(codes({ noCoords: true })).toEqual(['C']));
  test('filters combine with AND', () => expect(codes({ seller: '000001', route: 1 })).toEqual(['A']));
});

describe('filterChips', () => {
  test('no chips for defaults', () => {
    expect(filterChips(base, { sellers: [], routes: [] }, NOW)).toEqual([]);
  });
  test('one chip per active non-default filter, human-labelled', () => {
    const chips = filterChips(
      { dateRange: 'ytd:2026', seller: '000001', route: 1, pareto: 'A', noCoords: true },
      { sellers: [{ code: '000001', name: 'Ana' }], routes: [{ id: 1, name: 'Lunes', sellerCode: '000001', customerCodes: [] }] },
      NOW,
    );
    expect(chips.map(c => c.key)).toEqual(['dateRange', 'seller', 'route', 'pareto', 'noCoords']);
    expect(chips.find(c => c.key === 'seller')!.label).toBe('Vendedor: Ana');
    expect(chips.find(c => c.key === 'route')!.label).toBe('Ruta: Lunes');
    expect(chips.find(c => c.key === 'pareto')!.label).toBe('Segmento: A');
    expect(chips.find(c => c.key === 'noCoords')!.label).toBe('Sin coordenadas');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/filters.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```ts
// lib/geo/filters.ts
import { isValidDateRange, previousMonthRange, periodOptions } from './date-range';
import type { MapCustomer, MapSeller, Pareto, RouteDto } from './types';

export interface MapFilters {
  dateRange: string;
  seller: string | null;
  route: number | null;
  pareto: Pareto | null;
  noCoords: boolean;
}

export function parseFilters(params: URLSearchParams, now: Date = new Date()): MapFilters {
  const dateRange = params.get('dateRange');
  const route = params.get('route');
  const pareto = params.get('pareto');
  return {
    dateRange: dateRange && isValidDateRange(dateRange) ? dateRange : previousMonthRange(now),
    seller: params.get('seller') || null,
    route: route && /^\d+$/.test(route) ? parseInt(route, 10) : null,
    pareto: pareto === 'A' || pareto === 'B' || pareto === 'C' ? pareto : null,
    noCoords: params.get('noCoords') === '1',
  };
}

export function serializeFilters(f: MapFilters, now: Date = new Date()): URLSearchParams {
  const p = new URLSearchParams();
  if (f.dateRange !== previousMonthRange(now)) p.set('dateRange', f.dateRange);
  if (f.seller) p.set('seller', f.seller);
  if (f.route !== null) p.set('route', String(f.route));
  if (f.pareto) p.set('pareto', f.pareto);
  if (f.noCoords) p.set('noCoords', '1');
  return p;
}

// A route filter is only meaningful while it exists and (when a seller is
// selected) belongs to that seller.
export function normalizeFilters(f: MapFilters, routes: RouteDto[]): MapFilters {
  if (f.route === null) return f;
  const route = routes.find(r => r.id === f.route);
  if (!route || (f.seller !== null && route.sellerCode !== f.seller)) return { ...f, route: null };
  return f;
}

export function applyFilters(customers: MapCustomer[], f: MapFilters): MapCustomer[] {
  return customers.filter(c =>
    (f.seller === null || c.coVen === f.seller) &&
    (f.route === null || c.routeIds.includes(f.route)) &&
    (f.pareto === null || c.pareto === f.pareto) &&
    (!f.noCoords || c.lat === null),
  );
}

export interface FilterChip {
  key: 'dateRange' | 'seller' | 'route' | 'pareto' | 'noCoords';
  label: string;
}

export function filterChips(
  f: MapFilters, ctx: { sellers: MapSeller[]; routes: RouteDto[] }, now: Date = new Date(),
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.dateRange !== previousMonthRange(now)) {
    const label = periodOptions(now).find(o => o.value === f.dateRange)?.label ?? f.dateRange;
    chips.push({ key: 'dateRange', label: `Período: ${label}` });
  }
  if (f.seller) chips.push({ key: 'seller', label: `Vendedor: ${ctx.sellers.find(s => s.code === f.seller)?.name ?? f.seller}` });
  if (f.route !== null) chips.push({ key: 'route', label: `Ruta: ${ctx.routes.find(r => r.id === f.route)?.name ?? f.route}` });
  if (f.pareto) chips.push({ key: 'pareto', label: `Segmento: ${f.pareto}` });
  if (f.noCoords) chips.push({ key: 'noCoords', label: 'Sin coordenadas' });
  return chips;
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/filters.test.ts`
Expected: PASS.

```bash
git add lib/geo/filters.ts __tests__/unit/geo/filters.test.ts
git commit -m "feat(geo): URL-synced map filters

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Page shell, map, pins and popups

**Files:**
- Modify: `package.json` / lockfile (`bun add leaflet react-leaflet && bun add -d @types/leaflet`)
- Create: `app/(app)/mapa/page.tsx`, `mapa-loader.tsx`, `mapa-client.tsx`
- Create: `app/(app)/mapa/components/customer-map.tsx`, `customer-popup.tsx`, `pin-icon.ts`

**Interfaces:**
- Consumes: `MapPayload`, `MapCustomer`, `Pareto` (Task 2), `MapFilters`, `parseFilters`, `serializeFilters`, `applyFilters`, `normalizeFilters` (Task 6), `GET /api/mapa/clientes` (Task 5), `hasGeoAccess` (Task 1).
- Produces (used by Tasks 8–10 and Plan 3):
  ```ts
  // customer-map.tsx
  export interface CustomerMapProps {
    customers: MapCustomer[];                 // already filtered
    selectedCoCli: string | null;
    onSelect: (coCli: string | null) => void;
    onEditLocation: (coCli: string) => void;
    fitKey: number;                           // increment to refit bounds
    editing: { lat: number | null; lng: number | null } | null;   // draft position while editing a location
    onPlace: (lat: number, lng: number) => void;                  // map click / marker drag while editing
    children?: React.ReactNode;               // Plan 3 mounts area/heat layers here
  }
  export default function CustomerMap(props: CustomerMapProps): JSX.Element;
  ```

- [ ] **Step 1: Install the map dependencies**

Run: `bun add leaflet react-leaflet && bun add -d @types/leaflet`
Expected: `react-leaflet` 5.x (React 19 compatible); lockfile updated.

- [ ] **Step 2: Write the server page and the client-only loader**

```tsx
// app/(app)/mapa/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasGeoAccess } from '@/lib/geo/access';
import MapaLoader from './mapa-loader';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const allowed = await hasGeoAccess(getDb(), session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  return <MapaLoader />;
}
```

```tsx
// app/(app)/mapa/mapa-loader.tsx
'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time, so the whole map tree is a
// client-only leaf; the page itself stays a Server Component (session +
// module check). The fixed-height placeholder prevents layout shift.
const MapaClient = dynamic(() => import('./mapa-client'), {
  ssr: false,
  loading: () => (
    <div role="status" className="h-full min-h-[50vh] flex items-center justify-center text-sm text-gray-500">
      Cargando mapa…
    </div>
  ),
});

export default function MapaLoader() {
  return <MapaClient />;
}
```

- [ ] **Step 3: Write the pin icon helper**

```ts
// app/(app)/mapa/components/pin-icon.ts
import L from 'leaflet';
import type { Pareto } from '@/lib/geo/types';

// White text on each fill is ≥ 4.5:1. The letter (A/B/C/–) means colour is
// never the only signal. The outer 44×44 box is the touch target.
export const PARETO_COLORS: Record<Pareto | 'none', string> = {
  A: '#15803d', B: '#b45309', C: '#475569', none: '#6b7280',
};

const cache = new Map<string, L.DivIcon>();

function build(label: string, color: string, selected: boolean): L.DivIcon {
  const outline = selected ? ';outline:3px solid #2563eb;outline-offset:1px' : '';
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -16],
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">`
      + `<span style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;`
      + `font:600 13px/28px system-ui,sans-serif;text-align:center;border:2px solid #fff;`
      + `box-shadow:0 1px 3px rgba(0,0,0,.5)${outline}">${label}</span></div>`,
  });
}

export function pinIcon(pareto: Pareto | null, selected: boolean): L.DivIcon {
  const key = `${pareto ?? 'none'}:${selected}`;
  let icon = cache.get(key);
  if (!icon) { icon = build(pareto ?? '–', PARETO_COLORS[pareto ?? 'none'], selected); cache.set(key, icon); }
  return icon;
}

export function editIcon(): L.DivIcon {
  const key = 'edit';
  let icon = cache.get(key);
  if (!icon) { icon = build('✎', '#2563eb', true); cache.set(key, icon); }
  return icon;
}
```

- [ ] **Step 4: Write the popup**

```tsx
// app/(app)/mapa/components/customer-popup.tsx
'use client';

import type { MapCustomer, RouteDto } from '@/lib/geo/types';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CustomerPopup({
  customer, routes, onEditLocation,
}: { customer: MapCustomer; routes: RouteDto[]; onEditLocation: (coCli: string) => void }) {
  const customerRoutes = routes.filter(r => customer.routeIds.includes(r.id));
  return (
    <div className="min-w-56 max-w-72 text-sm text-gray-800">
      <p className="font-semibold text-gray-900">{customer.name}</p>
      <p className="text-xs text-gray-500">{customer.coCli}{customer.rif ? ` · ${customer.rif}` : ''}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-gray-500">Ingresos</dt>
        <dd className="font-medium">{customer.revenueUsd === null ? 'Sin tasa' : usd.format(customer.revenueUsd)}</dd>
        <dt className="text-gray-500">Segmento</dt>
        <dd>{customer.pareto ?? 'Sin ventas'}</dd>
        <dt className="text-gray-500">Vendedor</dt>
        <dd>{customer.sellerName ?? customer.coVen}</dd>
        <dt className="text-gray-500">Entrega</dt>
        <dd>{customer.dirEnt2 ?? customer.direc1 ?? '—'}</dd>
        <dt className="text-gray-500">Rutas</dt>
        <dd>{customerRoutes.length ? customerRoutes.map(r => r.name).join(', ') : '—'}</dd>
      </dl>
      <button
        type="button"
        onClick={() => onEditLocation(customer.coCli)}
        className="mt-3 min-h-11 w-full rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        Editar ubicación
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Write the map component**

```tsx
// app/(app)/mapa/components/customer-map.tsx
'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { MapCustomer, RouteDto } from '@/lib/geo/types';
import { pinIcon, editIcon } from './pin-icon';
import { CustomerPopup } from './customer-popup';

const VENEZUELA_CENTER: [number, number] = [8.0, -66.0];

export interface CustomerMapProps {
  customers: MapCustomer[];
  routes: RouteDto[];
  selectedCoCli: string | null;
  onSelect: (coCli: string | null) => void;
  onEditLocation: (coCli: string) => void;
  fitKey: number;
  editing: { lat: number | null; lng: number | null } | null;
  onPlace: (lat: number, lng: number) => void;
  children?: React.ReactNode;
}

// Always snaps (animate: false): no animated pans/zooms, so
// prefers-reduced-motion is respected without a media-query check.
function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15, animate: false });
    // Refit only when asked (fitKey changes), not on every filter tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

function ClickToPlace({ active, onPlace }: { active: boolean; onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { if (active) onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function CustomerMap({
  customers, routes, selectedCoCli, onSelect, onEditLocation, fitKey, editing, onPlace, children,
}: CustomerMapProps) {
  const located = useMemo(() => customers.filter(c => c.lat !== null && c.lng !== null), [customers]);
  const points = useMemo(() => located.map(c => [c.lat!, c.lng!] as [number, number]), [located]);

  return (
    <div className="relative z-0 isolate h-full w-full" data-testid="customer-map">
      <MapContainer center={VENEZUELA_CENTER} zoom={6} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} fitKey={fitKey} />
        <ClickToPlace active={editing !== null} onPlace={onPlace} />
        {located.map(c => (
          <Marker
            key={c.coCli}
            position={[c.lat!, c.lng!]}
            icon={pinIcon(c.pareto, c.coCli === selectedCoCli)}
            title={c.name}
            alt={`${c.name}, segmento ${c.pareto ?? 'sin ventas'}`}
            eventHandlers={{ click: () => onSelect(c.coCli), popupclose: () => onSelect(null) }}
          >
            <Popup>
              <CustomerPopup customer={c} routes={routes} onEditLocation={onEditLocation} />
            </Popup>
          </Marker>
        ))}
        {editing && editing.lat !== null && editing.lng !== null && (
          <Marker
            position={[editing.lat, editing.lng]}
            icon={editIcon()}
            draggable
            title="Ubicación nueva (arrastre para ajustar)"
            eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onPlace(p.lat, p.lng); } }}
          />
        )}
        {children}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 6: Write a minimal `mapa-client.tsx` (data loading + map only; Tasks 8–10 grow it)**

```tsx
// app/(app)/mapa/mapa-client.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MapPayload } from '@/lib/geo/types';
import { parseFilters, serializeFilters, normalizeFilters, applyFilters, type MapFilters } from '@/lib/geo/filters';
import CustomerMap from './components/customer-map';

export default function MapaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);

  // Only the period needs a server round-trip; every other filter is applied in memory.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/mapa/clientes?dateRange=${encodeURIComponent(filters.dateRange)}`)
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? 'Error al cargar el mapa');
        return body as MapPayload;
      })
      .then(p => { if (!cancelled) { setPayload(p); setFitKey(k => k + 1); } })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.dateRange]);

  const setFilters = useCallback((next: MapFilters) => {
    const normalized = normalizeFilters(next, payload?.routes ?? []);
    const qs = serializeFilters(normalized).toString();
    router.replace(qs ? `/mapa?${qs}` : '/mapa', { scroll: false });
  }, [payload, router]);

  const visible = useMemo(() => (payload ? applyFilters(payload.customers, filters) : []), [payload, filters]);

  return (
    <div className="flex h-full flex-col">
      {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="relative flex-1 min-h-[50vh]">
        <CustomerMap
          customers={visible}
          routes={payload?.routes ?? []}
          selectedCoCli={selected}
          onSelect={setSelected}
          onEditLocation={() => {}}
          fitKey={fitKey}
          editing={null}
          onPlace={() => {}}
        />
        {loading && <p role="status" className="absolute left-3 top-3 z-[500] rounded bg-white px-3 py-1 text-sm shadow">Cargando…</p>}
      </div>
    </div>
  );
}
```

(`setFilters` is wired into the UI in Task 8; if the linter flags it as unused, use `void setFilters` until then — do not delete it.)

- [ ] **Step 7: Verify in the browser**

Run: `bun dev`, log in as an admin, open `http://localhost:3000/mapa`.
Expected: map renders over Venezuela with a "Cargando…" status then no pins yet if no coordinates exist (all `campo1` empty today). To see pins, temporarily set one customer's coordinates by running Plan 1's `bun run geocode:customers --limit 3 --apply` **against a non-production ERP only**, or use Task 9's editor later. Confirm there are no console errors and that a `403`/redirect occurs for a user without the grant (`/mapa` → `/reports/ventas`).

- [ ] **Step 8: Type-check and commit**

Run: `bunx tsc --noEmit`
Expected: clean.

```bash
git add package.json bun.lock "app/(app)/mapa"
git commit -m "feat(mapa): /mapa page shell, Leaflet map, pins and popups

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Filter panel, chips, table view and unlocated list

**Files:**
- Create: `app/(app)/mapa/components/filter-panel.tsx`, `customer-table.tsx`, `unlocated-list.tsx`
- Modify: `app/(app)/mapa/mapa-client.tsx`

**Interfaces:**
- Consumes: `MapFilters`, `filterChips`, `FilterChip` (Task 6), `periodOptions` (Task 2), `SearchableSelect` (`@/lib/components/searchable-select`), `MapPayload`.
- Produces:
  ```ts
  export function FilterPanel(props: { filters: MapFilters; sellers: MapSeller[]; routes: RouteDto[]; onChange: (f: MapFilters) => void; onFit: () => void; counts: { shown: number; total: number } }): JSX.Element;
  export function CustomerTable(props: { customers: MapCustomer[]; onSelect: (coCli: string) => void }): JSX.Element;
  export function UnlocatedList(props: { customers: MapCustomer[]; onLocate: (coCli: string) => void }): JSX.Element;
  ```

- [ ] **Step 1: Write `filter-panel.tsx`**

```tsx
// app/(app)/mapa/components/filter-panel.tsx
'use client';

import SearchableSelect from '@/lib/components/searchable-select';
import { periodOptions } from '@/lib/geo/date-range';
import { filterChips, type MapFilters } from '@/lib/geo/filters';
import type { MapSeller, Pareto, RouteDto } from '@/lib/geo/types';

interface Props {
  filters: MapFilters;
  sellers: MapSeller[];
  routes: RouteDto[];
  onChange: (f: MapFilters) => void;
  onFit: () => void;
  counts: { shown: number; total: number };
}

const fieldLabel = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600';
const controlClass = 'min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function FilterPanel({ filters, sellers, routes, onChange, onFit, counts }: Props) {
  const chips = filterChips(filters, { sellers, routes });
  const visibleRoutes = filters.seller ? routes.filter(r => r.sellerCode === filters.seller) : routes;

  function clear(key: (typeof chips)[number]['key']) {
    const next = { ...filters };
    if (key === 'dateRange') next.dateRange = periodOptions()[1].value; // previous month (index 0 is the current month)
    if (key === 'seller') next.seller = null;
    if (key === 'route') next.route = null;
    if (key === 'pareto') next.pareto = null;
    if (key === 'noCoords') next.noCoords = false;
    onChange(next);
  }

  return (
    <section aria-label="Filtros" className="space-y-4 p-4">
      <div>
        <label htmlFor="mapa-periodo" className={fieldLabel}>Período</label>
        <select
          id="mapa-periodo"
          className={controlClass}
          value={filters.dateRange}
          onChange={e => onChange({ ...filters, dateRange: e.target.value })}
        >
          {periodOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <span className={fieldLabel}>Vendedor</span>
        <SearchableSelect
          value={filters.seller}
          onChange={seller => onChange({ ...filters, seller })}
          options={sellers.map(s => ({ value: s.code, label: s.name }))}
          placeholder="Buscar vendedor…"
          allLabel="Todos los vendedores"
        />
      </div>

      <div>
        <span className={fieldLabel}>Ruta</span>
        <SearchableSelect
          value={filters.route === null ? null : String(filters.route)}
          onChange={v => onChange({ ...filters, route: v === null ? null : Number(v) })}
          options={visibleRoutes.map(r => ({ value: String(r.id), label: r.name }))}
          placeholder="Buscar ruta…"
          allLabel="Todas las rutas"
        />
      </div>

      <div>
        <label htmlFor="mapa-segmento" className={fieldLabel}>Segmento (Pareto)</label>
        <select
          id="mapa-segmento"
          className={controlClass}
          value={filters.pareto ?? ''}
          onChange={e => onChange({ ...filters, pareto: (e.target.value || null) as Pareto | null })}
        >
          <option value="">Todos</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={filters.noCoords}
          onChange={e => onChange({ ...filters, noCoords: e.target.checked })}
        />
        Solo clientes sin coordenadas
      </label>

      {chips.length > 0 && (
        <ul aria-label="Filtros activos" className="flex flex-wrap gap-2">
          {chips.map(chip => (
            <li key={chip.key} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-xs text-blue-900">
              {chip.label}
              <button
                type="button"
                onClick={() => clear(chip.key)}
                aria-label={`Quitar filtro ${chip.label}`}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600" aria-live="polite">{counts.shown} de {counts.total} clientes</p>
        <button type="button" onClick={onFit} className="min-h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          Ajustar al resultado
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `customer-table.tsx` (the keyboard / screen-reader fallback and export-ready view)**

```tsx
// app/(app)/mapa/components/customer-table.tsx
'use client';

import { useMemo, useState } from 'react';
import type { MapCustomer } from '@/lib/geo/types';

type SortKey = 'name' | 'revenueUsd' | 'pareto' | 'seller';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const ISSUE_TEXT: Record<NonNullable<MapCustomer['coordinatesIssue']>, string> = {
  UNPARSEABLE: 'campo1 con formato inválido',
  SWAPPED_SUSPECTED: 'lat/lng invertidas',
  OUT_OF_RANGE: 'fuera de Venezuela',
};

export function CustomerTable({ customers, onSelect }: { customers: MapCustomer[]; onSelect: (coCli: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'revenueUsd', dir: -1 });

  const rows = useMemo(() => {
    const val = (c: MapCustomer) =>
      sort.key === 'name' ? c.name : sort.key === 'pareto' ? c.pareto ?? 'Z' : sort.key === 'seller' ? c.sellerName ?? c.coVen : c.revenueUsd ?? -1;
    return [...customers].sort((a, b) => {
      const [x, y] = [val(a), val(b)];
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * sort.dir;
    });
  }, [customers, sort]);

  function header(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
        <button type="button" className="min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
          {label}{active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
        </button>
      </th>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <table className="min-w-full text-sm" aria-label="Clientes">
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            {header('name', 'Cliente')}
            {header('seller', 'Vendedor')}
            {header('revenueUsd', 'Ingresos (USD)')}
            {header('pareto', 'Segmento')}
            <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Ubicación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(c => (
            <tr key={c.coCli} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <button type="button" className="min-h-11 text-left font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => onSelect(c.coCli)}>
                  {c.name}
                </button>
                <span className="block text-xs text-gray-500">{c.coCli}</span>
              </td>
              <td className="px-3 py-2">{c.sellerName ?? c.coVen}</td>
              <td className="px-3 py-2 tabular-nums">{c.revenueUsd === null ? 'Sin tasa' : usd.format(c.revenueUsd)}</td>
              <td className="px-3 py-2">{c.pareto ?? '—'}</td>
              <td className="px-3 py-2">
                {c.lat !== null ? `${c.lat.toFixed(5)}, ${c.lng!.toFixed(5)}` : (
                  <span className="text-amber-800">{c.coordinatesIssue ? ISSUE_TEXT[c.coordinatesIssue] : 'Sin coordenadas'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Ningún cliente coincide con los filtros.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write `unlocated-list.tsx`**

```tsx
// app/(app)/mapa/components/unlocated-list.tsx
'use client';

import type { MapCustomer } from '@/lib/geo/types';

const REASON: Record<NonNullable<MapCustomer['coordinatesIssue']>, string> = {
  UNPARSEABLE: 'campo1 con formato inválido', SWAPPED_SUSPECTED: 'lat/lng invertidas', OUT_OF_RANGE: 'fuera de Venezuela',
};

export function UnlocatedList({ customers, onLocate }: { customers: MapCustomer[]; onLocate: (coCli: string) => void }) {
  if (customers.length === 0) return <p className="p-4 text-sm text-gray-500">Todos los clientes tienen ubicación.</p>;
  return (
    <ul aria-label="Clientes sin ubicación" className="divide-y divide-gray-100">
      {customers.map(c => (
        <li key={c.coCli} className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
            <p className="truncate text-xs text-gray-500">{c.coordinatesIssue ? REASON[c.coordinatesIssue] : (c.dirEnt2 ?? c.direc1 ?? 'Sin dirección')}</p>
          </div>
          <button type="button" onClick={() => onLocate(c.coCli)} className="min-h-11 shrink-0 rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            Ubicar
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Rewire `mapa-client.tsx` into the final layout**

Replace the returned JSX of `MapaClient` (keep the effect/hooks from Task 7) with a left filter panel, the map/table area with a view toggle, and a right panel with a tab strip (Sin coordenadas now; Rutas added in Task 10; Plan 3 adds Zonas/Discrepancias):

```tsx
  const [view, setView] = useState<'map' | 'table'>('map');
  const [rightTab, setRightTab] = useState<'unlocated'>('unlocated');
  const sellers = payload?.sellers ?? [];
  const routes = payload?.routes ?? [];
  const unlocated = useMemo(() => (payload ? payload.customers.filter(c => c.lat === null) : []), [payload]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="max-h-[40vh] w-full shrink-0 overflow-auto border-b border-gray-200 bg-white md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <FilterPanel
          filters={filters}
          sellers={sellers}
          routes={routes}
          onChange={setFilters}
          onFit={() => setFitKey(k => k + 1)}
          counts={{ shown: visible.length, total: payload?.customers.length ?? 0 }}
        />
      </aside>

      <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col">
        {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2" role="group" aria-label="Vista">
          {(['map', 'table'] as const).map(v => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-md px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${view === v ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {v === 'map' ? 'Mapa' : 'Tabla'}
            </button>
          ))}
          {loading && <span role="status" className="ml-auto text-sm text-gray-500">Cargando…</span>}
        </div>
        <div className="relative min-h-0 flex-1">
          {view === 'map' ? (
            <CustomerMap
              customers={visible}
              routes={routes}
              selectedCoCli={selected}
              onSelect={setSelected}
              onEditLocation={() => {}}
              fitKey={fitKey}
              editing={null}
              onPlace={() => {}}
            />
          ) : (
            <CustomerTable customers={visible} onSelect={c => { setSelected(c); setView('map'); }} />
          )}
        </div>
      </div>

      <aside className="max-h-[40vh] w-full shrink-0 overflow-auto border-t border-gray-200 bg-white md:max-h-none md:w-72 md:border-l md:border-t-0">
        <div role="tablist" aria-label="Paneles" className="flex border-b border-gray-200">
          <button role="tab" aria-selected={rightTab === 'unlocated'} className="min-h-11 flex-1 px-3 text-sm font-medium text-blue-700">
            Sin ubicación ({unlocated.length})
          </button>
        </div>
        <UnlocatedList customers={unlocated} onLocate={() => {}} />
      </aside>
    </div>
  );
```

Add the imports for `FilterPanel`, `CustomerTable`, `UnlocatedList`. Layout note (differs from the spec's "bottom sheet" wording): below `md` the panels simply stack above/below the map (each ≤ 40vh, scrollable) and the map keeps ≥ 50vh — same intent, far simpler and fully accessible. Update the spec's UX sentence accordingly in Task 11.

- [ ] **Step 5: Verify in the browser and commit**

Run: `bun dev`; on `/mapa`: change period (URL updates, data reloads), pick a seller (chip appears, count updates), clear via the chip's ×, toggle Tabla (sortable, unlocated rows show their reason), reload the page with filters in the URL (state restored), and shrink the window below 768px (panels stack, map ≥ half height). `bunx tsc --noEmit` clean.

```bash
git add "app/(app)/mapa"
git commit -m "feat(mapa): filter panel with chips, table view, unlocated list

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Location editor (coordinates + delivery address → ERP)

**Files:**
- Create: `app/(app)/mapa/components/location-editor.tsx`
- Modify: `app/(app)/mapa/mapa-client.tsx`

**Interfaces:**
- Consumes: `PATCH /api/mapa/clientes/[co_cli]/ubicacion` (Task 5), `CustomerMap`'s `editing`/`onPlace`/`onEditLocation` props (Task 7), `MapCustomer`.
- Produces:
  ```ts
  export interface EditDraft { coCli: string; lat: string; lng: string; dirEnt2: string; saving: boolean; errors: { coordinates?: string; dirEnt2?: string; form?: string } }
  export function LocationEditor(props: { customer: MapCustomer; draft: EditDraft; onChange: (patch: Partial<EditDraft>) => void; onSave: () => void; onCancel: () => void }): JSX.Element;
  ```

- [ ] **Step 1: Write `location-editor.tsx`**

```tsx
// app/(app)/mapa/components/location-editor.tsx
'use client';

import type { MapCustomer } from '@/lib/geo/types';

export interface EditDraft {
  coCli: string;
  lat: string;
  lng: string;
  dirEnt2: string;
  saving: boolean;
  errors: { coordinates?: string; dirEnt2?: string; form?: string };
}

interface Props {
  customer: MapCustomer;
  draft: EditDraft;
  onChange: (patch: Partial<EditDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const input = 'min-h-11 w-full rounded-md border bg-white px-3 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function LocationEditor({ customer, draft, onChange, onSave, onCancel }: Props) {
  return (
    <form
      aria-label={`Editar ubicación de ${customer.name}`}
      onSubmit={e => { e.preventDefault(); onSave(); }}
      className="space-y-3 border-b border-blue-200 bg-blue-50 p-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{customer.name}</h2>
        <p className="text-xs text-gray-600">Haga clic en el mapa o arrastre el marcador azul para colocar el punto.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="loc-lat" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Latitud</label>
          <input id="loc-lat" inputMode="decimal" className={`${input} ${draft.errors.coordinates ? 'border-red-500' : 'border-gray-300'}`}
            value={draft.lat} onChange={e => onChange({ lat: e.target.value })} aria-describedby="loc-coord-err" aria-invalid={Boolean(draft.errors.coordinates)} />
        </div>
        <div>
          <label htmlFor="loc-lng" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Longitud</label>
          <input id="loc-lng" inputMode="decimal" className={`${input} ${draft.errors.coordinates ? 'border-red-500' : 'border-gray-300'}`}
            value={draft.lng} onChange={e => onChange({ lng: e.target.value })} aria-describedby="loc-coord-err" aria-invalid={Boolean(draft.errors.coordinates)} />
        </div>
      </div>
      <p id="loc-coord-err" role={draft.errors.coordinates ? 'alert' : undefined} className="text-xs text-red-700">{draft.errors.coordinates}</p>

      <div>
        <label htmlFor="loc-dir" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Dirección de entrega</label>
        <textarea id="loc-dir" rows={3} className={`${input} py-2 ${draft.errors.dirEnt2 ? 'border-red-500' : 'border-gray-300'}`}
          value={draft.dirEnt2} onChange={e => onChange({ dirEnt2: e.target.value })} aria-describedby="loc-dir-err" aria-invalid={Boolean(draft.errors.dirEnt2)} />
        <p id="loc-dir-err" role={draft.errors.dirEnt2 ? 'alert' : undefined} className="mt-1 text-xs text-red-700">{draft.errors.dirEnt2}</p>
      </div>

      {draft.errors.form && <p role="alert" className="text-sm text-red-700">{draft.errors.form}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={draft.saving}
          className="min-h-11 flex-1 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          {draft.saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} disabled={draft.saving}
          className="min-h-11 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire editing into `mapa-client.tsx`**

Add state and handlers (alongside the existing hooks):

```tsx
  const [draft, setDraft] = useState<EditDraft | null>(null);

  const startEditing = useCallback((coCli: string) => {
    const c = payload?.customers.find(x => x.coCli === coCli);
    if (!c) return;
    setView('map');
    setDraft({
      coCli, lat: c.lat === null ? '' : String(c.lat), lng: c.lng === null ? '' : String(c.lng),
      dirEnt2: c.dirEnt2 ?? c.direc1 ?? '', saving: false, errors: {},
    });
  }, [payload]);

  const place = useCallback((lat: number, lng: number) => {
    setDraft(d => (d ? { ...d, lat: lat.toFixed(6), lng: lng.toFixed(6), errors: { ...d.errors, coordinates: undefined } } : d));
  }, []);

  const editingCustomer = draft ? payload?.customers.find(c => c.coCli === draft.coCli) ?? null : null;
  const editingPosition = draft && Number.isFinite(parseFloat(draft.lat)) && Number.isFinite(parseFloat(draft.lng))
    ? { lat: parseFloat(draft.lat), lng: parseFloat(draft.lng) } : draft ? { lat: null, lng: null } : null;

  async function saveLocation() {
    if (!draft || !editingCustomer) return;
    const body: Record<string, unknown> = {};
    const lat = parseFloat(draft.lat), lng = parseFloat(draft.lng);
    const hasCoords = draft.lat.trim() !== '' || draft.lng.trim() !== '';
    if (hasCoords) { body.lat = Number.isFinite(lat) ? lat : draft.lat; body.lng = Number.isFinite(lng) ? lng : draft.lng; }
    const address = draft.dirEnt2.trim();
    if (address && address !== (editingCustomer.dirEnt2 ?? editingCustomer.direc1 ?? '')) body.dirEnt2 = address;
    if (Object.keys(body).length === 0) { setDraft({ ...draft, errors: { form: 'No hay cambios para guardar' } }); return; }

    setDraft({ ...draft, saving: true, errors: {} });
    const res = await fetch(`/api/mapa/clientes/${encodeURIComponent(draft.coCli)}/ubicacion`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.error ?? 'Error al guardar';
      setDraft(d => d && ({
        ...d, saving: false,
        errors: json?.field === 'coordinates' ? { coordinates: message } : json?.field === 'dirEnt2' ? { dirEnt2: message } : { form: message },
      }));
      return;
    }
    setPayload(p => p && ({
      ...p,
      customers: p.customers.map(c => c.coCli !== draft.coCli ? c : {
        ...c,
        ...(json.coordinates ? { lat: json.coordinates.lat, lng: json.coordinates.lng, coordinatesIssue: null } : {}),
        ...(json.dirEnt2 ? { dirEnt2: json.dirEnt2 } : {}),
      }),
    }));
    setDraft(null);
  }
```

Render the editor above the right-panel tabs: `{draft && editingCustomer && <LocationEditor customer={editingCustomer} draft={draft} onChange={patch => setDraft(d => d && { ...d, ...patch })} onSave={saveLocation} onCancel={() => setDraft(null)} />}`. Pass `onEditLocation={startEditing}`, `editing={editingPosition}`, `onPlace={place}` to `CustomerMap`, and `onLocate={startEditing}` to `UnlocatedList`. Import `LocationEditor` and `EditDraft`.

Notes the implementer must keep: the customer being edited stays in `visible` only if it passes filters — if the user placed a customer from the "Sin ubicación" list while `noCoords` is off, the pin appears after saving (it now has coordinates). Pressing Escape while editing cancels (add a `keydown` listener in an effect that calls `setDraft(null)` when `draft` is set).

- [ ] **Step 3: Verify in the browser (non-production ERP only) and commit**

Run `bun dev`; on `/mapa` click "Ubicar" for an unlocated customer, click the map → lat/lng fill; Guardar → the pin appears, the customer leaves the unlocated list; in SSMS/one-off query confirm `campo1` = `Coordenadas: (…)` and `co_us_mo = 'PROFIT'`. Then try lat/lng swapped (e.g. `-66.9` / `10.5`): expect the inline "invertidas" message and no write. Try only latitude: expect "Indique latitud y longitud". Revert the test customer's `campo1` afterwards.
`bunx tsc --noEmit` clean.

```bash
git add "app/(app)/mapa"
git commit -m "feat(mapa): edit customer coordinates and delivery address

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Routes panel (create, assign customers, delete)

**Files:**
- Create: `app/(app)/mapa/components/routes-panel.tsx`
- Modify: `app/(app)/mapa/mapa-client.tsx`

**Interfaces:**
- Consumes: `/api/mapa/rutas` endpoints (Task 5), `Modal` (`@/components/modal`), `SearchableSelect`, `RouteDto`, `MapSeller`, `MapCustomer`.
- Produces:
  ```ts
  export function RoutesPanel(props: {
    routes: RouteDto[]; sellers: MapSeller[]; customers: MapCustomer[];   // customers = ALL customers (unfiltered)
    sellerFilter: string | null;
    onRoutesChanged: (next: RouteDto[]) => void;
    onShowRoute: (routeId: number) => void;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write `routes-panel.tsx`**

```tsx
// app/(app)/mapa/components/routes-panel.tsx
'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { MapCustomer, MapSeller, RouteDto } from '@/lib/geo/types';

interface Props {
  routes: RouteDto[];
  sellers: MapSeller[];
  customers: MapCustomer[];
  sellerFilter: string | null;
  onRoutesChanged: (next: RouteDto[]) => void;
  onShowRoute: (routeId: number) => void;
}

const btn = 'min-h-11 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: any }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, json: await res.json().catch(() => null) };
}

export function RoutesPanel({ routes, sellers, customers, sellerFilter, onRoutesChanged, onShowRoute }: Props) {
  const [name, setName] = useState('');
  const [sellerCode, setSellerCode] = useState<string | null>(sellerFilter);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RouteDto | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<RouteDto | null>(null);

  const shown = sellerFilter ? routes.filter(r => r.sellerCode === sellerFilter) : routes;
  const sellerName = (code: string) => sellers.find(s => s.code === code)?.name ?? code;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const seller = sellerCode ?? sellerFilter;
    if (!seller) { setError('Seleccione un vendedor'); return; }
    const { ok, json } = await call('/api/mapa/rutas', 'POST', { name, sellerCode: seller });
    if (!ok) { setError(json?.error ?? 'Error al crear la ruta'); return; }
    setError(null); setName('');
    onRoutesChanged([...routes, json.item]);
  }

  function openEditor(route: RouteDto) {
    setEditing(route); setSelection(new Set(route.customerCodes)); setQuery('');
  }

  async function saveMembers() {
    if (!editing) return;
    const { ok, json } = await call(`/api/mapa/rutas/${editing.id}`, 'PATCH', { customerCodes: [...selection] });
    if (!ok) { setError(json?.error ?? 'Error al guardar la ruta'); return; }
    setError(null);
    onRoutesChanged(routes.map(r => (r.id === editing.id ? json.item : r)));
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { ok, json } = await call(`/api/mapa/rutas/${deleting.id}`, 'DELETE');
    if (!ok) { setError(json?.error ?? 'Error al eliminar la ruta'); setDeleting(null); return; }
    onRoutesChanged(routes.filter(r => r.id !== deleting.id));
    setDeleting(null);
  }

  // Customers of the route's seller first; the checklist can still add anyone.
  const candidates = useMemo(() => {
    if (!editing) return [];
    const q = query.trim().toLowerCase();
    return customers
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.coCli.toLowerCase().includes(q))
      .sort((a, b) => Number(b.coVen === editing.sellerCode) - Number(a.coVen === editing.sellerCode) || a.name.localeCompare(b.name, 'es'));
  }, [customers, editing, query]);

  return (
    <section aria-label="Rutas" className="space-y-4 p-4">
      <form onSubmit={create} className="space-y-2">
        <label htmlFor="route-name" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nueva ruta</label>
        <input id="route-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Ruta Lunes Norte"
          className="min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
        <SearchableSelect
          value={sellerCode ?? sellerFilter}
          onChange={setSellerCode}
          options={sellers.map(s => ({ value: s.code, label: s.name }))}
          placeholder="Vendedor…"
          allLabel="Seleccione vendedor"
        />
        <button type="submit" className={`${btn} w-full border-blue-600 bg-blue-600 font-medium text-white hover:bg-blue-700`}>Crear ruta</button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {shown.length === 0 ? <p className="text-sm text-gray-500">No hay rutas{sellerFilter ? ' para este vendedor' : ''}.</p> : (
        <ul className="divide-y divide-gray-100" aria-label="Rutas existentes">
          {shown.map(r => (
            <li key={r.id} className="space-y-2 py-3">
              <p className="text-sm font-medium text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-500">{sellerName(r.sellerCode)} · {r.customerCodes.length} clientes</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${btn} border-gray-300 hover:bg-gray-50`} onClick={() => onShowRoute(r.id)}>Ver en mapa</button>
                <button type="button" className={`${btn} border-gray-300 hover:bg-gray-50`} onClick={() => openEditor(r)}>Clientes</button>
                <button type="button" className={`${btn} border-red-300 text-red-700 hover:bg-red-50`} onClick={() => setDeleting(r)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title={`Clientes de ${editing.name}`} onClose={() => setEditing(null)}>
          <input aria-label="Buscar cliente" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente…"
            className="mb-3 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
          <ul className="max-h-72 divide-y divide-gray-100 overflow-auto" aria-label="Clientes">
            {candidates.map(c => (
              <li key={c.coCli}>
                <label className="flex min-h-11 items-center gap-3 text-sm text-gray-800">
                  <input type="checkbox" className="h-4 w-4" checked={selection.has(c.coCli)}
                    onChange={e => setSelection(s => { const n = new Set(s); e.target.checked ? n.add(c.coCli) : n.delete(c.coCli); return n; })} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.sellerName ?? c.coVen}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={`${btn} border-gray-300`} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="button" className={`${btn} border-blue-600 bg-blue-600 font-medium text-white`} onClick={saveMembers}>Guardar ({selection.size})</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Eliminar ruta" onClose={() => setDeleting(null)}>
          <p className="text-sm text-gray-700">¿Eliminar la ruta «{deleting.name}»? Los clientes no se eliminan.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={`${btn} border-gray-300`} onClick={() => setDeleting(null)}>Cancelar</button>
            <button type="button" className={`${btn} border-red-600 bg-red-600 font-medium text-white`} onClick={confirmDelete}>Eliminar</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount it as the second right-panel tab in `mapa-client.tsx`**

Change `rightTab` to `'unlocated' | 'routes'`; render two `role="tab"` buttons (`Sin ubicación (N)` and `Rutas (N)`) that set it, and render `UnlocatedList` or `<RoutesPanel routes={routes} sellers={sellers} customers={payload?.customers ?? []} sellerFilter={filters.seller} onRoutesChanged={next => setPayload(p => p && ({ ...p, routes: next, customers: p.customers.map(c => ({ ...c, routeIds: next.filter(r => r.customerCodes.includes(c.coCli)).map(r => r.id) })) }))} onShowRoute={id => { setFilters({ ...filters, route: id }); setFitKey(k => k + 1); }} />`. (Recomputing `routeIds` locally keeps pins, popups and the route filter consistent without refetching revenue.)

- [ ] **Step 3: Verify in the browser and commit**

Run `bun dev`; on `/mapa` → Rutas tab: create a route for a seller, duplicate name for the same seller → inline "Ya existe…" (409), open Clientes, tick a few, Guardar → count updates and the route filter now narrows the map, "Ver en mapa" sets `?route=` and refits, Eliminar → confirm modal appears **above** the map (z-order), route disappears and the filter chip clears. `bunx tsc --noEmit` clean.

```bash
git add "app/(app)/mapa"
git commit -m "feat(mapa): routes panel (create, assign customers, delete)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: E2E, docs, final verification

**Files:**
- Create: `e2e/mapa.spec.ts`
- Modify: `AGENTS.md`, `docs/superpowers/specs/2026-09-30-customer-map-design.md`

- [ ] **Step 1: Write the e2e spec**

```ts
// e2e/mapa.spec.ts
import { test, expect } from './fixtures';

test.describe('mapa access', () => {
  test('a user without the geo grant is redirected away from /mapa', async ({ userPage }) => {
    await userPage.goto('/mapa');
    await expect(userPage).toHaveURL(/\/reports\/ventas/);
  });

  test('a user without the geo grant gets 403 from the API', async ({ userPage }) => {
    const res = await userPage.request.get('/api/mapa/clientes');
    expect(res.status()).toBe(403);
  });

  test('admin sees the Mapa de Clientes link', async ({ adminPage }) => {
    await expect(adminPage.getByRole('link', { name: 'Mapa de Clientes' })).toBeVisible();
  });
});

// @mssql — needs the ERP mock + DWH loaded (see e2e/analitica.spec.ts header).
test.describe('mapa @mssql', () => {
  test('loads, filters are URL-synced, and the table view toggles', async ({ adminPage }) => {
    await adminPage.goto('/mapa');
    await expect(adminPage.getByTestId('customer-map')).toBeVisible({ timeout: 20_000 });

    await adminPage.getByLabel('Segmento (Pareto)').selectOption('A');
    await expect(adminPage).toHaveURL(/pareto=A/);
    await expect(adminPage.getByRole('list', { name: 'Filtros activos' }).getByText('Segmento: A')).toBeVisible();

    await adminPage.getByRole('button', { name: 'Tabla' }).click();
    await expect(adminPage.getByRole('table', { name: 'Clientes' })).toBeVisible();

    await adminPage.getByRole('button', { name: /Quitar filtro Segmento: A/ }).click();
    await expect(adminPage).not.toHaveURL(/pareto=/);
  });

  test('create and delete a route', async ({ adminPage }) => {
    const routeName = `E2E Ruta ${Date.now()}`;   // unique, so a failed earlier run cannot cause a 409
    await adminPage.goto('/mapa');
    await adminPage.getByRole('tab', { name: /Rutas/ }).click();

    const panel = adminPage.getByRole('region', { name: 'Rutas' });
    await panel.getByLabel('Nueva ruta').fill(routeName);
    await panel.getByPlaceholder('Vendedor…').click();
    // SearchableSelect renders the "Seleccione vendedor" reset option first, then one button per seller.
    await panel.locator('form ul li button').nth(1).click();
    await panel.getByRole('button', { name: 'Crear ruta' }).click();

    const list = adminPage.getByRole('list', { name: 'Rutas existentes' });
    await expect(list.getByText(routeName)).toBeVisible();

    await list.locator('li', { hasText: routeName }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Eliminar ruta' })).toBeVisible();   // modal sits above the map
    await adminPage.locator('div.fixed.inset-0').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(list.getByText(routeName)).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e spec**

Run: `bun run e2e:seed && bun run e2e -- e2e/mapa.spec.ts` (default run excludes `@mssql`; with the ERP mock up also run `bun run e2e:mssql -- e2e/mapa.spec.ts`). `SQLITE_PATH` must be pinned to `e2e/.tmp` (see dev-DB-wipe note).
Expected: the three access tests PASS; the `@mssql` tests PASS when the mock is available.

- [ ] **Step 3: Update `AGENTS.md`**

1. "Module-Based Permissions": replace "Two modules exist today: `'inventory'` and `'dwh'`…" with "Modules today: `'inventory'`, `'dwh'` (gates `/analitica`), `'geo'` (gates `/mapa`), plus `'pricing_view'`/`'pricing_edit'` (see `lib/pricing/access.ts`)." and mention `lib/geo/access.ts` (`hasGeoAccess`, `requireGeoAccess`).
2. Directory Map: add `lib/geo/*` entries for `types`, `pareto`, `merge`, `map-data`, `filters`, `routes-repo`, `route-validation`, `location-patch`, `date-range`; `app/(app)/mapa/` ("customer map, gated on `'geo'`"); `app/api/mapa/`.
3. Add a short "Customer Map (`/mapa`)" section: coordinates live in `saCliente.campo1` as `Coordenadas: (lat, lng)` (parse/format only via `lib/geo/coordinates.ts`); routes are SQLite (`routes`, `route_customers`); `GET /api/mapa/clientes` is the one route that merges live ERP + DWH data in TypeScript; Pareto uses the same thresholds as the analytics Clientes tab.

- [ ] **Step 4: Amend the spec**

In `docs/superpowers/specs/2026-09-30-customer-map-design.md`, UX requirements → Layout: replace "on narrow screens panels collapse to bottom sheets" with "below `md` the panels stack above/below the map (each ≤ 40vh, scrollable) and the map keeps ≥ 50vh".

- [ ] **Step 5: Full verification**

Run: `bunx tsc --noEmit && bun run lint && bun run test:unit`
Expected: no type errors, no new lint errors, all unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add e2e/mapa.spec.ts AGENTS.md docs/superpowers/specs/2026-09-30-customer-map-design.md
git commit -m "test(mapa): e2e access + flows; docs: /mapa module in AGENTS.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (done by plan author)

- **Spec coverage (Section 2 + 'geo' access):** module gate on page and API → Tasks 1, 5, 7; ERP/DWH merge → Tasks 3, 5; Pareto + USD conversion consistent with analytics → Tasks 2, 3; pins/popup → Task 7; filters (period, seller, route, segment, no-coordinates) + chips + URL sync → Tasks 6, 8; table fallback + unlocated list → Task 8; location editing with field errors → Tasks 5, 9; routes CRUD + membership + route filter + delete modal → Tasks 4, 5, 10; e2e/docs → Task 11. Sales areas, heat/choropleth layers, mismatch flag → Plan 3 (the `children` slot on `CustomerMap` and the right-panel tab strip are the extension points).
- **Placeholders:** none; the one place the plan tells the implementer to read a file (`SearchableSelect`'s DOM for the e2e seller pick) names exactly what to look for.
- **Type consistency:** `MapCustomer`, `MapPayload`, `RouteDto`, `MapFilters`, `EditDraft`, `CustomerMapProps` are defined once and reused with identical names; `requireGeoAccess` is the only API guard; `updateCustomerLocation` signature matches Plan 1.
- **Review Focus coverage:** bad `campo1` never plotted → Task 3 tests; revenue without ERP match / no revenue → Task 3 tests; SCD2 + padded codes → `fetchRevenue` groups by `RTRIM` and `mergeCustomers` re-sums by trimmed code (Task 3); seller/route filter clearing → Task 6 tests; duplicate route name → Task 4 tests + 409 in Task 5; invalid coordinates on save → Task 5 tests; `dateRange` garbage → Task 2 tests + 400 in Task 5; 401/403 → Task 5 auth test + Task 11 e2e; cascade delete → Task 4 test.
