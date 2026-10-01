# Customer Map — Plan 1 of 3: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Series:** Plan 1 of 3 — `customer-map-1-foundations` → `customer-map-2-map-and-routes` → `customer-map-3-sales-areas`.
> **Depends on:** nothing (first in the series).
> **Blocks:** Plan 2 (needs `lib/geo/coordinates.ts`, `lib/geo/erp-location.ts`, the `pApiActualizarUbicacionCliente` procedure) and Plan 3 (transitively). Do not start Plan 2 until every task here is merged to `main`.

**Goal:** Ship the building blocks the map needs: a validated coordinate syntax stored in `saCliente.campo1`, an ERP stored procedure that writes it, a geocoding script that pre-fills it, and removal of the dead "Rutas y Logística" analytics tab.

**Architecture:** Pure coordinate parse/validate/format functions in `lib/geo/`; a thin typed wrapper around a new app-owned ERP stored procedure (same convention as `pApiCrearAjusteInventario`); a provider-agnostic geocoder (Nominatim → Google fallback) with injectable `fetch` so it is unit-testable offline; a dry-run-by-default CLI script on top.

**Tech Stack:** Bun, TypeScript, `mssql`, `bun:test`, Next.js 16 (only for the tab removal).

**Spec:** `docs/superpowers/specs/2026-09-30-customer-map-design.md`

## Global Constraints

- Coordinate syntax is exactly `Coordenadas: (lat, lng)` — **latitude first**, canonical form uses 6 decimals, dot as decimal separator, e.g. `Coordenadas: (10.480600, -66.903600)`.
- Coordinates live in `saCliente.campo1` (`varchar(60)`; all of `campo1`…`campo8` are empty today). Delivery address lives in `saCliente.dir_ent2` (`varchar(max)`).
- Venezuela bounding box for validation: lat 0.6–12.3, lng −73.4 to −59.8.
- The app never runs a raw `UPDATE` on `saCliente` for this feature — only through `pApiActualizarUbicacionCliente`.
- `saCliente` audit columns: `co_us_mo CHAR(6) NOT NULL`, `fe_us_mo DATETIME NOT NULL`, `co_sucu_mo CHAR(6) NULL` (verified live). The app's ERP user code is `'PROFIT'` (same constant as `app/api/inventory/adjustments/route.ts`).
- ERP `mssql` queries use `.input()` for every value; error responses are `{ error: string }`.
- Unit tests live in `__tests__/unit/geo/`. Run with `bun test --isolate --env-file=.env.local __tests__/unit/geo/<file>`.
- Tests that write to the ERP must never run against production Profit Plus (see `AGENTS.md` → Testing Notes).

## Review Focus

