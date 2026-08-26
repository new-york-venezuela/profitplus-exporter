# Inventory: Simple Movement Adjustments + Article Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "simple ajuste" (direct-quantity movement) mode to `/inventario/ajustes`, and a minimal article-creation form to `/inventario/articulos`, both writing to the live Profit Plus MSSQL database.

**Architecture:** Simple ajuste reuses the existing `pApiCrearAjusteInventario` procedure with a new single-line caller (no new SP). Article creation adds one new hardened stored procedure (`pApiCrearArticuloInventario`, wrapping `pInsertarArticulo` + `pInsertarUnidadArticuloRenglon` in one transaction) deployed via `mssql-migrations/`, plus a new lookups route and a new `POST /api/inventory/items` route that also reuses the existing warehouse-assignment endpoint's logic to land the new article at 0 stock.

**Tech Stack:** Next.js App Router API routes, `mssql` npm package, MSSQL stored procedures deployed via `bun run migrate:mssql`, Drizzle/SQLite for the warehouse allowlist, Bun test for integration tests (`@mssql` tag), Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-08-26-inventory-simple-adjustments-and-article-creation-design.md`

## Global Constraints

- Every inventory API route independently calls `getSessionFromRequest` + `hasInventoryAccess` (`lib/inventory/access.ts`) — no shared middleware exists in this codebase; copy the pattern exactly as every existing route does.
- Warehouse selection everywhere in this module is restricted to `inventoryWarehouses` (SQLite) active rows when that allowlist is non-empty (`activeWarehouses.length > 0 && !activeWarehouses.some(...)` — empty allowlist means "no restriction configured yet", not "nothing allowed").
- All Profit Plus writes go through a stored procedure wrapping every step in `BEGIN TRY` / `BEGIN TRAN` ... `COMMIT TRAN` / `BEGIN CATCH` with explicit `IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0 ROLLBACK TRAN` then `RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg)` — copy `mssql-migrations/0002_pApiCrearAjusteInventario.sql`'s CATCH block verbatim in structure.
- `trimStrings` (`lib/trim-strings.ts`) is applied to every `char`-typed MSSQL recordset before it's mapped to JSON.
- Service identity for all writes: `CO_US_IN = 'PROFIT'`, `CO_SUCU_IN = null` (matches `app/api/inventory/adjustments/route.ts`'s existing constants — this app has no per-user Profit Plus login mapping).
- MSSQL error number `50000` = an unnumbered `RAISERROR`, always surfaced as HTTP 400 with the DB's own message, never 500 (matches the existing adjustments route's error handling).
- New SQL migrations go in `mssql-migrations/NNNN_*.sql`, numbered sequentially after the existing `0003_seed_manual_recount_tipos.sql`, split on `GO` batch separators, run via `bun run migrate:mssql` / `scripts/migrate-mssql.ts`.
- Integration tests requiring the live/mock MSSQL instance are tagged `@mssql` in their `describe` block name, per this repo's existing tiering (see `docs/superpowers/plans/2026-08-18-e2e-playwright-testing.md`).

---

## File Structure

**New files:**
- `mssql-migrations/0004_pApiCrearArticuloInventario.sql` — new stored procedure.
- `lib/inventory/next-article-code.ts` — pure helper computing the suggested next `co_art` from a list of existing codes (unit-testable without a DB).
- `app/api/inventory/lookups/route.ts` — `GET`, returns Línea/Sub-línea/Categoría/Unidad option lists and the 6 production `saTipoAjuste` reasons.
- `app/api/inventory/items/next-code/route.ts` — `GET`, returns the suggested next `co_art`.
- `__tests__/integration/pApiCrearArticuloInventario.integration.test.ts` — direct SP integration tests.
- `__tests__/integration/inventory-lookups.integration.test.ts` — lookups route integration test.
- `__tests__/unit/next-article-code.test.ts` — pure unit test for the code-suggestion helper.
- `e2e/inventory-article-creation.spec.ts` — E2E for the create-article form.

**Modified files:**
- `app/api/inventory/adjustments/route.ts` — accept a second body shape (simple ajuste) alongside the existing recount shape.
- `app/(app)/inventario/ajustes/ajustes-client.tsx` — add a mode toggle and the simple-ajuste form.
- `app/api/inventory/items/route.ts` — add `POST` handler for article creation.
- `app/api/inventory/items/[co_art]/warehouses/route.ts` — extract its zero-stock-insert logic into an exported function so the new `POST /api/inventory/items` handler can call it directly (resolves the file's own flagged "unverified column list" comment as part of this work, since it's verified live in Task 1).
- `app/(app)/inventario/articulos/articulos-client.tsx` — add a "+ Crear artículo nuevo" panel.
- `e2e/inventory-adjustments.spec.ts` — add simple-ajuste E2E coverage.

No schema changes to SQLite (`lib/db/schema.ts`) — both features reuse `inventoryWarehouses` as-is.

---

### Task 1: Verify `saStockAlmacen` insert columns live, and extract shared warehouse-assignment logic

This resolves the pre-existing flagged risk comment in `warehouses/route.ts` (lines 52-63) before article creation depends on it more heavily, and produces a shared function the new `POST /api/inventory/items` handler needs.

**Files:**
- Modify: `app/api/inventory/items/[co_art]/warehouses/route.ts`

**Interfaces:**
- Produces: `export async function assignArticleToWarehouse(pool: sql.ConnectionPool, coArt: string, coAlma: string): Promise<{ ok: true } | { ok: false; status: number; error: string }>` — used by Task 5's `POST /api/inventory/items` handler.

- [ ] **Step 1: Query the live/mock DB for `saStockAlmacen`'s actual NOT NULL columns**

Run against the dev DB (use the same `DB_SERVER`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` env vars the integration tests use — check `.env` or the test config for values):

```bash
bun run -e '
import sql from "mssql";
const pool = await new sql.ConnectionPool({
  server: process.env.DB_SERVER, port: parseInt(process.env.DB_PORT ?? "1433"),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false" },
}).connect();
const r = await pool.request().query(`
  SELECT c.name, t.name AS type_name, c.is_nullable, dc.definition AS default_value
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
  WHERE c.object_id = OBJECT_ID("saStockAlmacen")
  ORDER BY c.column_id
`);
console.table(r.recordset);
await pool.close();
'
```

Expected: confirms whether `co_art, co_alma, tipo, stock` are the only NOT NULL columns without defaults, or whether more columns need to be supplied. Record the actual result in the comment replacing the flagged risk comment in Step 2.

- [ ] **Step 2: Extract the insert logic into an exported function, update the flagged comment with the verified result**

Replace the body of `app/api/inventory/items/[co_art]/warehouses/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

// Column list (co_art, co_alma, tipo, stock) verified live against sys.columns
// on the dev DB on 2026-08-26: these are the only NOT NULL saStockAlmacen
// columns without a default. Safe as a plain INSERT.
export async function assignArticleToWarehouse(
  pool: sql.ConnectionPool,
  coArt: string,
  coAlma: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT 1 FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  if (existing.recordset.length > 0) {
    return { ok: false, status: 400, error: 'El artículo ya tiene stock registrado en ese almacén' };
  }

  const article = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .query(`SELECT 1 FROM saArticulo WHERE co_art = @coArt AND anulado = 0`);
  if (article.recordset.length === 0) {
    return { ok: false, status: 404, error: 'Artículo no encontrado' };
  }

  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`INSERT INTO saStockAlmacen (co_art, co_alma, tipo, stock) VALUES (@coArt, @coAlma, 'ACT', 0)`);

  return { ok: true };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ co_art: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { co_art } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.coAlma !== 'string' || body.coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  const coAlma = body.coAlma.trim();

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const result = await assignArticleToWarehouse(pool, co_art, coAlma);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Add article to warehouse error:', error);
    return NextResponse.json({ error: 'Error al registrar el almacén en Profit Plus' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run the existing integration test to confirm the refactor didn't change behavior**

Run: `bun test __tests__/integration/inventory-add-to-warehouse.integration.test.ts`
Expected: all 3 existing tests still PASS unchanged (this is a pure refactor — same behavior, same status codes).

- [ ] **Step 4: Commit**

```bash
git add app/api/inventory/items/\[co_art\]/warehouses/route.ts
git commit -m "refactor: extract assignArticleToWarehouse, verify saStockAlmacen columns live"
```

---

### Task 2: `pApiCrearArticuloInventario` stored procedure + migration

**Files:**
- Create: `mssql-migrations/0004_pApiCrearArticuloInventario.sql`
- Test: `__tests__/integration/pApiCrearArticuloInventario.integration.test.ts`

**Interfaces:**
- Produces: stored procedure `pApiCrearArticuloInventario(@sCoArt CHAR(30), @sArtDes VARCHAR(120), @sTipo CHAR(1), @sCoLin CHAR(6), @sCoSubl CHAR(6), @sCoCat CHAR(6), @sCoUni CHAR(6), @sCoUsIn CHAR(6), @sCoSucuIn CHAR(6) = NULL)` — no output param, raises on failure, succeeds silently (mirrors how `pInsertarArticulo` itself returns nothing).

- [ ] **Step 1: Write the migration file**

```sql
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCrearArticuloInventario')
    DROP PROCEDURE pApiCrearArticuloInventario;
GO