- `campo1` already holds hand-typed text in some other installation (e.g. `"Coordenadas : ( 10.5 ,-66.9 )"` with odd spacing, or an unrelated note): the parser must accept the spaced variant and return `null` (never throw) for unrelated text.
- A customer whose `campo1` is char-padded or `NULL`: parse must treat both as "no coordinates".
- A geocoder hit that lands outside Venezuela (OSM returning a same-named street in another country): must be discarded, not written.
- Lat/lng swapped by a human or provider: rejected as `SWAPPED_SUSPECTED`, never silently corrected.
- Google returns HTTP 200 with `status: "REQUEST_DENIED"` / `OVER_QUERY_LIMIT`: must surface as an error, not as "no result".
- A customer with neither `dir_ent2` nor `direc1` text: skipped and listed, no provider call made.
- `--apply` re-run: customers already written are skipped (idempotent).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/geo/coordinates.ts` | Pure: `parseCoordinates`, `validateCoordinates`, `formatCoordinates`, `VENEZUELA_BOUNDS` |
| `lib/geo/erp-location.ts` | `updateCustomerLocation(pool, update)` — calls the ERP procedure |
| `migrations/mssql/0008_pApiActualizarUbicacionCliente.sql` | The ERP procedure |
| `lib/geo/geocoding.ts` | `normalizeAddress`, `geocodeNominatim`, `geocodeGoogle`, `geocodeAddress` |
| `lib/geo/geocode-cli.ts` | `parseGeocodeArgs`, `pickAddress` (pure CLI helpers) |
| `scripts/geocode-customers.ts` | The CLI script |
| `__tests__/unit/geo/*.test.ts` | Unit tests |
| `__tests__/integration/ubicacion-cliente.integration.test.ts` | ERP procedure test (writes to ERP, restores) |
| `app/(app)/analitica/analitica-client.tsx`, `app/(app)/analitica/tabs/tab-stub.tsx` | Rutas tab removal |
| `AGENTS.md`, spec | Docs |

---

### Task 1: Coordinate parse / validate / format

**Files:**
- Create: `lib/geo/coordinates.ts`
- Test: `__tests__/unit/geo/coordinates.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LatLng { lat: number; lng: number }
  export const VENEZUELA_BOUNDS: { latMin: 0.6; latMax: 12.3; lngMin: -73.4; lngMax: -59.8 };
  export type CoordinateError = 'OUT_OF_RANGE' | 'SWAPPED_SUSPECTED';
  export type CoordinateValidation = { ok: true } | { ok: false; error: CoordinateError };
  export function parseCoordinates(raw: string | null | undefined): LatLng | null;
  export function validateCoordinates(c: LatLng): CoordinateValidation;
  export function formatCoordinates(c: LatLng): string;
  export function coordinateErrorMessage(error: CoordinateError): string;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/coordinates.test.ts
import { describe, test, expect } from 'bun:test';
import {
  parseCoordinates, validateCoordinates, formatCoordinates, coordinateErrorMessage,
} from '@/lib/geo/coordinates';

describe('parseCoordinates', () => {
  test('parses the canonical form', () => {
    expect(parseCoordinates('Coordenadas: (10.4806, -66.9036)')).toEqual({ lat: 10.4806, lng: -66.9036 });
  });
  test('tolerates odd spacing, case, and char() padding', () => {
    expect(parseCoordinates('  coordenadas :( 10.5 ,-66.9 )      ')).toEqual({ lat: 10.5, lng: -66.9 });
  });
  test('integers are accepted', () => {
    expect(parseCoordinates('Coordenadas: (10, -66)')).toEqual({ lat: 10, lng: -66 });
  });
  test('null, undefined, empty and unrelated text return null, never throw', () => {
    expect(parseCoordinates(null)).toBeNull();
    expect(parseCoordinates(undefined)).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('   ')).toBeNull();
    expect(parseCoordinates('Cliente VIP, llamar antes')).toBeNull();
    expect(parseCoordinates('Coordenadas: (10.5)')).toBeNull();
    expect(parseCoordinates('Coordenadas: (a, b)')).toBeNull();
    expect(parseCoordinates('(10.5, -66.9)')).toBeNull();
  });
  test('decimal comma is rejected (ambiguous with the separator)', () => {
    expect(parseCoordinates('Coordenadas: (10,48, -66,90)')).toBeNull();
  });
});

describe('validateCoordinates', () => {
  test('Caracas is valid', () => {
    expect(validateCoordinates({ lat: 10.4806, lng: -66.9036 })).toEqual({ ok: true });
  });
  test('swapped lat/lng inside Venezuela is flagged SWAPPED_SUSPECTED', () => {
    expect(validateCoordinates({ lat: -66.9036, lng: 10.4806 })).toEqual({ ok: false, error: 'SWAPPED_SUSPECTED' });
  });
  test('the brainstorming example (102.09, 3.123) is OUT_OF_RANGE, not swapped', () => {
    expect(validateCoordinates({ lat: 102.09, lng: 3.123 })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
  test('a point in the ocean is OUT_OF_RANGE', () => {
    expect(validateCoordinates({ lat: 30, lng: -40 })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
  test('NaN / Infinity are OUT_OF_RANGE', () => {
    expect(validateCoordinates({ lat: NaN, lng: -66 })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
    expect(validateCoordinates({ lat: 10, lng: Infinity })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
  test('box edges are inclusive', () => {
    expect(validateCoordinates({ lat: 0.6, lng: -73.4 })).toEqual({ ok: true });
    expect(validateCoordinates({ lat: 12.3, lng: -59.8 })).toEqual({ ok: true });
  });
});

describe('formatCoordinates', () => {
  test('canonical 6-decimal form', () => {
    expect(formatCoordinates({ lat: 10.4806, lng: -66.9036 })).toBe('Coordenadas: (10.480600, -66.903600)');
  });
  test('round-trips through parseCoordinates', () => {
    const c = { lat: 10.123456, lng: -66.654321 };
    expect(parseCoordinates(formatCoordinates(c))).toEqual(c);
  });
  test('always fits the varchar(60) column, even at the extremes', () => {
    expect(formatCoordinates({ lat: -12.345678, lng: -123.456789 }).length).toBeLessThanOrEqual(60);
  });
});

describe('coordinateErrorMessage', () => {
  test('gives Spanish, user-facing text per error', () => {
    expect(coordinateErrorMessage('SWAPPED_SUSPECTED')).toContain('invertid');
    expect(coordinateErrorMessage('OUT_OF_RANGE')).toContain('Venezuela');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/coordinates.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/coordinates`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/geo/coordinates.ts
//
// The ERP stores a customer's location as free text in saCliente.campo1.
// This module is the ONLY place that knows that syntax: the app always
// produces it via formatCoordinates() and always reads it via
// parseCoordinates(). Order is LATITUDE first, as people paste from
// Google Maps / OSM ("10.48, -66.90").

export interface LatLng { lat: number; lng: number }

export const VENEZUELA_BOUNDS = { latMin: 0.6, latMax: 12.3, lngMin: -73.4, lngMax: -59.8 } as const;

export type CoordinateError = 'OUT_OF_RANGE' | 'SWAPPED_SUSPECTED';
export type CoordinateValidation = { ok: true } | { ok: false; error: CoordinateError };

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const COORD_RE = new RegExp(`^\\s*coordenadas\\s*:\\s*\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*\\)\\s*$`, 'i');

export function parseCoordinates(raw: string | null | undefined): LatLng | null {
  if (!raw) return null;
  const m = COORD_RE.exec(raw);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function inBounds({ lat, lng }: LatLng): boolean {
  const b = VENEZUELA_BOUNDS;
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

export function validateCoordinates(c: LatLng): CoordinateValidation {
  if (inBounds(c)) return { ok: true };
  if (inBounds({ lat: c.lng, lng: c.lat })) return { ok: false, error: 'SWAPPED_SUSPECTED' };
  return { ok: false, error: 'OUT_OF_RANGE' };
}

export function formatCoordinates(c: LatLng): string {
  return `Coordenadas: (${c.lat.toFixed(6)}, ${c.lng.toFixed(6)})`;
}

export function coordinateErrorMessage(error: CoordinateError): string {
  return error === 'SWAPPED_SUSPECTED'
    ? 'Latitud y longitud parecen estar invertidas. Use el orden (latitud, longitud).'
    : 'Las coordenadas están fuera de Venezuela.';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/coordinates.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/geo/coordinates.ts __tests__/unit/geo/coordinates.test.ts
git commit -m "feat(geo): coordinate parse/validate/format for saCliente.campo1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ERP write procedure and typed wrapper

**Files:**
- Create: `migrations/mssql/0008_pApiActualizarUbicacionCliente.sql`
- Create: `lib/geo/erp-location.ts`
- Test: `__tests__/unit/geo/erp-location.test.ts`
- Test: `__tests__/integration/ubicacion-cliente.integration.test.ts`
- Modify: `package.json` (scripts `test`, `test:unit`, new `test:geo-erp`)

**Interfaces:**
- Consumes: `formatCoordinates` is NOT used here; callers pass already-formatted `campo1`.
- Produces:
  ```ts
  export const ERP_USER_CODE = 'PROFIT';
  export interface LocationUpdate { coCli: string; campo1?: string | null; dirEnt2?: string | null }
  export class CustomerNotFoundError extends Error { constructor(coCli: string) }
  export function updateCustomerLocation(pool: sql.ConnectionPool, update: LocationUpdate): Promise<void>;
  ```
  Semantics: `undefined`/`null` field = leave that column unchanged (clearing a value is intentionally unsupported).

- [ ] **Step 1: Write the failing unit test (stub pool, no DB)**

```ts
// __tests__/unit/geo/erp-location.test.ts
import { describe, test, expect } from 'bun:test';
import type sql from 'mssql';
import { updateCustomerLocation, CustomerNotFoundError, ERP_USER_CODE } from '@/lib/geo/erp-location';

function stubPool(execute: (name: string, inputs: Record<string, unknown>) => Promise<unknown>) {
  const inputs: Record<string, unknown> = {};
  const request = {
    input(name: string, _type: unknown, value: unknown) { inputs[name] = value; return request; },
    execute: (name: string) => execute(name, inputs),
  };
  return { pool: { request: () => request } as unknown as sql.ConnectionPool, inputs };
}

describe('updateCustomerLocation', () => {
  test('calls the procedure with trimmed code, both fields and the ERP user', async () => {
    let called = '';
    const { pool, inputs } = stubPool(async name => { called = name; return {}; });
    await updateCustomerLocation(pool, { coCli: '  J-1  ', campo1: 'Coordenadas: (10.000000, -66.000000)', dirEnt2: 'Av. X' });
    expect(called).toBe('pApiActualizarUbicacionCliente');
    expect(inputs).toEqual({
      sCoCli: 'J-1', sCampo1: 'Coordenadas: (10.000000, -66.000000)', sDirEnt2: 'Av. X', sCoUsMo: ERP_USER_CODE,
    });
  });

  test('omitted fields are sent as null (= unchanged)', async () => {
    const { pool, inputs } = stubPool(async () => ({}));
    await updateCustomerLocation(pool, { coCli: 'J-1', dirEnt2: 'Av. X' });
    expect(inputs.sCampo1).toBeNull();
  });

  test('maps the procedure\'s "no encontrado" error to CustomerNotFoundError', async () => {
    const { pool } = stubPool(async () => { throw new Error('Cliente J-9 no encontrado'); });
    await expect(updateCustomerLocation(pool, { coCli: 'J-9', campo1: 'x' })).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  test('other errors propagate unchanged', async () => {
    const { pool } = stubPool(async () => { throw new Error('boom'); });
    await expect(updateCustomerLocation(pool, { coCli: 'J-1', campo1: 'x' })).rejects.toThrow('boom');
  });

  test('rejects an empty customer code before touching the DB', async () => {
    const { pool } = stubPool(async () => { throw new Error('should not be called'); });
    await expect(updateCustomerLocation(pool, { coCli: '   ', campo1: 'x' })).rejects.toThrow('coCli');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/erp-location.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/erp-location`.

- [ ] **Step 3: Write the stored procedure**

```sql
-- migrations/mssql/0008_pApiActualizarUbicacionCliente.sql
-- Updates ONLY a customer's location fields (campo1 = coordinates text,
-- dir_ent2 = delivery address). NULL parameter = leave that column
-- unchanged. Stamps saCliente's own modification audit columns
-- (co_us_mo / fe_us_mo) like Profit Plus's own editors do.
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiActualizarUbicacionCliente')
    DROP PROCEDURE pApiActualizarUbicacionCliente;
GO

CREATE PROCEDURE [pApiActualizarUbicacionCliente]
    (
      @sCoCli   CHAR(16),
      @sCampo1  VARCHAR(60)  = NULL,
      @sDirEnt2 VARCHAR(MAX) = NULL,
      @sCoUsMo  CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
        BEGIN
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCli);
        END

        UPDATE saCliente
        SET campo1   = ISNULL(@sCampo1, campo1),
            dir_ent2 = ISNULL(@sDirEnt2, dir_ent2),
            co_us_mo = @sCoUsMo,
            fe_us_mo = GETDATE()
        WHERE co_cli = @sCoCli;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO
```

- [ ] **Step 4: Write the wrapper**

```ts
// lib/geo/erp-location.ts
import sql from 'mssql';

// Same constant the inventory adjustments route uses for ERP audit stamps.
export const ERP_USER_CODE = 'PROFIT';

export interface LocationUpdate {
  coCli: string;
  campo1?: string | null;
  dirEnt2?: string | null;
}

export class CustomerNotFoundError extends Error {
  constructor(coCli: string) {
    super(`Cliente ${coCli} no encontrado`);
    this.name = 'CustomerNotFoundError';
  }
}

export async function updateCustomerLocation(pool: sql.ConnectionPool, update: LocationUpdate): Promise<void> {
  const coCli = update.coCli.trim();
  if (!coCli) throw new Error('coCli requerido');

  try {
    await pool.request()
      .input('sCoCli', sql.Char(16), coCli)
      .input('sCampo1', sql.VarChar(60), update.campo1 ?? null)
      .input('sDirEnt2', sql.VarChar(sql.MAX), update.dirEnt2 ?? null)
      .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
      .execute('pApiActualizarUbicacionCliente');
  } catch (err) {
    if (err instanceof Error && /no encontrado/i.test(err.message)) throw new CustomerNotFoundError(coCli);
    throw err;
  }
}
```

- [ ] **Step 5: Run unit test to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/erp-location.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the integration test (writes to the ERP and restores)**

```ts
// __tests__/integration/ubicacion-cliente.integration.test.ts
//
// WRITES to the ERP (then restores). Run ONLY against a non-production
// Profit Plus instance, after `bun run migrate:mssql` has installed
// pApiActualizarUbicacionCliente. `bun run test:geo-erp`.
import { describe, test, expect } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { updateCustomerLocation, CustomerNotFoundError } from '@/lib/geo/erp-location';

describe('pApiActualizarUbicacionCliente', () => {
  test('writes campo1 + dir_ent2, stamps audit columns, and leaves other columns alone', async () => {
    const pool = await getPool();
    const row = (await pool.request().query(
      `SELECT TOP 1 co_cli, campo1, dir_ent2, co_us_mo, fe_us_mo, direc1 FROM saCliente WHERE inactivo = 0 ORDER BY co_cli`,
    )).recordset[0];
    const coCli = String(row.co_cli).trim();

    try {
      await updateCustomerLocation(pool, {
        coCli, campo1: 'Coordenadas: (10.480600, -66.903600)', dirEnt2: 'DIRECCION DE PRUEBA E2E',
      });
      const after = (await pool.request().input('c', sql.Char(16), coCli).query(
        `SELECT campo1, dir_ent2, co_us_mo, direc1 FROM saCliente WHERE co_cli = @c`,
      )).recordset[0];
      expect(after.campo1).toBe('Coordenadas: (10.480600, -66.903600)');
      expect(after.dir_ent2).toBe('DIRECCION DE PRUEBA E2E');
      expect(String(after.co_us_mo).trim()).toBe('PROFIT');
      expect(after.direc1).toBe(row.direc1);

      // NULL = unchanged
      await updateCustomerLocation(pool, { coCli, dirEnt2: 'OTRA' });
      const again = (await pool.request().input('c', sql.Char(16), coCli).query(
        `SELECT campo1, dir_ent2 FROM saCliente WHERE co_cli = @c`,
      )).recordset[0];
      expect(again.campo1).toBe('Coordenadas: (10.480600, -66.903600)');
      expect(again.dir_ent2).toBe('OTRA');
    } finally {
      await pool.request()
        .input('c', sql.Char(16), coCli)
        .input('campo1', sql.VarChar(60), row.campo1)
        .input('dir', sql.VarChar(sql.MAX), row.dir_ent2)
        .input('us', sql.Char(6), row.co_us_mo)
        .input('fe', sql.DateTime, row.fe_us_mo)
        .query(`UPDATE saCliente SET campo1=@campo1, dir_ent2=@dir, co_us_mo=@us, fe_us_mo=@fe WHERE co_cli=@c`);
    }
  });

  test('unknown customer raises CustomerNotFoundError', async () => {
    const pool = await getPool();
    await expect(updateCustomerLocation(pool, { coCli: 'NO-EXISTE-XYZ', campo1: 'x' }))
      .rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});
```

- [ ] **Step 7: Wire the integration test into `package.json` and keep it out of the default suites**

In `package.json` `scripts`: append `--path-ignore-patterns='**/ubicacion-cliente.integration.test.ts'` to both `test` and `test:unit`, and add:

```json
"test:geo-erp": "bun test --isolate --env-file=.env.local __tests__/integration/ubicacion-cliente.integration.test.ts",
```

- [ ] **Step 8: Install the procedure and run the integration test (non-production ERP only)**

Run: `bun run migrate:mssql && bun run test:geo-erp`
Expected: PASS (2 tests). Then verify nothing leaked:
`SELECT COUNT(*) FROM saCliente WHERE campo1 IS NOT NULL` via a one-off query → 0.

- [ ] **Step 9: Commit**

```bash
git add migrations/mssql/0008_pApiActualizarUbicacionCliente.sql lib/geo/erp-location.ts \
  __tests__/unit/geo/erp-location.test.ts __tests__/integration/ubicacion-cliente.integration.test.ts package.json
git commit -m "feat(geo): pApiActualizarUbicacionCliente procedure and typed wrapper

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Geocoding library (Nominatim → Google)

**Files:**
- Create: `lib/geo/geocoding.ts`
- Test: `__tests__/unit/geo/geocoding.test.ts`

**Interfaces:**
- Consumes: `validateCoordinates`, `CoordinateError` from `lib/geo/coordinates.ts`.
- Produces:
  ```ts
  export type Provider = 'osm' | 'google';
  export type ProviderMode = Provider | 'both';
  export type Confidence = 'high' | 'medium' | 'low';
  export interface GeocodeCandidate { lat: number; lng: number; provider: Provider; confidence: Confidence; detail: string }
  export interface GeocodeResult { candidate: GeocodeCandidate | null; rejected: string[] }
  export function normalizeAddress(raw: string): string;
  export function geocodeNominatim(address: string, fetchImpl?: typeof fetch): Promise<GeocodeCandidate | null>;
  export function geocodeGoogle(address: string, apiKey: string, fetchImpl?: typeof fetch): Promise<GeocodeCandidate | null>;
  export function geocodeAddress(address: string, opts: { mode: ProviderMode; googleKey?: string; fetchImpl?: typeof fetch }): Promise<GeocodeResult>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/geocoding.test.ts