CREATE PROCEDURE [pApiCrearArticuloInventario]
    (
      @sCoArt      CHAR(30),
      @sArtDes     VARCHAR(120),
      @sTipo       CHAR(1),
      @sCoLin      CHAR(6),
      @sCoSubl     CHAR(6),
      @sCoCat      CHAR(6),
      @sCoUni      CHAR(6),
      @sCoUsIn     CHAR(6),
      @sCoSucuIn   CHAR(6) = NULL
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF EXISTS (SELECT 1 FROM saArticulo WHERE co_art = @sCoArt)
        BEGIN
            RAISERROR('El código de artículo %s ya existe', 16, 1, @sCoArt);
        END

        EXEC pInsertarArticulo
            @sCo_Art = @sCoArt, @sdFecha_Reg = GETDATE(), @sArt_Des = @sArtDes,
            @sTipo = @sTipo, @bAnulado = 0,
            @sCo_Lin = @sCoLin, @sCo_Subl = @sCoSubl, @sCo_Cat = @sCoCat,
            @sCo_Color = 'GEN', @sCo_Ubicacion = '00001',
            @bGenerico = 0, @bManeja_Serial = 0, @bManeja_Lote = 0, @bManeja_Lote_Venc = 0,
            @deMargen_Min = 0, @deMargen_Max = 0,
            @sTipo_Imp = '1', @sTipo_Imp2 = '1', @sTipo_Imp3 = '1',
            @sCod_Proc = '',
            @sGarantia = '', @deVolumen = 0, @dePeso = 0,
            @deStock_Min = 0, @deStock_Max = 0, @deStock_Pedido = 0,
            @iRelac_Unidad = 0,
            @dePunt_Ven = 0, @dePunt_Cli = 0,
            @deLic_Mon_Ilc = 0, @deLic_Capacidad = 0, @deLic_Grado_Al = 0,
            @bPrec_Om = 1, @sTipo_Cos = '1',
            @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
            @sRevisado = 'N', @sTrasnfe = 'N';

        EXEC pInsertarUnidadArticuloRenglon
            @sCo_Art = @sCoArt, @sCo_Uni = @sCoUni, @iReng_Num = 1,
            @bRelacion = 0, @deEquivalencia = 1,
            @bUso_Venta = 1, @bUso_Compra = 1,
            @bUni_Principal = 1, @bUso_Principal = 1,
            @bUni_Secundaria = 0, @bUso_Secundaria = 0,
            @bUso_NumDecimales = 0, @iNum_Decimales = 0,
            @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
            @sRevisado = 'N', @sTrasnfe = 'N';

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0
            ROLLBACK TRAN;

        RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg);
        RETURN;
    END CATCH