import { describe, test, expect } from 'bun:test';
import {
  normalizeAddress, geocodeNominatim, geocodeGoogle, geocodeAddress,
} from '@/lib/geo/geocoding';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

describe('normalizeAddress', () => {
  test('collapses whitespace, expands abbreviations, appends Venezuela once', () => {
    expect(normalizeAddress('  Av.  Francisco  de Miranda,   C.C. Lido  ')).toBe(
      'Avenida Francisco de Miranda, Centro Comercial Lido, Venezuela',
    );
    expect(normalizeAddress('Calle 5, Venezuela')).toBe('Calle 5, Venezuela');
  });
  test('empty after trimming returns empty string', () => {
    expect(normalizeAddress('   ')).toBe('');
  });
});

describe('geocodeNominatim', () => {
  test('maps the first hit; sends a User-Agent and restricts to VE', async () => {
    const { impl, calls } = fakeFetch((_u, init) => {
      expect((init?.headers as Record<string, string>)['User-Agent']).toContain('profitplus-exporter');
      return json([{ lat: '10.4806', lon: '-66.9036', importance: 0.5, display_name: 'Caracas' }]);
    });
    const c = await geocodeNominatim('Caracas, Venezuela', impl);
    expect(c).toEqual({ lat: 10.4806, lng: -66.9036, provider: 'osm', confidence: 'high', detail: 'importance 0.50' });
    expect(calls[0]).toContain('countrycodes=ve');
  });
  test('importance buckets: <0.25 low, <0.4 medium', async () => {
    const mk = (imp: number) => fakeFetch(() => json([{ lat: '10', lon: '-66', importance: imp, display_name: 'x' }])).impl;
    expect((await geocodeNominatim('a', mk(0.1)))!.confidence).toBe('low');
    expect((await geocodeNominatim('a', mk(0.3)))!.confidence).toBe('medium');
  });
  test('empty array → null', async () => {
    expect(await geocodeNominatim('x', fakeFetch(() => json([])).impl)).toBeNull();
  });
  test('HTTP error throws', async () => {
    await expect(geocodeNominatim('x', fakeFetch(() => json({}, 429)).impl)).rejects.toThrow('Nominatim');
  });
});