END
GO
```

Notes on parameters vs. the spec's draft: `pInsertarArticulo` requires `@sTipo_Imp2`, `@sTipo_Imp3`, and `@sCod_Proc` (verified against `erp-knowledge-base/docs/procedures/pInsertarArticulo.md` — the spec's draft omitted these three required params). `pInsertarUnidadArticuloRenglon`'s exact parameter names are confirmed against `erp-knowledge-base/docs/procedures/pInsertarUnidadArticuloRenglon.md`'s live-read signature — `@sCo_Art, @sCo_Uni, @iReng_Num` order matches exactly (named params, so call-site order doesn't matter, but names must match exactly and they do).

- [ ] **Step 2: Run the migration against the dev DB**

Run: `bun run migrate:mssql`
Expected: output shows `0004_pApiCrearArticuloInventario.sql` applied, tracked in `dbo.__exporter_migrations`.

- [ ] **Step 3: Write the failing integration test**

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { runMigrations } from '@/scripts/migrate-mssql';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

let pool: sql.ConnectionPool;
const createdArticles: string[] = [];

async function callProcedure(params: {
  coArt: string; artDes: string; tipo: string; coLin: string; coSubl: string;
  coCat: string; coUni: string;
}) {
  const request = pool.request();
  request.input('sCoArt', sql.Char(30), params.coArt);
  request.input('sArtDes', sql.VarChar(120), params.artDes);
  request.input('sTipo', sql.Char(1), params.tipo);
  request.input('sCoLin', sql.Char(6), params.coLin);
  request.input('sCoSubl', sql.Char(6), params.coSubl);
  request.input('sCoCat', sql.Char(6), params.coCat);
  request.input('sCoUni', sql.Char(6), params.coUni);
  request.input('sCoUsIn', sql.Char(6), 'PROFIT');
  request.input('sCoSucuIn', sql.Char(6), null);
  return request.execute('pApiCrearArticuloInventario');
}

async function cleanupArticle(coArt: string): Promise<void> {
  await pool.request().input('a', sql.Char(30), coArt)
    .query(`DELETE FROM saStockAlmacen WHERE co_art = @a`);
  await pool.request().input('a', sql.Char(30), coArt)
    .query(`DELETE FROM saArtUnidad WHERE co_art = @a`);
  await pool.request().input('a', sql.Char(30), coArt)
    .query(`DELETE FROM saArticulo WHERE co_art = @a`);
}

async function nextTestCoArt(): Promise<string> {
  const result = await pool.request()
    .query(`SELECT MAX(TRY_CAST(co_art AS BIGINT)) AS maxCode FROM saArticulo WHERE TRY_CAST(co_art AS BIGINT) IS NOT NULL`);
  const next = Number(result.recordset[0].maxCode ?? 0) + 1;
  return String(next).padStart(7, '0');
}

async function realLookupRow(): Promise<{ coLin: string; coSubl: string; coCat: string; coUni: string }> {
  const linResult = await pool.request().query(`SELECT TOP 1 co_lin FROM saLineaArticulo`);
  const coLin = (linResult.recordset[0].co_lin as string).trim();
  const sublResult = await pool.request().input('lin', sql.Char(6), coLin)
    .query(`SELECT TOP 1 co_subl FROM saSubLinea WHERE co_lin = @lin`);
  const coSubl = (sublResult.recordset[0].co_subl as string).trim();
  const catResult = await pool.request().query(`SELECT TOP 1 co_cat FROM saCatArticulo`);
  const coCat = (catResult.recordset[0].co_cat as string).trim();
  const uniResult = await pool.request().query(`SELECT TOP 1 co_uni FROM saUnidad`);
  const coUni = (uniResult.recordset[0].co_uni as string).trim();
  return { coLin, coSubl, coCat, coUni };
}

beforeAll(async () => {
  await runMigrations();
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();
});

afterEach(async () => {
  while (createdArticles.length > 0) {
    await cleanupArticle(createdArticles.pop()!);
  }
});

afterAll(async () => {
  if (pool?.connected) await pool.close();
});

describe('pApiCrearArticuloInventario @mssql', () => {
  test('creates a saArticulo row and a matching single-unit saArtUnidad row', async () => {
    const coArt = await nextTestCoArt();
    const lookup = await realLookupRow();

    await callProcedure({
      coArt, artDes: 'Test Article Integration', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
    });
    createdArticles.push(coArt);

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT art_des, tipo, anulado, co_color, co_ubicacion FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(1);
    expect((articleCheck.recordset[0].art_des as string).trim()).toBe('Test Article Integration');
    expect((articleCheck.recordset[0].tipo as string).trim()).toBe('M');
    expect(articleCheck.recordset[0].anulado).toBe(false);
    expect((articleCheck.recordset[0].co_color as string).trim()).toBe('GEN');
    expect((articleCheck.recordset[0].co_ubicacion as string).trim()).toBe('00001');

    const unitCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT co_uni, relacion, equivalencia, uni_principal, uso_principal FROM saArtUnidad WHERE co_art = @a`);
    expect(unitCheck.recordset).toHaveLength(1);
    expect((unitCheck.recordset[0].co_uni as string).trim()).toBe(lookup.coUni);
    expect(unitCheck.recordset[0].relacion).toBe(false);
    expect(Number(unitCheck.recordset[0].equivalencia)).toBe(1);
    expect(unitCheck.recordset[0].uni_principal).toBe(true);
    expect(unitCheck.recordset[0].uso_principal).toBe(true);
  });

  test('rejects a duplicate co_art and leaves no partial insert', async () => {
    const coArt = await nextTestCoArt();
    const lookup = await realLookupRow();

    await callProcedure({
      coArt, artDes: 'First insert', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
    });
    createdArticles.push(coArt);

    await expect(callProcedure({
      coArt, artDes: 'Duplicate attempt', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
    })).rejects.toThrow();

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT art_des FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(1);
    expect((articleCheck.recordset[0].art_des as string).trim()).toBe('First insert');
  });

  test('a failure in the unit insert rolls back the article insert too', async () => {
    const coArt = await nextTestCoArt();
    const lookup = await realLookupRow();

    await expect(callProcedure({
      coArt, artDes: 'Should roll back', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat,
      coUni: 'NOEXIST',
    })).rejects.toThrow();

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT 1 FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run the tests to verify they pass against the now-deployed procedure**

Run: `bun test __tests__/integration/pApiCrearArticuloInventario.integration.test.ts`
Expected: all 3 tests PASS. If the "rolls back" test fails because `saUnidad`/`saArtUnidad` doesn't enforce a FK on `co_uni` (i.e. the bad code doesn't actually error), replace `'NOEXIST'` with a value verified live to violate a real constraint (check `saArtUnidad`'s FKs via `erp-knowledge-base/docs/tables/saArtUnidad.md` first) — do not leave the test silently vacuous.

- [ ] **Step 5: Commit**

```bash
git add mssql-migrations/0004_pApiCrearArticuloInventario.sql __tests__/integration/pApiCrearArticuloInventario.integration.test.ts
git commit -m "feat: add pApiCrearArticuloInventario stored procedure"
```

---

### Task 3: `lib/inventory/next-article-code.ts` helper + unit test

**Files:**
- Create: `lib/inventory/next-article-code.ts`
- Test: `__tests__/unit/next-article-code.test.ts`

**Interfaces:**
- Produces: `export function suggestNextArticleCode(existingCodes: string[]): string` — pure function, zero-pads to 7 digits, used by Task 4's lookups/next-code route.

- [ ] **Step 1: Write the failing unit test**

```typescript
import { describe, test, expect } from 'bun:test';
import { suggestNextArticleCode } from '@/lib/inventory/next-article-code';

describe('suggestNextArticleCode', () => {
  test('returns 0000001 when there are no existing codes', () => {
    expect(suggestNextArticleCode([])).toBe('0000001');
  });

  test('returns one past the highest numeric code, zero-padded to 7 digits', () => {
    expect(suggestNextArticleCode(['0000001', '0000166', '0000050'])).toBe('0000167');
  });

  test('ignores non-numeric codes when computing the max', () => {
    expect(suggestNextArticleCode(['0000010', 'ABC-1', '0000020'])).toBe('0000021');
  });

  test('pads past 7 digits without truncating once codes exceed 9999999', () => {
    expect(suggestNextArticleCode(['9999999'])).toBe('10000000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/unit/next-article-code.test.ts`
Expected: FAIL with "Cannot find module '@/lib/inventory/next-article-code'"

- [ ] **Step 3: Write the implementation**

```typescript
// co_art is a plain zero-padded sequential number in this database (verified
// live 2026-08-26: all 166 existing rows are 0000001..0000166, no line/type
// prefix). MAX(numeric co_art) + 1, zero-padded to 7 digits, is a safe
// suggestion — the caller must still re-check uniqueness server-side since
// this is only ever a pre-filled, user-editable suggestion.
export function suggestNextArticleCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const numeric = Number(code);
    if (Number.isInteger(numeric) && numeric > max) max = numeric;
  }
  const next = max + 1;
  return String(next).padStart(7, '0');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test __tests__/unit/next-article-code.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/inventory/next-article-code.ts __tests__/unit/next-article-code.test.ts
git commit -m "feat: add suggestNextArticleCode helper"
```

---

### Task 4: `GET /api/inventory/lookups` and `GET /api/inventory/items/next-code` routes

**Files:**
- Create: `app/api/inventory/lookups/route.ts`
- Create: `app/api/inventory/items/next-code/route.ts`
- Test: `__tests__/integration/inventory-lookups.integration.test.ts`

**Interfaces:**
- Consumes: `suggestNextArticleCode` from Task 3.
- Produces: `GET /api/inventory/lookups` → `{ lineas: {coLin, linDes}[], sublineas: {coLin, coSubl, sublDes}[], categorias: {coCat, catDes}[], unidades: {coUni, desUni}[], motivos: {coTipo, desTipo, tipoTrans}[] }`. `GET /api/inventory/items/next-code` → `{ nextCode: string }`. Both consumed by Task 6's create-article panel and Task 5's simple-ajuste form.

- [ ] **Step 1: Write `app/api/inventory/lookups/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

// Only the 6 production saTipoAjuste reasons are exposed — the two
// manual-recount codes (E00003/S00005) are reserved for the existing
// recount flow and never offered as a "simple ajuste" motivo.
const PRODUCTION_TIPO_AJUSTE_CODES = ['E00001', 'E00002', 'S00001', 'S00002', 'S00003', 'S00004'];

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const pool = await getPool();

    const [lineasResult, sublineasResult, categoriasResult, unidadesResult, motivosResult] = await Promise.all([
      pool.request().query(`SELECT co_lin, lin_des FROM saLineaArticulo ORDER BY lin_des`),
      pool.request().query(`SELECT co_lin, co_subl, subl_des FROM saSubLinea ORDER BY co_lin, subl_des`),
      pool.request().query(`SELECT co_cat, cat_des FROM saCatArticulo ORDER BY cat_des`),
      pool.request().query(`SELECT co_uni, des_uni FROM saUnidad ORDER BY des_uni`),
      pool.request().query(`
        SELECT co_tipo, des_tipo, tipo_trans FROM saTipoAjuste
        WHERE co_tipo IN ('${PRODUCTION_TIPO_AJUSTE_CODES.join("','")}')
        ORDER BY des_tipo
      `),
    ]);

    const lineas = trimStrings(lineasResult.recordset) as unknown as Array<{ co_lin: string; lin_des: string }>;
    const sublineas = trimStrings(sublineasResult.recordset) as unknown as Array<{ co_lin: string; co_subl: string; subl_des: string }>;
    const categorias = trimStrings(categoriasResult.recordset) as unknown as Array<{ co_cat: string; cat_des: string }>;
    const unidades = trimStrings(unidadesResult.recordset) as unknown as Array<{ co_uni: string; des_uni: string }>;
    const motivos = trimStrings(motivosResult.recordset) as unknown as Array<{ co_tipo: string; des_tipo: string; tipo_trans: string }>;

    return NextResponse.json({
      lineas: lineas.map(l => ({ coLin: l.co_lin, linDes: l.lin_des })),
      sublineas: sublineas.map(s => ({ coLin: s.co_lin, coSubl: s.co_subl, sublDes: s.subl_des })),
      categorias: categorias.map(c => ({ coCat: c.co_cat, catDes: c.cat_des })),
      unidades: unidades.map(u => ({ coUni: u.co_uni, desUni: u.des_uni })),
      motivos: motivos.map(m => ({ coTipo: m.co_tipo, desTipo: m.des_tipo, tipoTrans: m.tipo_trans })),
    });
  } catch (error) {
    console.error('Inventory lookups error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
```

Note: `PRODUCTION_TIPO_AJUSTE_CODES` is a fixed, hardcoded allowlist (not user input), so building the `IN (...)` clause via string interpolation here is safe — no injection surface.

- [ ] **Step 2: Write `app/api/inventory/items/next-code/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { suggestNextArticleCode } from '@/lib/inventory/next-article-code';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT co_art FROM saArticulo`);
    const codes = (result.recordset as Array<{ co_art: string }>).map(r => r.co_art.trim());
    return NextResponse.json({ nextCode: suggestNextArticleCode(codes) });
  } catch (error) {
    console.error('Inventory next-code error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write the integration test**

```typescript
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getLookups } from '@/app/api/inventory/lookups/route';
import { GET as getNextCode } from '@/app/api/inventory/items/next-code/route';

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

async function buildAuthedRequest(url: string): Promise<NextRequest> {
  resetSqliteDb();
  const db = getDb();
  const user = db.insert(users).values({
    email: 'lookups-test@e2e.test', passwordHash: 'x', name: 'Lookups Test', role: 'user',
    createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
  const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Lookups Test' });
  return new NextRequest(url, { headers: { Cookie: `session=${token}` } });
}

describe('GET /api/inventory/lookups @mssql', () => {
  afterAll(() => resetSqliteDb());

  test('returns non-empty lineas, categorias, unidades, and exactly 6 production motivos', async () => {
    const req = await buildAuthedRequest('http://localhost:3000/api/inventory/lookups');
    const res = await getLookups(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.lineas.length).toBeGreaterThan(0);
    expect(data.categorias.length).toBeGreaterThan(0);
    expect(data.unidades.length).toBeGreaterThan(0);
    expect(data.motivos).toHaveLength(6);
    const codes = data.motivos.map((m: { coTipo: string }) => m.coTipo).sort();
    expect(codes).toEqual(['E00001', 'E00002', 'S00001', 'S00002', 'S00003', 'S00004']);
  });

  test('every subLinea references a real linea code present in lineas', async () => {
    const req = await buildAuthedRequest('http://localhost:3000/api/inventory/lookups');
    const res = await getLookups(req);
    const data = await res.json();
    const lineaCodes = new Set(data.lineas.map((l: { coLin: string }) => l.coLin));
    for (const s of data.sublineas) {
      expect(lineaCodes.has(s.coLin)).toBe(true);
    }
  });

  test('returns 401 without a session', async () => {
    const req = new NextRequest('http://localhost:3000/api/inventory/lookups');
    const res = await getLookups(req);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inventory/items/next-code @mssql', () => {
  afterAll(() => resetSqliteDb());

  test('returns a 7-digit numeric code one past the current max', async () => {
    const pool = await new sql.ConnectionPool({
      server: process.env.DB_SERVER!, port: parseInt(process.env.DB_PORT ?? '1433'),
      database: process.env.DB_NAME!, user: process.env.DB_USER!, password: process.env.DB_PASSWORD!,
      options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false' },
    }).connect();
    const maxResult = await pool.request()
      .query(`SELECT MAX(TRY_CAST(co_art AS BIGINT)) AS maxCode FROM saArticulo WHERE TRY_CAST(co_art AS BIGINT) IS NOT NULL`);
    const expected = String(Number(maxResult.recordset[0].maxCode) + 1).padStart(7, '0');
    await pool.close();

    const req = await buildAuthedRequest('http://localhost:3000/api/inventory/items/next-code');
    const res = await getNextCode(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nextCode).toBe(expected);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `bun test __tests__/integration/inventory-lookups.integration.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/inventory/lookups/route.ts app/api/inventory/items/next-code/route.ts __tests__/integration/inventory-lookups.integration.test.ts
git commit -m "feat: add inventory lookups and next-article-code routes"
```

---

### Task 5: Extend `POST /api/inventory/adjustments` for simple ajuste

**Files:**
- Modify: `app/api/inventory/adjustments/route.ts`
- Test: `__tests__/integration/inventory-adjustments.integration.test.ts` (add new cases)

**Interfaces:**
- Consumes: existing `pApiCrearAjusteInventario` SP (unchanged).
- Produces: `POST /api/inventory/adjustments` now also accepts `{coTipo, coArt, coAlma, cantidad}` (simple ajuste), discriminated from the existing `{coArt, coAlma, countedStock}` (recount) by presence of `coTipo`. Response shape for the new path: `{ ok: true, ajueNum: string }` (no `delta`, since there's no recount math).

- [ ] **Step 1: Read the current recount-only test file's structure to match its conventions**

Run: `bun test __tests__/integration/inventory-adjustments.integration.test.ts` — confirm it currently passes before modifying (baseline).

- [ ] **Step 2: Write the failing test for the new body shape**

Add to `__tests__/integration/inventory-adjustments.integration.test.ts` (same file, alongside the existing recount tests — reuse its existing `pool`, `testArticle`/`WAREHOUSE` setup and `restoreStock`/cleanup helpers already defined there):

```typescript
describe('POST /api/inventory/adjustments — simple ajuste @mssql', () => {
  test('registers an entrada movement for the exact typed quantity, no delta math', async () => {
    const before = await getStock(testArticle.co_art, WAREHOUSE);
    const req = buildRequest(token, {
      coTipo: 'E00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 7,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ajueNum).toBeTruthy();

    const after = await getStock(testArticle.co_art, WAREHOUSE);
    expect(after).toBe(before + 7);

    await cleanupAjuste(data.ajueNum);
    await restoreStock(testArticle.co_art, WAREHOUSE, before);
  });

  test('registers a salida movement, decreasing stock by the exact typed quantity', async () => {
    const before = await getStock(testArticle.co_art, WAREHOUSE);
    const req = buildRequest(token, {
      coTipo: 'S00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 3,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const after = await getStock(testArticle.co_art, WAREHOUSE);
    expect(after).toBe(before - 3);

    await cleanupAjuste(data.ajueNum);
    await restoreStock(testArticle.co_art, WAREHOUSE, before);
  });

  test('rejects a salida that would push stock negative, leaving stock unchanged', async () => {
    const before = await getStock(testArticle.co_art, WAREHOUSE);
    const req = buildRequest(token, {
      coTipo: 'S00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: before + 1000,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(400);

    const after = await getStock(testArticle.co_art, WAREHOUSE);
    expect(after).toBe(before);
  });

  test('rejects a non-positive cantidad', async () => {
    const req = buildRequest(token, {
      coTipo: 'E00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 0,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(400);
  });

  test('rejects an unknown coTipo', async () => {
    const req = buildRequest(token, {
      coTipo: 'X99999', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 1,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(400);
  });
});
```

This assumes the existing test file already imports `POST as postAdjustment` from the route and has a `buildRequest(token, body)` helper and an authenticated `token` in scope from its existing `beforeAll` — if it doesn't already import the route handler directly (check first; it may currently only test the SP), add:
```typescript
import { POST as postAdjustment } from '@/app/api/inventory/adjustments/route';
```
and a `buildRequest` helper matching the pattern in `inventory-add-to-warehouse.integration.test.ts`'s `buildRequest`, plus the SQLite user/session setup from that same file's `beforeAll`.

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `bun test __tests__/integration/inventory-adjustments.integration.test.ts`
Expected: FAIL — route doesn't yet recognize `coTipo`/`cantidad`, so requests are treated as malformed recount bodies (400 on missing `countedStock`).

- [ ] **Step 4: Implement the route extension**

Replace `app/api/inventory/adjustments/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

// Manual-recount reasons seeded by mssql-migrations/0003 — E00003 is entrada
// (surplus found), S00005 is salida (shortage found). No other saTipoAjuste
// codes are exposed through the recount path.
const TIPO_SOBRANTE = 'E00003';
const TIPO_FALTANTE = 'S00005';

// The 6 production saTipoAjuste reasons the simple-ajuste path may use —
// mirrors app/api/inventory/lookups/route.ts's PRODUCTION_TIPO_AJUSTE_CODES.
const SIMPLE_AJUSTE_TIPOS = new Set(['E00001', 'E00002', 'S00001', 'S00002', 'S00003', 'S00004']);

// Fixed service-account identity — this app has no per-user Profit Plus
// login mapping. sucursal is null: the AJUS_NUM consecutive's saSerie row
// has a NULL co_sucu_in (verified live), and pConsecutivoProximoOutPut
// fails to resolve it against any non-null sucursal code.
const CO_US_IN = 'PROFIT';
const CO_SUCU_IN = null;

interface RecountBody {
  coArt:        unknown;
  coAlma:       unknown;
  countedStock: unknown;
}

interface SimpleAjusteBody {
  coTipo:   unknown;
  coArt:    unknown;
  coAlma:   unknown;
  cantidad: unknown;
}

async function checkWarehouseAllowed(coAlma: string): Promise<string | null> {
  const db = getDb();
  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return 'Almacén no configurado para Inventario';
  }
  return null;
}

async function callAdjustmentProcedure(
  motivo: string,
  lines: Array<{ co_tipo: string; co_art: string; co_alma: string; co_uni: string; total_art: number; permitir_negativo: boolean }>,
): Promise<string> {
  const pool = await getPool();
  const lineasTable = new sql.Table('AjusteInventarioLineaType');
  lineasTable.columns.add('co_tipo', sql.Char(6));
  lineasTable.columns.add('co_art', sql.Char(30));
  lineasTable.columns.add('co_alma', sql.Char(6));
  lineasTable.columns.add('co_uni', sql.Char(6));
  lineasTable.columns.add('total_art', sql.Decimal(18, 5));
  lineasTable.columns.add('cost_unit', sql.Decimal(18, 5));
  lineasTable.columns.add('permitir_negativo', sql.Bit);
  for (const line of lines) {
    lineasTable.rows.add(line.co_tipo, line.co_art, line.co_alma, line.co_uni, line.total_art, null, line.permitir_negativo);
  }

  const req = pool.request();
  req.input('sMotivo', sql.VarChar(80), motivo);
  req.input('dtFecha', sql.SmallDateTime, new Date());
  req.input('sCoUsIn', sql.Char(6), CO_US_IN);
  req.input('sCoSucuIn', sql.Char(6), CO_SUCU_IN);
  req.input('Lineas', lineasTable);
  req.output('sAjueNumOut', sql.Char(20));

  const result = await req.execute('pApiCrearAjusteInventario');
  return (result.output.sAjueNumOut as string).trim();
}

function isRaisedError500(error: unknown): { message: string } | null {
  if (typeof error === 'object' && error !== null && 'number' in error && (error as { number: unknown }).number === 50000) {
    const message = 'message' in error && typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : 'El stock cambió desde que se cargó esta página; vuelva a intentar';
    return { message };
  }
  return null;
}

async function handleRecount(body: RecountBody) {
  const { coArt, coAlma, countedStock } = body;
  if (typeof coArt !== 'string' || coArt.trim() === '') {
    return NextResponse.json({ error: 'Artículo requerido' }, { status: 400 });
  }
  if (typeof coAlma !== 'string' || coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  if (typeof countedStock !== 'number' || !isFinite(countedStock) || countedStock < 0) {
    return NextResponse.json({ error: 'Cantidad contada inválida' }, { status: 400 });
  }

  const warehouseError = await checkWarehouseAllowed(coAlma);
  if (warehouseError) return NextResponse.json({ error: warehouseError }, { status: 400 });

  try {
    const pool = await getPool();
    const articleResult = await pool.request()
      .input('coArt', sql.Char(30), coArt)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`
        SELECT TOP 1 au.co_uni, s.stock
        FROM saArtUnidad au
        JOIN saStockAlmacen s ON s.co_art = au.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
        JOIN saArticulo a ON a.co_art = au.co_art AND a.anulado = 0
        WHERE au.co_art = @coArt
      `);
    if (articleResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado en ese almacén' }, { status: 404 });
    }

    const coUni = (articleResult.recordset[0].co_uni as string).trim();
    const currentStock = Number(articleResult.recordset[0].stock);
    const delta = countedStock - currentStock;

    if (delta === 0) {
      return NextResponse.json({ error: 'La cantidad contada es igual al stock actual; no hay ajuste que registrar' }, { status: 400 });
    }

    const tipo = delta > 0 ? TIPO_SOBRANTE : TIPO_FALTANTE;
    const ajueNum = await callAdjustmentProcedure('Ajuste por conteo manual', [{
      co_tipo: tipo, co_art: coArt, co_alma: coAlma, co_uni: coUni,
      total_art: Math.abs(delta), permitir_negativo: false,
    }]);

    return NextResponse.json({ ok: true, ajueNum, delta });
  } catch (error) {
    const raised = isRaisedError500(error);
    if (raised) return NextResponse.json({ error: raised.message }, { status: 400 });
    console.error('Inventory adjustment error:', error);
    return NextResponse.json({ error: 'Error al registrar el ajuste en Profit Plus' }, { status: 500 });
  }
}

async function handleSimpleAjuste(body: SimpleAjusteBody) {
  const { coTipo, coArt, coAlma, cantidad } = body;
  if (typeof coTipo !== 'string' || !SIMPLE_AJUSTE_TIPOS.has(coTipo)) {
    return NextResponse.json({ error: 'Motivo inválido' }, { status: 400 });
  }
  if (typeof coArt !== 'string' || coArt.trim() === '') {
    return NextResponse.json({ error: 'Artículo requerido' }, { status: 400 });
  }
  if (typeof coAlma !== 'string' || coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  if (typeof cantidad !== 'number' || !isFinite(cantidad) || cantidad <= 0) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
  }

  const warehouseError = await checkWarehouseAllowed(coAlma);
  if (warehouseError) return NextResponse.json({ error: warehouseError }, { status: 400 });

  try {
    const pool = await getPool();
    const articleResult = await pool.request()
      .input('coArt', sql.Char(30), coArt)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`
        SELECT TOP 1 au.co_uni
        FROM saArtUnidad au
        JOIN saStockAlmacen s ON s.co_art = au.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
        JOIN saArticulo a ON a.co_art = au.co_art AND a.anulado = 0
        WHERE au.co_art = @coArt
      `);
    if (articleResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado en ese almacén' }, { status: 404 });
    }
    const coUni = (articleResult.recordset[0].co_uni as string).trim();

    const ajueNum = await callAdjustmentProcedure('Ajuste simple de movimiento', [{
      co_tipo: coTipo, co_art: coArt, co_alma: coAlma, co_uni: coUni,
      total_art: cantidad, permitir_negativo: false,
    }]);

    return NextResponse.json({ ok: true, ajueNum });
  } catch (error) {
    const raised = isRaisedError500(error);
    if (raised) return NextResponse.json({ error: raised.message }, { status: 400 });
    console.error('Inventory simple ajuste error:', error);
    return NextResponse.json({ error: 'Error al registrar el ajuste en Profit Plus' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  if ('coTipo' in body) {
    return handleSimpleAjuste(body as SimpleAjusteBody);
  }
  return handleRecount(body as RecountBody);
}
```

`permitir_negativo: false` for simple ajuste (unlike the spec's suggestion of "checked by default" for a UI checkbox) — no checkbox is exposed in the simple-ajuste form per the "form stays minimal" decision; negative-stock rejection is the safe default here since arbitrary reasons/quantities are user-typed with no computed delta to sanity-check against. This is a deliberate, tighter-than-recount default — flag it to the user in the plan handoff as a decision made, not derived from the spec.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test __tests__/integration/inventory-adjustments.integration.test.ts`
Expected: all tests (existing recount tests + new simple-ajuste tests) PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/inventory/adjustments/route.ts __tests__/integration/inventory-adjustments.integration.test.ts
git commit -m "feat: extend adjustments route with simple ajuste movement mode"
```

---

### Task 6: Simple-ajuste mode in `ajustes-client.tsx`

**Files:**
- Modify: `app/(app)/inventario/ajustes/ajustes-client.tsx`
- Test: `e2e/inventory-adjustments.spec.ts` (add new cases)

**Interfaces:**
- Consumes: `GET /api/inventory/lookups` (Task 4) for the `motivos` dropdown, `POST /api/inventory/adjustments` (Task 5) with `{coTipo, coArt, coAlma, cantidad}`.

- [ ] **Step 1: Write the failing E2E test**

Add to `e2e/inventory-adjustments.spec.ts`, inside the existing `test.describe('inventario/ajustes @mssql', ...)` block:

```typescript
test.describe('modo movimiento simple', () => {
  test('switching to simple mode hides the recount form and shows motivo/cantidad fields', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    await waitForRowsLoaded(userPage);

    await userPage.getByRole('tab', { name: 'Movimiento simple' }).click();
    await expect(userPage.getByLabel('Motivo')).toBeVisible();
    await expect(userPage.getByLabel('Cantidad')).toBeVisible();
    await expect(userPage.getByLabel('Stock contado')).not.toBeVisible();
  });

  test('submit is disabled until motivo, artículo, almacén, and cantidad are all set', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    await waitForRowsLoaded(userPage);
    await userPage.getByRole('tab', { name: 'Movimiento simple' }).click();

    const submitButton = userPage.getByRole('button', { name: 'Registrar Movimiento' });
    await expect(submitButton).toBeDisabled();

    await userPage.getByLabel('Motivo').selectOption({ label: 'Entrada Producción' });
    await expect(submitButton).toBeDisabled();

    await selectFirstRow(userPage);
    await expect(submitButton).toBeDisabled();

    await userPage.getByLabel('Cantidad').fill('5');
    await expect(submitButton).toBeEnabled();
  });

  test('registering an entrada then an equal salida nets stock back to its original value', async ({ userPage }) => {
    await userPage.goto('/inventario/ajustes');
    const rowCount = await waitForRowsLoaded(userPage);
    test.skip(rowCount < 1, 'No artículo/almacén rows available in this data');

    await userPage.getByRole('tab', { name: 'Movimiento simple' }).click();
    await selectFirstRow(userPage);
    const stockText = await userPage.locator('[aria-label="Stock actual"]').textContent();
    const originalStock = Number(stockText?.trim());

    await userPage.getByLabel('Motivo').selectOption({ label: 'Entrada Producción' });
    await userPage.getByLabel('Cantidad').fill('4');
    await userPage.getByRole('button', { name: 'Registrar Movimiento' }).click();
    await expect(userPage.getByText(/^Movimiento .* registrado/)).toBeVisible({ timeout: 15_000 });

    await userPage.getByLabel('Motivo').selectOption({ label: 'Salida' });
    await userPage.getByLabel('Cantidad').fill('4');
    await userPage.getByRole('button', { name: 'Registrar Movimiento' }).click();
    await expect(userPage.getByText(/^Movimiento .* registrado/)).toBeVisible({ timeout: 15_000 });

    await userPage.reload();
    await userPage.getByRole('tab', { name: 'Movimiento simple' }).click();
    await selectFirstRow(userPage);
    const finalStockText = await userPage.locator('[aria-label="Stock actual"]').textContent();
    expect(Number(finalStockText?.trim())).toBe(originalStock);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx playwright test e2e/inventory-adjustments.spec.ts -g "modo movimiento simple"`
Expected: FAIL — no "Movimiento simple" tab exists yet.

- [ ] **Step 3: Implement the mode toggle and simple-ajuste form**

Replace `app/(app)/inventario/ajustes/ajustes-client.tsx` with (recount-mode logic unchanged, simple-ajuste mode added):

```typescript
'use client';

import { useState, useEffect, useMemo } from 'react';
import { HistorialClient } from './historial-client';

interface Item {
  coArt:  string;
  artDes: string;
  coAlma: string;
  stock:  number;
  unidad: string | null;
}

interface Motivo {
  coTipo:  string;
  desTipo: string;
}

interface AdjustmentResult {
  ajueNum: string;
  delta:   number;
}

interface SimpleResult {
  ajueNum: string;
}

interface Props {
  initialCoArt?: string;
  initialCoAlma?: string;
}

type Mode = 'recount' | 'simple';

function rowKey(item: Item): string {
  return `${item.coArt}::${item.coAlma}`;
}

// Case- and accent-insensitive so "camara" matches "Cámara" — Spanish
// article names routinely carry accents a user won't bother typing.
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matchesSearch(item: Item, query: string): boolean {
  const q = normalize(query.trim());
  if (q === '') return true;
  return normalize(item.coArt).includes(q) || normalize(item.artDes).includes(q);
}

export function AjustesClient({ initialCoArt, initialCoAlma }: Props) {
  const [mode, setMode] = useState<Mode>('recount');

  const [items, setItems]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [selectedMotivo, setSelectedMotivo] = useState('');

  const [search, setSearch]           = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [countedStock, setCountedStock] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdjustmentResult | null>(null);
  const [lastSimpleResult, setLastSimpleResult] = useState<SimpleResult | null>(null);
  const [historyReloadToken, setHistoryReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const res = await fetch('/api/inventory/items');
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setLoadError(data.error ?? 'No se pudo cargar la lista de artículos');
          return;
        }
        const data: Item[] = await res.json();
        if (cancelled) return;
        setItems(data);
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMotivos() {
      try {
        const res = await fetch('/api/inventory/lookups');
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setMotivos(data.motivos ?? []);
      } catch {
        // Non-fatal: the motivo dropdown just stays empty; the user can retry by switching modes.
      }
    }
    loadMotivos();
    return () => { cancelled = true; };
  }, []);

  const filteredItems = useMemo(
    () => items.filter(item => matchesSearch(item, search)),
    [items, search],
  );

  // The URL-preselected article (if any) is derived during render rather
  // than copied into state via an effect: selectedKey stays empty until
  // the user explicitly picks a row (handleSelectRow), and effectiveKey
  // falls back to the URL params only while that hasn't happened yet, so
  // an explicit selection always wins even if it later differs from the
  // URL. This avoids the react-hooks/set-state-in-effect cascading-render
  // pattern an effect-based version of this preselection would trigger.
  const initialKey = initialCoArt && initialCoAlma ? `${initialCoArt}::${initialCoAlma}` : '';
  const effectiveKey = selectedKey || initialKey;

  const selected = useMemo(
    () => items.find(item => rowKey(item) === effectiveKey) ?? null,
    [items, effectiveKey],
  );

  function handleSelectRow(item: Item) {
    setSelectedKey(rowKey(item));
    setCountedStock('');
    setCantidad('');
    setLastResult(null);
    setLastSimpleResult(null);
    setFormError(null);
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setFormError(null);
    setLastResult(null);
    setLastSimpleResult(null);
  }

  const countedValue = countedStock === '' ? null : Number(countedStock);
  const delta = selected && countedValue !== null && isFinite(countedValue)
    ? countedValue - selected.stock
    : null;

  const cantidadValue = cantidad === '' ? null : Number(cantidad);

  async function handleSubmitRecount() {
    if (!selected || countedValue === null || !isFinite(countedValue)) return;

    setSubmitting(true);
    setFormError(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          coArt:        selected.coArt,
          coAlma:       selected.coAlma,
          countedStock: countedValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? 'No se pudo registrar el ajuste');
        return;
      }

      setItems(prev => prev.map(item => rowKey(item) === effectiveKey
        ? { ...item, stock: countedValue }
        : item,
      ));
      setLastResult({ ajueNum: data.ajueNum, delta: data.delta });
      setHistoryReloadToken(t => t + 1);
      setCountedStock('');
    } catch {
      setFormError('No se pudo conectar con el servidor');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitSimple() {
    if (!selected || !selectedMotivo || cantidadValue === null || !isFinite(cantidadValue) || cantidadValue <= 0) return;

    setSubmitting(true);
    setFormError(null);
    setLastSimpleResult(null);
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          coTipo:   selectedMotivo,
          coArt:    selected.coArt,
          coAlma:   selected.coAlma,
          cantidad: cantidadValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? 'No se pudo registrar el movimiento');
        return;
      }

      const motivo = motivos.find(m => m.coTipo === selectedMotivo);
      const isEntrada = motivo?.desTipo != null; // direction is server-derived; refetch stock to reflect the true new value
      void isEntrada;
      const itemsRes = await fetch('/api/inventory/items');
      if (itemsRes.ok) setItems(await itemsRes.json());

      setLastSimpleResult({ ajueNum: data.ajueNum });
      setHistoryReloadToken(t => t + 1);
      setCantidad('');
    } catch {
      setFormError('No se pudo conectar con el servidor');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando artículos…</div>;
  }

  const inputClass = `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ajustes de Inventario</h1>

      <div role="tablist" className="flex gap-2 border-b border-gray-200">
        <button
          role="tab"
          aria-selected={mode === 'recount'}
          onClick={() => handleModeChange('recount')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${mode === 'recount' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Conteo manual
        </button>
        <button
          role="tab"
          aria-selected={mode === 'simple'}
          onClick={() => handleModeChange('simple')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${mode === 'simple' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Movimiento simple
        </button>
      </div>

      <p className="text-sm text-gray-500">
        {mode === 'recount'
          ? 'Busca un artículo, selecciónalo de la tabla y registra el stock físicamente contado. El sistema calcula la diferencia contra el stock actual en Profit Plus y registra un ajuste de sobrante o faltante según corresponda.'
          : 'Registra directamente una cantidad que entró o salió — sin recontar el stock total. Elige el motivo, el artículo, el almacén y la cantidad exacta del movimiento.'}
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {loadError}
        </p>
      )}

      {mode === 'simple' && (
        <div>
          <label htmlFor="motivo-select" className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
          <select
            id="motivo-select"
            value={selectedMotivo}
            onChange={e => { setSelectedMotivo(e.target.value); setLastSimpleResult(null); setFormError(null); }}
            className={`${inputClass} max-w-sm`}
          >
            <option value="">Selecciona…</option>
            {motivos.map(m => <option key={m.coTipo} value={m.coTipo}>{m.desTipo}</option>)}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="ajustes-search" className="block text-xs font-medium text-gray-700 mb-1">
          Buscar artículo
        </label>
        <input
          id="ajustes-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Código o nombre…"
          className={`${inputClass} max-w-sm`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-gray-200">
              {['Código', 'Nombre', 'Almacén', 'Stock', 'Unidad'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100" role="listbox" aria-label="Artículos">
            {filteredItems.map(item => {
              const key = rowKey(item);
              const isSelected = key === effectiveKey;
              return (
                <tr
                  key={key}
                  onClick={() => handleSelectRow(item)}
                  role="option"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRow(item); } }}
                  aria-selected={isSelected}
                  className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{item.coArt}</td>
                  <td className="px-3 py-2 text-gray-900">{item.artDes}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.coAlma}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.stock}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.unidad?.trim() || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No hay artículos que coincidan con la búsqueda.
          </div>
        )}
      </div>

      {selected && mode === 'recount' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="text-sm text-gray-700">
            Ajustando <span className="font-semibold">{selected.coArt} — {selected.artDes}</span> en
            almacén <span className="font-semibold">{selected.coAlma}</span>.
            Stock actual en Profit Plus: <span aria-label="Stock actual" className="font-semibold">{selected.stock}</span>
          </div>

          <div>
            <label htmlFor="stock-contado" className="block text-xs font-medium text-gray-700 mb-1">Stock contado</label>
            <input
              id="stock-contado"
              type="number"
              value={countedStock}
              onChange={e => { setCountedStock(e.target.value); setLastResult(null); setFormError(null); }}
              className={`${inputClass} w-40`}
            />
          </div>

          {delta !== null && delta !== 0 && (
            <p className="text-sm text-gray-600">
              {delta > 0
                ? <>Se registrará un <span className="font-semibold text-green-700">sobrante de {delta}</span>.</>
                : <>Se registrará un <span className="font-semibold text-red-700">faltante de {Math.abs(delta)}</span>.</>}
            </p>
          )}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {formError}
            </p>
          )}

          {lastResult && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Ajuste {lastResult.ajueNum} registrado
              ({lastResult.delta > 0 ? `sobrante de ${lastResult.delta}` : `faltante de ${Math.abs(lastResult.delta)}`}).
            </p>
          )}

          <button
            onClick={handleSubmitRecount}
            disabled={submitting || countedValue === null || !isFinite(countedValue) || delta === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
          >
            {submitting ? 'Registrando…' : 'Registrar Ajuste'}
          </button>
        </div>
      )}

      {selected && mode === 'simple' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="text-sm text-gray-700">
            Registrando movimiento de <span className="font-semibold">{selected.coArt} — {selected.artDes}</span> en
            almacén <span className="font-semibold">{selected.coAlma}</span>.
            Stock actual en Profit Plus: <span aria-label="Stock actual" className="font-semibold">{selected.stock}</span>
          </div>

          <div>
            <label htmlFor="cantidad-simple" className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
            <input
              id="cantidad-simple"
              type="number"
              value={cantidad}
              onChange={e => { setCantidad(e.target.value); setLastSimpleResult(null); setFormError(null); }}
              className={`${inputClass} w-40`}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {formError}
            </p>
          )}

          {lastSimpleResult && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Movimiento {lastSimpleResult.ajueNum} registrado.
            </p>
          )}

          <button
            onClick={handleSubmitSimple}
            disabled={submitting || !selectedMotivo || cantidadValue === null || !isFinite(cantidadValue) || cantidadValue <= 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
          >
            {submitting ? 'Registrando…' : 'Registrar Movimiento'}
          </button>
        </div>
      )}

      <HistorialClient reloadToken={historyReloadToken} />
    </div>
  );
}
```

- [ ] **Step 4: Run the E2E tests to verify they pass**

Run: `bunx playwright test e2e/inventory-adjustments.spec.ts`
Expected: all tests (existing recount tests + new simple-mode tests) PASS. Recall this repo's E2E suite runs against a production build (`next build && next start`), not `next dev` — rebuild first if the dev server was running instead.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/inventario/ajustes/ajustes-client.tsx e2e/inventory-adjustments.spec.ts
git commit -m "feat: add simple ajuste mode to the ajustes page"
```

---

### Task 7: `POST /api/inventory/items` for article creation

**Files:**
- Modify: `app/api/inventory/items/route.ts`
- Test: `__tests__/integration/inventory-items.integration.test.ts` (add new cases)

**Interfaces:**
- Consumes: `pApiCrearArticuloInventario` (Task 2), `assignArticleToWarehouse` (Task 1).
- Produces: `POST /api/inventory/items` accepting `{coArt, artDes, tipo, coLin, coSubl, coCat, coUni, coAlma}` → `{ ok: true, coArt: string }` on success, or a 207-style partial-success shape when article creation succeeds but warehouse assignment fails: `{ ok: true, coArt: string, warehouseError: string }` (still HTTP 200 — the article does exist, so this isn't a failure response).

- [ ] **Step 1: Write the failing test**

Add to `__tests__/integration/inventory-items.integration.test.ts` (reuse its existing pool/auth setup pattern — check the file first for its existing `beforeAll`/`buildRequest` conventions and match them):

```typescript
describe('POST /api/inventory/items @mssql', () => {
  const createdArticles: string[] = [];

  afterEach(async () => {
    while (createdArticles.length > 0) {
      const coArt = createdArticles.pop()!;
      await pool.request().input('a', sql.Char(30), coArt).query(`DELETE FROM saStockAlmacen WHERE co_art = @a`);
      await pool.request().input('a', sql.Char(30), coArt).query(`DELETE FROM saArtUnidad WHERE co_art = @a`);
      await pool.request().input('a', sql.Char(30), coArt).query(`DELETE FROM saArticulo WHERE co_art = @a`);
    }
  });

  test('creates an article and assigns it to the given warehouse at 0 stock', async () => {
    const lookup = await realLookupRow(); // helper: fetches a real co_lin/co_subl/co_cat/co_uni, same as pApiCrearArticuloInventario's own test
    const nextCodeResult = await pool.request()
      .query(`SELECT MAX(TRY_CAST(co_art AS BIGINT)) AS maxCode FROM saArticulo WHERE TRY_CAST(co_art AS BIGINT) IS NOT NULL`);
    const coArt = String(Number(nextCodeResult.recordset[0].maxCode) + 1).padStart(7, '0');

    const req = buildAuthedRequest('http://localhost:3000/api/inventory/items', {
      coArt, artDes: 'Nuevo Producto Test', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
      coAlma: TEST_WAREHOUSE,
    });
    const res = await postItems(await req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.coArt).toBe(coArt);
    createdArticles.push(coArt);

    const stockCheck = await pool.request().input('a', sql.Char(30), coArt).input('w', sql.Char(6), TEST_WAREHOUSE)
      .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @a AND co_alma = @w AND tipo = 'ACT'`);
    expect(stockCheck.recordset).toHaveLength(1);
    expect(Number(stockCheck.recordset[0].stock)).toBe(0);
  });

  test('rejects an already-existing co_art with a 400', async () => {
    const lookup = await realLookupRow();
    const existingResult = await pool.request().query(`SELECT TOP 1 co_art FROM saArticulo`);
    const existingCoArt = (existingResult.recordset[0].co_art as string).trim();

    const req = buildAuthedRequest('http://localhost:3000/api/inventory/items', {
      coArt: existingCoArt, artDes: 'Duplicate', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
      coAlma: TEST_WAREHOUSE,
    });
    const res = await postItems(await req);
    expect(res.status).toBe(400);
  });

  test('rejects a warehouse not in the configured allowlist', async () => {
    const lookup = await realLookupRow();
    const nextCodeResult = await pool.request()
      .query(`SELECT MAX(TRY_CAST(co_art AS BIGINT)) AS maxCode FROM saArticulo WHERE TRY_CAST(co_art AS BIGINT) IS NOT NULL`);
    const coArt = String(Number(nextCodeResult.recordset[0].maxCode) + 1).padStart(7, '0');

    const req = buildAuthedRequest('http://localhost:3000/api/inventory/items', {
      coArt, artDes: 'Should not be created', tipo: 'M',
      coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
      coAlma: '999999',
    });
    const res = await postItems(await req);
    expect(res.status).toBe(400);

    const articleCheck = await pool.request().input('a', sql.Char(30), coArt).query(`SELECT 1 FROM saArticulo WHERE co_art = @a`);
    expect(articleCheck.recordset).toHaveLength(0);
  });

  test('returns 401 without a session', async () => {
    const req = new NextRequest('http://localhost:3000/api/inventory/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await postItems(req);
    expect(res.status).toBe(401);
  });
});
```

Add `import { POST as postItems } from '@/app/api/inventory/items/route';` alongside the file's existing `GET` import, and a `realLookupRow` helper matching the one from Task 2's test (fetch a real `co_lin`/`co_subl`/`co_cat`/`co_uni` combination) if the file doesn't already define one.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test __tests__/integration/inventory-items.integration.test.ts`
Expected: FAIL — no `POST` export yet.

- [ ] **Step 3: Implement `POST` in `app/api/inventory/items/route.ts`**

Add to the existing file (keep the existing `GET` unchanged), importing `assignArticleToWarehouse` from Task 1:

```typescript
import { assignArticleToWarehouse } from './[co_art]/warehouses/route';

interface CreateArticleBody {
  coArt:  unknown;
  artDes: unknown;
  tipo:   unknown;
  coLin:  unknown;
  coSubl: unknown;
  coCat:  unknown;
  coUni:  unknown;
  coAlma: unknown;
}

const VALID_TIPOS = new Set(['V', 'M', 'S', 'C', 'E']);

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null) as CreateArticleBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const { coArt, artDes, tipo, coLin, coSubl, coCat, coUni, coAlma } = body;
  if (typeof coArt !== 'string' || coArt.trim() === '' || coArt.length > 30) {
    return NextResponse.json({ error: 'Código de artículo inválido' }, { status: 400 });
  }
  if (typeof artDes !== 'string' || artDes.trim() === '' || artDes.length > 120) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
  }
  if (typeof tipo !== 'string' || !VALID_TIPOS.has(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }
  if (typeof coLin !== 'string' || coLin.trim() === '') {
    return NextResponse.json({ error: 'Línea requerida' }, { status: 400 });
  }
  if (typeof coSubl !== 'string' || coSubl.trim() === '') {
    return NextResponse.json({ error: 'Sub-línea requerida' }, { status: 400 });
  }
  if (typeof coCat !== 'string' || coCat.trim() === '') {
    return NextResponse.json({ error: 'Categoría requerida' }, { status: 400 });
  }
  if (typeof coUni !== 'string' || coUni.trim() === '') {
    return NextResponse.json({ error: 'Unidad requerida' }, { status: 400 });
  }
  if (typeof coAlma !== 'string' || coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const req = pool.request();
    req.input('sCoArt', sql.Char(30), coArt);
    req.input('sArtDes', sql.VarChar(120), artDes);
    req.input('sTipo', sql.Char(1), tipo);
    req.input('sCoLin', sql.Char(6), coLin);
    req.input('sCoSubl', sql.Char(6), coSubl);
    req.input('sCoCat', sql.Char(6), coCat);
    req.input('sCoUni', sql.Char(6), coUni);
    req.input('sCoUsIn', sql.Char(6), 'PROFIT');
    req.input('sCoSucuIn', sql.Char(6), null);
    await req.execute('pApiCrearArticuloInventario');

    const warehouseResult = await assignArticleToWarehouse(pool, coArt, coAlma);
    if (!warehouseResult.ok) {
      return NextResponse.json({
        ok: true,
        coArt,
        warehouseError: `Artículo creado, pero no se pudo asignar al almacén: ${warehouseResult.error}`,
      });
    }

    return NextResponse.json({ ok: true, coArt });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'number' in error && (error as { number: unknown }).number === 50000) {
      const message = 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'No se pudo crear el artículo';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Article creation error:', error);
    return NextResponse.json({ error: 'Error al crear el artículo en Profit Plus' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test __tests__/integration/inventory-items.integration.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/inventory/items/route.ts __tests__/integration/inventory-items.integration.test.ts
git commit -m "feat: add POST /api/inventory/items for article creation"
```

---

### Task 8: "+ Crear artículo nuevo" panel in `articulos-client.tsx`

**Files:**
- Modify: `app/(app)/inventario/articulos/articulos-client.tsx`
- Create: `e2e/inventory-article-creation.spec.ts`

**Interfaces:**
- Consumes: `GET /api/inventory/lookups`, `GET /api/inventory/items/next-code`, `POST /api/inventory/items` (all from earlier tasks).

- [ ] **Step 1: Write the failing E2E test**

```typescript
import { test, expect } from './fixtures';

// @mssql — submitting the create-article form calls pApiCrearArticuloInventario
// and the warehouse-assignment endpoint against the real Ncake_a database via
// the profitplus-erp-mock container. This spec creates one real, permanent
// test article per run (Profit Plus has no article-deletion flow, matching
// the accepted "harmless audit noise" precedent in inventory-adjustments.spec.ts) —
// named distinctly so it's identifiable as test data if ever audited.

test.describe('inventario/articulos — crear artículo @mssql', () => {
  test('form validation: submit disabled until all required fields are filled', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: '+ Crear artículo nuevo' }).click();

    const submitButton = userPage.getByRole('button', { name: 'Crear artículo' });
    await expect(submitButton).toBeDisabled();

    await expect(userPage.getByLabel('Código')).not.toHaveValue('');

    await userPage.getByLabel('Nombre').fill('Producto E2E Test');
    await expect(submitButton).toBeDisabled();

    await userPage.getByLabel('Tipo').selectOption('M');
    await expect(submitButton).toBeDisabled();

    const lineaSelect = userPage.getByLabel('Línea');
    await expect(lineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    const lineaOptions = await lineaSelect.locator('option').all();
    await lineaSelect.selectOption({ index: 1 });
    void lineaOptions;
    await expect(submitButton).toBeDisabled();

    const sublineaSelect = userPage.getByLabel('Sub-línea');
    await expect(sublineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    await sublineaSelect.selectOption({ index: 1 });
    await expect(submitButton).toBeDisabled();

    await userPage.getByLabel('Categoría').selectOption({ index: 1 });
    await expect(submitButton).toBeDisabled();

    await userPage.getByLabel('Unidad').selectOption({ index: 1 });
    await expect(submitButton).toBeDisabled();

    await userPage.getByLabel('Almacén inicial').selectOption({ index: 1 });
    await expect(submitButton).toBeEnabled();
  });

  test('Sub-línea options are empty until a Línea is chosen', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: '+ Crear artículo nuevo' }).click();

    const sublineaSelect = userPage.getByLabel('Sub-línea');
    await expect(sublineaSelect.locator('option')).toHaveCount(1); // just the placeholder

    const lineaSelect = userPage.getByLabel('Línea');
    await expect(lineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    await lineaSelect.selectOption({ index: 1 });

    await expect(sublineaSelect.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
  });

  test('creating an article makes it appear in the items list at 0 stock', async ({ userPage }) => {
    await userPage.goto('/inventario/articulos');
    await userPage.getByRole('button', { name: '+ Crear artículo nuevo' }).click();

    const codigoInput = userPage.getByLabel('Código');
    const suggestedCode = await codigoInput.inputValue();
    expect(suggestedCode).toMatch(/^\d{7,}$/);

    const uniqueName = `Producto E2E Test ${Date.now()}`;
    await userPage.getByLabel('Nombre').fill(uniqueName);
    await userPage.getByLabel('Tipo').selectOption('M');
    await userPage.getByLabel('Línea').selectOption({ index: 1 });
    await expect(userPage.getByLabel('Sub-línea').locator('option')).not.toHaveCount(1, { timeout: 15_000 });
    await userPage.getByLabel('Sub-línea').selectOption({ index: 1 });
    await userPage.getByLabel('Categoría').selectOption({ index: 1 });
    await userPage.getByLabel('Unidad').selectOption({ index: 1 });
    await userPage.getByLabel('Almacén inicial').selectOption({ index: 1 });

    await userPage.getByRole('button', { name: 'Crear artículo' }).click();
    await expect(userPage.getByText(/Artículo .* creado/)).toBeVisible({ timeout: 15_000 });

    await userPage.reload();
    const newRow = userPage.locator('tr', { hasText: uniqueName });
    await expect(newRow).toBeVisible({ timeout: 15_000 });
    await expect(newRow.locator('td').nth(4)).toHaveText('0');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx playwright test e2e/inventory-article-creation.spec.ts`
Expected: FAIL — no "+ Crear artículo nuevo" button exists yet.

- [ ] **Step 3: Add the panel to `articulos-client.tsx`**

Add these imports and state near the top of the existing component (alongside the existing `showAddToWarehouse` state):

```typescript
interface Lookups {
  lineas:     Array<{ coLin: string; linDes: string }>;
  sublineas:  Array<{ coLin: string; coSubl: string; sublDes: string }>;
  categorias: Array<{ coCat: string; catDes: string }>;
  unidades:   Array<{ coUni: string; desUni: string }>;
}

const TIPO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'M', label: 'Materia Prima' },
  { value: 'V', label: 'Venta' },
  { value: 'S', label: 'Servicio' },
  { value: 'C', label: 'Consumo Interno' },
  { value: 'E', label: 'Existencia' },
];
```

Add state inside `ArticulosClient`:

```typescript
const [showCreateArticle, setShowCreateArticle] = useState(false);
const [lookups, setLookups] = useState<Lookups | null>(null);
const [newCoArt, setNewCoArt] = useState('');
const [newArtDes, setNewArtDes] = useState('');
const [newTipo, setNewTipo] = useState('');
const [newCoLin, setNewCoLin] = useState('');
const [newCoSubl, setNewCoSubl] = useState('');
const [newCoCat, setNewCoCat] = useState('');
const [newCoUni, setNewCoUni] = useState('');
const [newCoAlma, setNewCoAlma] = useState('');
const [creatingArticle, setCreatingArticle] = useState(false);
const [createError, setCreateError] = useState<string | null>(null);
const [createSuccess, setCreateSuccess] = useState<string | null>(null);

async function openCreateArticle() {
  setShowCreateArticle(v => !v);
  if (showCreateArticle || lookups) return;
  const [lookupsRes, nextCodeRes] = await Promise.all([
    fetch('/api/inventory/lookups'),
    fetch('/api/inventory/items/next-code'),
  ]);
  if (lookupsRes.ok) setLookups(await lookupsRes.json());
  if (nextCodeRes.ok) {
    const data = await nextCodeRes.json();
    setNewCoArt(data.nextCode);
  }
}

const sublineaOptions = useMemo(
  () => lookups?.sublineas.filter(s => s.coLin === newCoLin) ?? [],
  [lookups, newCoLin],
);

const canCreateArticle = newCoArt.trim() !== '' && newArtDes.trim() !== '' && newTipo !== ''
  && newCoLin !== '' && newCoSubl !== '' && newCoCat !== '' && newCoUni !== '' && newCoAlma !== '';

async function handleCreateArticle() {
  setCreatingArticle(true);
  setCreateError(null);
  setCreateSuccess(null);
  try {
    const res = await fetch('/api/inventory/items', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        coArt: newCoArt, artDes: newArtDes, tipo: newTipo,
        coLin: newCoLin, coSubl: newCoSubl, coCat: newCoCat, coUni: newCoUni,
        coAlma: newCoAlma,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCreateError(data.error ?? 'No se pudo crear el artículo');
      return;
    }
    if (data.warehouseError) {
      setCreateError(data.warehouseError);
    } else {
      setCreateSuccess(`Artículo ${data.coArt} creado`);
    }
    const listRes = await fetch('/api/inventory/items');
    if (listRes.ok) setItems(await listRes.json());
    setNewArtDes(''); setNewTipo(''); setNewCoLin(''); setNewCoSubl('');
    setNewCoCat(''); setNewCoUni(''); setNewCoAlma('');
    const nextCodeRes = await fetch('/api/inventory/items/next-code');
    if (nextCodeRes.ok) setNewCoArt((await nextCodeRes.json()).nextCode);
  } catch {
    setCreateError('No se pudo conectar con el servidor');
  } finally {
    setCreatingArticle(false);
  }
}
```

Add the panel JSX right after the existing "+ Agregar artículo existente a un almacén" panel's closing `</div>` (still inside the same wrapping `bg-white border ... rounded-lg p-4` container, or as a sibling panel with identical styling):

```tsx
<div className="bg-white border border-gray-200 rounded-lg p-4">
  <button
    onClick={openCreateArticle}
    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
  >
    {showCreateArticle ? 'Cancelar' : '+ Crear artículo nuevo'}
  </button>

  {showCreateArticle && (
    <div className="mt-4 space-y-3 max-w-2xl">
      <p className="text-sm text-gray-500">
        Para un producto nuevo que aún no existe en Profit Plus. Se registra sin
        pricing, fiscal, ni stock inicial — el artículo queda con stock 0 en el
        almacén elegido; usa Ajustes para registrar la entrada real después.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="new-co-art" className="block text-xs font-medium text-gray-700 mb-1">Código</label>
          <input id="new-co-art" value={newCoArt} onChange={e => setNewCoArt(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-art-des" className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
          <input id="new-art-des" value={newArtDes} onChange={e => setNewArtDes(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-tipo" className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
          <select id="new-tipo" value={newTipo} onChange={e => setNewTipo(e.target.value)} className={inputClass}>
            <option value="">Selecciona…</option>
            {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-co-alma" className="block text-xs font-medium text-gray-700 mb-1">Almacén inicial</label>
          <select id="new-co-alma" value={newCoAlma} onChange={e => setNewCoAlma(e.target.value)} className={inputClass}>
            <option value="">Selecciona…</option>
            {warehouseOptions.map(coAlma => <option key={coAlma} value={coAlma}>{coAlma}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-co-lin" className="block text-xs font-medium text-gray-700 mb-1">Línea</label>
          <select id="new-co-lin" value={newCoLin} onChange={e => { setNewCoLin(e.target.value); setNewCoSubl(''); }} className={inputClass}>
            <option value="">Selecciona…</option>
            {lookups?.lineas.map(l => <option key={l.coLin} value={l.coLin}>{l.linDes}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-co-subl" className="block text-xs font-medium text-gray-700 mb-1">Sub-línea</label>
          <select id="new-co-subl" value={newCoSubl} onChange={e => setNewCoSubl(e.target.value)} disabled={!newCoLin} className={inputClass}>
            <option value="">Selecciona…</option>
            {sublineaOptions.map(s => <option key={s.coSubl} value={s.coSubl}>{s.sublDes}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-co-cat" className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
          <select id="new-co-cat" value={newCoCat} onChange={e => setNewCoCat(e.target.value)} className={inputClass}>
            <option value="">Selecciona…</option>
            {lookups?.categorias.map(c => <option key={c.coCat} value={c.coCat}>{c.catDes}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-co-uni" className="block text-xs font-medium text-gray-700 mb-1">Unidad</label>
          <select id="new-co-uni" value={newCoUni} onChange={e => setNewCoUni(e.target.value)} className={inputClass}>
            <option value="">Selecciona…</option>
            {lookups?.unidades.map(u => <option key={u.coUni} value={u.coUni}>{u.desUni}</option>)}
          </select>
        </div>
      </div>

      {createError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{createError}</p>
      )}
      {createSuccess && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{createSuccess}</p>
      )}

      <button
        onClick={handleCreateArticle}
        disabled={!canCreateArticle || creatingArticle}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
      >
        {creatingArticle ? 'Creando…' : 'Crear artículo'}
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Run the E2E tests to verify they pass**

Run: `bunx playwright test e2e/inventory-article-creation.spec.ts`
Expected: all 3 tests PASS. Rebuild (`next build && next start`) before running, per this repo's established E2E convention.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/inventario/articulos/articulos-client.tsx e2e/inventory-article-creation.spec.ts
git commit -m "feat: add crear artículo nuevo panel to articulos page"
```

---

### Task 9: Full round-trip integration test (create → assign → simple ajuste)

Proves the two features compose correctly end-to-end, matching the spec's explicit call for this scenario under Testing.

**Files:**
- Test: `__tests__/integration/pApiCrearArticuloInventario.integration.test.ts` (add one case)

**Interfaces:**
- Consumes: `pApiCrearArticuloInventario` (Task 2), `assignArticleToWarehouse` (Task 1), `pApiCrearAjusteInventario` (existing).

- [ ] **Step 1: Add the round-trip test**

Add to `__tests__/integration/pApiCrearArticuloInventario.integration.test.ts`:

```typescript
test('full round trip: create article, assign to warehouse, simple-ajuste entrada, ends with expected stock', async () => {
  const coArt = await nextTestCoArt();
  const lookup = await realLookupRow();
  const warehouse = '14';

  await callProcedure({
    coArt, artDes: 'Round Trip Test Article', tipo: 'M',
    coLin: lookup.coLin, coSubl: lookup.coSubl, coCat: lookup.coCat, coUni: lookup.coUni,
  });
  createdArticles.push(coArt);

  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), warehouse)
    .query(`INSERT INTO saStockAlmacen (co_art, co_alma, tipo, stock) VALUES (@coArt, @coAlma, 'ACT', 0)`);

  const zeroStockCheck = await pool.request().input('a', sql.Char(30), coArt).input('w', sql.Char(6), warehouse)
    .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @a AND co_alma = @w AND tipo = 'ACT'`);
  expect(Number(zeroStockCheck.recordset[0].stock)).toBe(0);

  const lineasTable = new sql.Table('AjusteInventarioLineaType');
  lineasTable.columns.add('co_tipo', sql.Char(6));
  lineasTable.columns.add('co_art', sql.Char(30));
  lineasTable.columns.add('co_alma', sql.Char(6));
  lineasTable.columns.add('co_uni', sql.Char(6));
  lineasTable.columns.add('total_art', sql.Decimal(18, 5));
  lineasTable.columns.add('cost_unit', sql.Decimal(18, 5));
  lineasTable.columns.add('permitir_negativo', sql.Bit);
  lineasTable.rows.add('E00001', coArt, warehouse, lookup.coUni, 50, null, false);

  const ajusteReq = pool.request();
  ajusteReq.input('sMotivo', sql.VarChar(80), 'Round trip test entrada');
  ajusteReq.input('dtFecha', sql.SmallDateTime, new Date());
  ajusteReq.input('sCoUsIn', sql.Char(6), 'PROFIT');
  ajusteReq.input('sCoSucuIn', sql.Char(6), null);
  ajusteReq.input('Lineas', lineasTable);
  ajusteReq.output('sAjueNumOut', sql.Char(20));
  const ajusteResult = await ajusteReq.execute('pApiCrearAjusteInventario');
  const ajueNum = (ajusteResult.output.sAjueNumOut as string).trim();

  const finalStockCheck = await pool.request().input('a', sql.Char(30), coArt).input('w', sql.Char(6), warehouse)
    .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @a AND co_alma = @w AND tipo = 'ACT'`);
  expect(Number(finalStockCheck.recordset[0].stock)).toBe(50);

  await pool.request().input('n', sql.Char(20), ajueNum).query(`
    DELETE CHS FROM saCostoHistoricoSalida CHS
    JOIN saAjusteReng AR ON AR.rowguid = CHS.doc_orig
    WHERE CHS.tipo_doc = 'AJUS' AND AR.ajue_num = @n
  `);
  await pool.request().input('n', sql.Char(20), ajueNum).query(`
    DELETE CHE FROM saCostoHistoricoEntrada CHE
    JOIN saAjusteReng AR ON AR.rowguid = CHE.doc_orig
    WHERE CHE.tipo_doc = 'AJUS' AND AR.ajue_num = @n
  `);
  await pool.request().input('n', sql.Char(20), ajueNum).query(`DELETE FROM saAjusteReng WHERE ajue_num = @n`);
  await pool.request().input('n', sql.Char(20), ajueNum).query(`DELETE FROM saAjuste WHERE ajue_num = @n`);
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `bun test __tests__/integration/pApiCrearArticuloInventario.integration.test.ts`
Expected: all tests including this new one PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/integration/pApiCrearArticuloInventario.integration.test.ts
git commit -m "test: add full create-to-ajuste round trip integration test"
```

---

## Self-Review Notes

- **Spec coverage**: Simple ajuste mode (Task 5-6), article creation SP (Task 2), article creation route (Task 7), UI panel (Task 8), lookups/next-code routes (Task 4), next-code helper (Task 3), warehouse-assignment reuse + column verification (Task 1), round-trip test (Task 9) — all spec sections have a corresponding task. Out-of-scope items (multi-unit, pricing/fiscal fields, bundled opening stock, Línea/Categoría management UI) are correctly absent from every task.
- **Resolved open item**: the spec flagged `pInsertarUnidadArticuloRenglon`'s exact parameter names as unconfirmed; Task 2 resolves this directly against `erp-knowledge-base/docs/procedures/pInsertarUnidadArticuloRenglon.md`'s already-transcribed live signature, and also catches that the spec's SP draft omitted 3 required `pInsertarArticulo` parameters (`@sTipo_Imp2`, `@sTipo_Imp3`, `@sCod_Proc`).
- **Deliberate deviation flagged**: Task 5 uses `permitir_negativo: false` for simple ajuste (spec draft was ambiguous here, describing recount's checkbox default without specifying simple ajuste's) — since the UI has no checkbox exposed, hardcoding to the safe default is the only implementable option under "form stays minimal"; call this out to the user during execution.
- **Type consistency**: `assignArticleToWarehouse`'s signature (Task 1) matches its usage in Task 7. `suggestNextArticleCode` (Task 3) matches its usage in Task 4. Route body shapes match between client (Tasks 6, 8) and server (Tasks 5, 7) — `{coTipo, coArt, coAlma, cantidad}` and `{coArt, artDes, tipo, coLin, coSubl, coCat, coUni, coAlma}` are consistent everywhere they appear.
- **No placeholders**: every step has runnable code, not descriptions. Migration numbering (`0004`) follows directly from the existing `0001`-`0003` files confirmed present in `mssql-migrations/`.