describe('geocodeGoogle', () => {
  test('maps location + location_type to confidence', async () => {
    const mk = (t: string) => fakeFetch(() => json({
      status: 'OK', results: [{ geometry: { location: { lat: 10.5, lng: -66.9 }, location_type: t } }],
    })).impl;
    expect((await geocodeGoogle('a', 'KEY', mk('ROOFTOP')))).toMatchObject({ lat: 10.5, lng: -66.9, provider: 'google', confidence: 'high' });
    expect((await geocodeGoogle('a', 'KEY', mk('RANGE_INTERPOLATED')))!.confidence).toBe('medium');
    expect((await geocodeGoogle('a', 'KEY', mk('GEOMETRIC_CENTER')))!.confidence).toBe('medium');
    expect((await geocodeGoogle('a', 'KEY', mk('APPROXIMATE')))!.confidence).toBe('low');
  });
  test('ZERO_RESULTS → null', async () => {
    expect(await geocodeGoogle('a', 'K', fakeFetch(() => json({ status: 'ZERO_RESULTS', results: [] })).impl)).toBeNull();
  });
  test('REQUEST_DENIED / OVER_QUERY_LIMIT throw with the status (not "no result")', async () => {
    const denied = fakeFetch(() => json({ status: 'REQUEST_DENIED', error_message: 'bad key', results: [] })).impl;
    await expect(geocodeGoogle('a', 'K', denied)).rejects.toThrow('REQUEST_DENIED');
    const limit = fakeFetch(() => json({ status: 'OVER_QUERY_LIMIT', results: [] })).impl;
    await expect(geocodeGoogle('a', 'K', limit)).rejects.toThrow('OVER_QUERY_LIMIT');
  });
  test('the API key is sent but the address is URL-encoded', async () => {
    const { impl, calls } = fakeFetch(() => json({ status: 'ZERO_RESULTS', results: [] }));
    await geocodeGoogle('Av. Ñ & Co', 'KEY123', impl);
    expect(calls[0]).toContain('key=KEY123');
    expect(calls[0]).toContain(encodeURIComponent('Av. Ñ & Co'));
  });
});

describe('geocodeAddress', () => {
  const osm = (lat: string, lon: string, importance: number) =>
    [{ lat, lon, importance, display_name: 'x' }];

  test('both: a high-confidence OSM hit is returned without calling Google', async () => {
    const { impl, calls } = fakeFetch(() => json(osm('10.5', '-66.9', 0.6)));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: impl });
    expect(r.candidate?.provider).toBe('osm');
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
  });

  test('both: no OSM hit falls back to Google', async () => {
    const { impl } = fakeFetch(u => u.includes('googleapis')
      ? json({ status: 'OK', results: [{ geometry: { location: { lat: 10.5, lng: -66.9 }, location_type: 'ROOFTOP' } }] })
      : json([]));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: impl });
    expect(r.candidate?.provider).toBe('google');
  });

  test('both: low-confidence OSM is kept only if Google finds nothing better', async () => {
    const lowOsm = osm('10.5', '-66.9', 0.1);
    const g = fakeFetch(u => u.includes('googleapis')
      ? json({ status: 'OK', results: [{ geometry: { location: { lat: 10.6, lng: -66.8 }, location_type: 'ROOFTOP' } }] })
      : json(lowOsm));
    expect((await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: g.impl })).candidate?.provider).toBe('google');

    const none = fakeFetch(u => u.includes('googleapis') ? json({ status: 'ZERO_RESULTS', results: [] }) : json(lowOsm));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: none.impl });
    expect(r.candidate).toMatchObject({ provider: 'osm', confidence: 'low' });
  });

  test('both without a Google key behaves like osm', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    const r = await geocodeAddress('a', { mode: 'both', fetchImpl: impl });
    expect(r.candidate).toBeNull();
    expect(calls.length).toBe(1);
  });

  test('google mode without a key throws', async () => {
    await expect(geocodeAddress('a', { mode: 'google', fetchImpl: fakeFetch(() => json({})).impl })).rejects.toThrow('GOOGLE_MAPS_API_KEY');
  });

  test('a result outside Venezuela is rejected, recorded, and not returned', async () => {
    const { impl } = fakeFetch(() => json(osm('40.4', '-3.7', 0.7))); // Madrid
    const r = await geocodeAddress('a', { mode: 'osm', fetchImpl: impl });
    expect(r.candidate).toBeNull();
    expect(r.rejected).toEqual(['osm: OUT_OF_RANGE']);
  });

  test('a swapped provider result is rejected as SWAPPED_SUSPECTED, never auto-corrected', async () => {
    const { impl } = fakeFetch(() => json(osm('-66.9', '10.5', 0.7)));
    const r = await geocodeAddress('a', { mode: 'osm', fetchImpl: impl });
    expect(r.candidate).toBeNull();
    expect(r.rejected).toEqual(['osm: SWAPPED_SUSPECTED']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/geocoding.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/geocoding`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/geo/geocoding.ts
import { validateCoordinates } from './coordinates';

export type Provider = 'osm' | 'google';
export type ProviderMode = Provider | 'both';
export type Confidence = 'high' | 'medium' | 'low';

export interface GeocodeCandidate {
  lat: number;
  lng: number;
  provider: Provider;
  confidence: Confidence;
  detail: string;
}

export interface GeocodeResult {
  candidate: GeocodeCandidate | null;
  rejected: string[];
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bav\.?(?=\s)/gi, 'Avenida'],
  [/\bc\.c\.?(?=\s|$)/gi, 'Centro Comercial'],
  [/\burb\.?(?=\s)/gi, 'Urbanización'],
  [/\bedif\.?(?=\s)/gi, 'Edificio'],
];

export function normalizeAddress(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  if (!/venezuela\s*$/i.test(s)) s = `${s}, Venezuela`;
  return s;
}

const USER_AGENT = 'profitplus-exporter/1.0 (customer geocoding script)';

export async function geocodeNominatim(address: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeCandidate | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ve&q=${encodeURIComponent(address)}`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const body = (await res.json()) as { lat: string; lon: string; importance?: number }[];
  const hit = body[0];
  if (!hit) return null;
  const importance = hit.importance ?? 0;
  const confidence: Confidence = importance < 0.25 ? 'low' : importance < 0.4 ? 'medium' : 'high';
  return { lat: Number(hit.lat), lng: Number(hit.lon), provider: 'osm', confidence, detail: `importance ${importance.toFixed(2)}` };
}

const GOOGLE_CONFIDENCE: Record<string, Confidence> = {
  ROOFTOP: 'high', RANGE_INTERPOLATED: 'medium', GEOMETRIC_CENTER: 'medium', APPROXIMATE: 'low',
};

export async function geocodeGoogle(address: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeCandidate | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:VE&key=${apiKey}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const body = (await res.json()) as {
    status: string; error_message?: string;
    results: { geometry: { location: { lat: number; lng: number }; location_type: string } }[];
  };
  if (body.status === 'ZERO_RESULTS') return null;
  if (body.status !== 'OK') throw new Error(`Google ${body.status}${body.error_message ? `: ${body.error_message}` : ''}`);
  const g = body.results[0]?.geometry;
  if (!g) return null;
  return {
    lat: g.location.lat, lng: g.location.lng, provider: 'google',
    confidence: GOOGLE_CONFIDENCE[g.location_type] ?? 'low', detail: g.location_type,
  };
}

export async function geocodeAddress(
  address: string,
  opts: { mode: ProviderMode; googleKey?: string; fetchImpl?: typeof fetch },
): Promise<GeocodeResult> {
  const { mode, googleKey, fetchImpl } = opts;
  if (mode === 'google' && !googleKey) throw new Error('GOOGLE_MAPS_API_KEY requerido para --provider google');

  const attempts: Provider[] =
    mode === 'osm' ? ['osm'] : mode === 'google' ? ['google'] : googleKey ? ['osm', 'google'] : ['osm'];

  const rejected: string[] = [];
  let best: GeocodeCandidate | null = null;

  for (const provider of attempts) {
    const c = provider === 'osm'
      ? await geocodeNominatim(address, fetchImpl)
      : await geocodeGoogle(address, googleKey!, fetchImpl);
    if (!c) continue;
    const v = validateCoordinates({ lat: c.lat, lng: c.lng });
    if (!v.ok) { rejected.push(`${provider}: ${v.error}`); continue; }
    if (c.confidence !== 'low') return { candidate: c, rejected };
    best ??= c;
  }
  return { candidate: best, rejected };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/geocoding.test.ts`
Expected: PASS. If the `normalizeAddress` case `C.C. Lido` fails, adjust only the abbreviation regexes (the lookahead `(?=\s|$)`), not the test expectations.

- [ ] **Step 5: Commit**

```bash
git add lib/geo/geocoding.ts __tests__/unit/geo/geocoding.test.ts
git commit -m "feat(geo): Nominatim + Google geocoding with validation and fallback

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Geocoding CLI script

**Files:**
- Create: `lib/geo/geocode-cli.ts`
- Create: `scripts/geocode-customers.ts`
- Test: `__tests__/unit/geo/geocode-cli.test.ts`
- Modify: `package.json` (script `geocode:customers`), `.env.example`

**Interfaces:**
- Consumes: `geocodeAddress`, `ProviderMode` (Task 3); `formatCoordinates` (Task 1); `updateCustomerLocation` (Task 2); `getPool` from `lib/db/mssql`.
- Produces:
  ```ts
  export interface GeocodeArgs { apply: boolean; force: boolean; provider: ProviderMode; limit: number | null }
  export function parseGeocodeArgs(argv: string[]): GeocodeArgs;   // throws on unknown flag / bad value
  export function pickAddress(row: { dirEnt2: string | null; direc1: string | null }): { address: string; source: 'dir_ent2' | 'direc1' } | null;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/geo/geocode-cli.test.ts
import { describe, test, expect } from 'bun:test';
import { parseGeocodeArgs, pickAddress } from '@/lib/geo/geocode-cli';

describe('parseGeocodeArgs', () => {
  test('defaults: dry-run, no force, provider both, no limit', () => {
    expect(parseGeocodeArgs([])).toEqual({ apply: false, force: false, provider: 'both', limit: null });
  });
  test('flags', () => {
    expect(parseGeocodeArgs(['--apply', '--force', '--provider', 'osm', '--limit', '5']))
      .toEqual({ apply: true, force: true, provider: 'osm', limit: 5 });
    expect(parseGeocodeArgs(['--provider=google'])).toMatchObject({ provider: 'google' });
  });
  test('rejects unknown flags and bad values', () => {
    expect(() => parseGeocodeArgs(['--wat'])).toThrow('--wat');
    expect(() => parseGeocodeArgs(['--provider', 'bing'])).toThrow('provider');
    expect(() => parseGeocodeArgs(['--limit', 'abc'])).toThrow('limit');
    expect(() => parseGeocodeArgs(['--limit', '0'])).toThrow('limit');
  });
});

describe('pickAddress', () => {
  test('prefers dir_ent2, falls back to direc1', () => {
    expect(pickAddress({ dirEnt2: 'Entrega 1', direc1: 'Fiscal 1' })).toEqual({ address: 'Entrega 1', source: 'dir_ent2' });
    expect(pickAddress({ dirEnt2: '   ', direc1: 'Fiscal 1' })).toEqual({ address: 'Fiscal 1', source: 'direc1' });
    expect(pickAddress({ dirEnt2: null, direc1: 'Fiscal 1' })).toEqual({ address: 'Fiscal 1', source: 'direc1' });
  });
  test('neither → null (so no provider call is made)', () => {
    expect(pickAddress({ dirEnt2: null, direc1: '  ' })).toBeNull();
    expect(pickAddress({ dirEnt2: null, direc1: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/geocode-cli.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/geocode-cli`.

- [ ] **Step 3: Write the helpers**

```ts
// lib/geo/geocode-cli.ts
import type { ProviderMode } from './geocoding';

export interface GeocodeArgs {
  apply: boolean;
  force: boolean;
  provider: ProviderMode;
  limit: number | null;
}

const PROVIDERS: ProviderMode[] = ['osm', 'google', 'both'];

export function parseGeocodeArgs(argv: string[]): GeocodeArgs {
  const out: GeocodeArgs = { apply: false, force: false, provider: 'both', limit: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=', 2);
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '--apply': out.apply = true; break;
      case '--force': out.force = true; break;
      case '--provider': {
        const v = value() as ProviderMode;
        if (!PROVIDERS.includes(v)) throw new Error(`provider inválido: ${v} (osm | google | both)`);
        out.provider = v; break;
      }
      case '--limit': {
        const n = Number(value());
        if (!Number.isInteger(n) || n < 1) throw new Error('limit debe ser un entero ≥ 1');
        out.limit = n; break;
      }
      default: throw new Error(`Argumento desconocido: ${flag}`);
    }
  }
  return out;
}

export function pickAddress(row: { dirEnt2: string | null; direc1: string | null }):
  { address: string; source: 'dir_ent2' | 'direc1' } | null {
  const ent = row.dirEnt2?.trim();
  if (ent) return { address: ent, source: 'dir_ent2' };
  const fis = row.direc1?.trim();
  if (fis) return { address: fis, source: 'direc1' };
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test --isolate --env-file=.env.local __tests__/unit/geo/geocode-cli.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the script**

```ts
// scripts/geocode-customers.ts
//
// Pre-fills saCliente.campo1 ("Coordenadas: (lat, lng)") from each
// customer's address. DRY-RUN by default — prints what it would write;
// `--apply` writes via pApiActualizarUbicacionCliente. Low-confidence
// and rejected results are never written, only listed for manual
// placement on the /mapa page.
//
//   bun run geocode:customers                  # dry-run, provider both
//   bun run geocode:customers --apply
//   bun run geocode:customers --provider osm --limit 10
//   bun run geocode:customers --force --apply  # also redo customers that already have campo1
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { formatCoordinates } from '@/lib/geo/coordinates';
import { normalizeAddress, geocodeAddress } from '@/lib/geo/geocoding';
import { parseGeocodeArgs, pickAddress } from '@/lib/geo/geocode-cli';
import { updateCustomerLocation } from '@/lib/geo/erp-location';

const NOMINATIM_DELAY_MS = 1100; // Nominatim policy: max 1 request/second

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const args = parseGeocodeArgs(process.argv.slice(2));
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || undefined;
  if (args.provider === 'google' && !googleKey) throw new Error('Falta GOOGLE_MAPS_API_KEY');

  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS name,
           RTRIM(direc1) AS direc1, RTRIM(dir_ent2) AS dirEnt2, RTRIM(campo1) AS campo1
    FROM saCliente
    WHERE inactivo = 0 ${args.force ? '' : `AND NULLIF(RTRIM(campo1), '') IS NULL`}
    ORDER BY co_cli
  `)).recordset as { coCli: string; name: string; direc1: string | null; dirEnt2: string | null; campo1: string | null }[];

  const todo = args.limit ? rows.slice(0, args.limit) : rows;
  console.log(`${todo.length} cliente(s) a procesar — modo: ${args.apply ? 'APPLY' : 'dry-run'}, proveedor: ${args.provider}\n`);

  const ok: Record<string, string | number>[] = [];
  const manual: Record<string, string>[] = [];

  for (const row of todo) {
    const picked = pickAddress(row);
    if (!picked) { manual.push({ cliente: row.coCli, nombre: row.name, motivo: 'sin dirección' }); continue; }

    let result;
    try {
      result = await geocodeAddress(normalizeAddress(picked.address), { mode: args.provider, googleKey });
    } catch (err) {
      manual.push({ cliente: row.coCli, nombre: row.name, motivo: `error: ${(err as Error).message}` });
      await sleep(NOMINATIM_DELAY_MS);
      continue;
    }

    const c = result.candidate;
    if (!c) {
      manual.push({ cliente: row.coCli, nombre: row.name, motivo: result.rejected.length ? `descartado (${result.rejected.join(', ')})` : 'sin resultado' });
    } else if (c.confidence === 'low') {
      manual.push({ cliente: row.coCli, nombre: row.name, motivo: `confianza baja (${c.provider}: ${c.detail})` });
    } else {
      const campo1 = formatCoordinates({ lat: c.lat, lng: c.lng });
      ok.push({ cliente: row.coCli, nombre: row.name, dirección: `${picked.source}: ${picked.address}`, proveedor: c.provider, confianza: `${c.confidence} (${c.detail})`, campo1 });
      if (args.apply) await updateCustomerLocation(pool, { coCli: row.coCli, campo1 });
    }
    await sleep(NOMINATIM_DELAY_MS);
  }

  console.log(`\n✓ ${args.apply ? 'Escritos' : 'Escribiría'}: ${ok.length}`);
  if (ok.length) console.table(ok);
  console.log(`\n⚠ Requieren colocación manual en /mapa: ${manual.length}`);
  if (manual.length) console.table(manual);
  if (!args.apply && ok.length) console.log('\nDry-run: nada se escribió. Use --apply para guardar.');
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 6: Add the npm script and env docs**

`package.json` scripts: `"geocode:customers": "bun --bun run scripts/geocode-customers.ts",`

`.env.example` — append:

```
# Optional. Only needed for `bun run geocode:customers --provider google|both` fallback.
# GOOGLE_MAPS_API_KEY=
```

- [ ] **Step 7: Smoke-run the dry-run against the real ERP (read-only)**

Run: `bun run geocode:customers --provider osm --limit 3`
Expected: prints 3 customers, a "Escribiría" table and/or a manual table, ends with "Dry-run: nada se escribió". Confirm `SELECT COUNT(*) FROM saCliente WHERE campo1 IS NOT NULL` is still 0.

- [ ] **Step 8: Commit**

```bash
git add lib/geo/geocode-cli.ts scripts/geocode-customers.ts __tests__/unit/geo/geocode-cli.test.ts package.json .env.example
git commit -m "feat(geo): geocode-customers script (dry-run by default)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Remove the Rutas tab; update `AGENTS.md` and the spec

**Files:**
- Modify: `app/(app)/analitica/analitica-client.tsx` (remove line 22 import and the `rutas` entry at line 50)
- Delete: `app/(app)/analitica/tabs/tab-stub.tsx` (no other user — verified by grep: only `analitica-client.tsx` imports it)
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-30-customer-map-design.md`

- [ ] **Step 1: Confirm nothing else references the stub or the tab**

Run: `grep -rn "TabStub\|tab-stub\|'rutas'\|Rutas y Logística" app e2e lib components`
Expected: only the two lines in `analitica-client.tsx`. If anything else appears, fix it in this task.

- [ ] **Step 2: Remove the tab**

In `app/(app)/analitica/analitica-client.tsx` delete `import TabStub from './tabs/tab-stub';` and the line `{ key: 'rutas', label: 'Rutas y Logística', component: () => <TabStub title="Rutas y Logística" /> },`. Then `git rm "app/(app)/analitica/tabs/tab-stub.tsx"`.

- [ ] **Step 3: Type-check and run the unit suite**

Run: `bunx tsc --noEmit && bun run test:unit`
Expected: no type errors; tests pass. A stale `?tab=rutas` URL must fall back to the default tab — confirm by reading how `analitica-client.tsx` resolves an unknown `tab` param (it uses `DEFAULT_TAB`); if it does not fall back, add the fallback in this step.

- [ ] **Step 4: Update `AGENTS.md`**

Replace the paragraph that begins "The ERP and the DWH are two different things reached two different ways:" … ending "…and never query `dim.*`/`fact.*` from anywhere that isn't the analytics dashboard's own routes." with:

```
The ERP and the DWH are two different things reached two different ways:
the ERP is queried live, per-request, directly against Profit Plus tables
(`saFacturaVenta`, `saArticulo`, etc.) with collation/RTRIM handling inline
in each query. The DWH is a separate database (`DWH_AlimentosNY`) built
ahead of time by `migrations/dwh/` and refreshed by `Load_*` stored
procedures — it holds pre-aggregated `dim.*`/`fact.*` tables with no
collation gymnastics needed, since that was already handled at load time.
Any module may read the DWH through `getDwhPool()` (using `.input()` for
user-controlled values); a module that needs both ERP and DWH data (e.g.
`/mapa`) queries each through its own pool and merges the results in
TypeScript by customer code — never join across the two databases in SQL
outside the `Load_*` procedures.
```

Add to the Directory Map under `lib/`:

```
  geo/coordinates.ts      — parseCoordinates()/validateCoordinates()/formatCoordinates() for saCliente.campo1 ("Coordenadas: (lat, lng)")
  geo/erp-location.ts     — updateCustomerLocation() → pApiActualizarUbicacionCliente (only way the app writes campo1/dir_ent2)
  geo/geocoding.ts        — Nominatim/Google geocoding used by scripts/geocode-customers.ts
```

Under `scripts/` add `geocode-customers.ts — bun run geocode:customers (dry-run by default)`, and under `migrations/mssql/` mention `pApiActualizarUbicacionCliente`. In "Testing Notes" add: "`bun run test:geo-erp` writes to the ERP (then restores) — non-production only."

- [ ] **Step 5: Amend the spec to match what the repo actually does**

In `docs/superpowers/specs/2026-09-30-customer-map-design.md`:
1. Decisions table, "Validation": add "Decimal separator is a dot only (a comma is ambiguous with the lat/lng separator)."
2. Decisions table, "Geocoding": add "Low-confidence and out-of-box results are never written, even with `--apply`; they are listed for manual placement."
3. Section 2 "Pareto segment": replace with "Same definition as the analytics Clientes tab (`app/api/dwh/clientes/route.ts`): customers ranked by period net sales (BS), bucketed by cumulative share — A ≤ 20%, B ≤ 50%, C the rest (`PARETO_THRESHOLDS`)."
4. Section 2 API: replace `?from=&to=` with `?dateRange=` using the analytics dashboard's existing format (`month:YYYY-MM`, `custom:YYYY-MM-DD:YYYY-MM-DD`, `ytd:YYYY`, parsed by `buildDateWhereClause`), and replace "converted via `saTasa`" with "USD per row via `usdConversionJoin`/`dualAmountExpr` from `app/api/dwh/lib/query-builder.ts` (never a single current rate)".
5. Add a "Plans" section listing the three plan files and their dependency order.

- [ ] **Step 6: Commit**

```bash
git add -A app/\(app\)/analitica AGENTS.md docs/superpowers/specs/2026-09-30-customer-map-design.md
git commit -m "chore(analitica): remove Rutas stub tab; docs: relax DWH rule, document lib/geo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (done by plan author)

- **Spec coverage (Section 1 + cleanup):** coordinate module → Task 1; ERP procedure + wrapper → Task 2; geocoding script (providers, dry-run, `--force`, validation, low-confidence handling) → Tasks 3–4; Rutas removal + `AGENTS.md` relaxation + spec corrections → Task 5. Delivery-address editing UI and the `/api` endpoint are Plan 2.
- **Placeholders:** none.
- **Type consistency:** `LatLng`, `ProviderMode`, `LocationUpdate`, `CustomerNotFoundError`, `ERP_USER_CODE` are defined once (Tasks 1–3) and consumed with identical names in Task 4 and in Plan 2.
- **Review Focus coverage:** spaced/odd `campo1` and unrelated text → Task 1 tests; padded/NULL → Task 1; outside-Venezuela and swapped → Task 3 tests; Google 200+`REQUEST_DENIED` → Task 3 tests; no address → Task 4 `pickAddress`; re-run idempotency → default query filters empty `campo1` (Task 4 Step 5, verified by the dry-run smoke in Step 7).
