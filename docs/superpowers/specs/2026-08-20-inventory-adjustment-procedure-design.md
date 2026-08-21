# Inventory Adjustment Procedure — Migration Mechanism + Stored Procedure

## Goal

Give the inventory module a single, atomic way to create a stock
adjustment in Profit Plus, deployed through a new migration mechanism
for the ERP database that is deliberately independent from the app's
own SQLite migrations. This is Plan 2 of the inventory module effort
(spec: `docs/superpowers/specs/2026-08-20-inventory-management-design.md`),
following Plan 1 (access control + admin config, merged to `main`).

This plan is scoped to the database side only: the migration runner,
the new stored procedure, and the `saTipoAjuste` seed rows for manual
recounts. The Next.js API route that calls this procedure is
deliberately deferred to Plan 4 (adjustments UI), so route and UI ship
and get reviewed together, against a stored procedure that's already
proven correct via direct integration tests.

## Context

### Why Profit Plus needs a new stored procedure at all

Verified during Plan 1's investigation (recorded in the original
design spec, re-verified live for this plan): creating a valid
adjustment in Profit Plus is a 3-step process the ERP client
orchestrates in application code, not one atomic call:

1. `pInsertarAjusteEntradaSalida` — inserts the `saAjuste` header. Pure
   insert, no validation.
2. `pInsertarRenglonesAjusteEntradaSalida` — inserts a `saAjusteReng`
   line, then calls `pCostoActualizarEntrada` (`tipo_trans='0'`) or
   `pCostoActualizarSalida` (`tipo_trans='1'`) to update FIFO cost
   layers (`saCostoHistoricoEntrada`/`Salida`). Neither of these
   touches `saStockAlmacen`.
3. `pStockActualizar` — the only procedure that writes
   `saStockAlmacen.stock`. Must be called explicitly per line, with
   `@sTipoStock='ACT'`, `@bSumarStock` from `tipo_trans`, and
   `@bPermiteStockNegativo` decided by the caller.

No trigger bridges these steps. This plan's stored procedure wraps all
three in one SQL transaction so this app never leaves an adjustment
recorded with no stock effect.

### Two corrections to the original spec, found during this plan's investigation

The original spec (`2026-08-20-inventory-management-design.md`, Data
Model section) specified this stored procedure's body in enough detail
to write against, but two details didn't survive contact with the live
schema:

1. **Cost lookup has no `co_art` column to filter on.**
   `saCostoHistoricoEntrada` links to articles via
   `cod_articulo_rowguid` (a `uniqueidentifier` FK to
   `saArticulo.rowguid`), not a `co_art` column — confirmed via
   `INFORMATION_SCHEMA.COLUMNS` and a live sample join. The corrected
   query for resolving an unset `cost_unit`:
   ```sql
   SELECT TOP 1 CHE.costo
   FROM saCostoHistoricoEntrada CHE
   JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
   WHERE A.co_art = @co_art
   ORDER BY CHE.fecha_emision DESC
   ```

2. **`ajue_num` generation should call the ERP's own numbering
   procedure, not read `saConsecutivo` directly.** `saConsecutivo` is
   not itself a counter — it's a lookup mapping a `co_consecutivo` key
   (`'AJUS_NUM'`) to a `co_serie` (verified live: `AJUS_NUM` →
   `co_serie='I001-1'`, `co_sucur=NULL`, i.e. one company-wide series,
   not per-branch, in this database). The actual next-number logic
   lives in `pConsecutivoProximoOutPut`, which Profit Plus's own
   procedures use for every kind of document numbering (invoices,
   orders, adjustments, etc.):
   ```sql
   CREATE PROCEDURE [pConsecutivoProximoOutPut] (
       @sCo_Sucur CHAR(6) = NULL,
       @sCo_Consecutivo CHAR(16),
       @strConsecutivoResult CHAR(20) OUTPUT
   )
   ```
   Read (via `OBJECT_DEFINITION`) and confirmed: it looks up the
   series' current position (`saSerie.prox_n`/`prox_a`), computes the
   next value (delegating to `pConsecutivoProximoCalcular`), and
   **atomically updates `saSerie`** in the same call — so calling it
   is both correct and safe under concurrent adjustment creation,
   unlike hand-rolling a read-then-increment against `saConsecutivo`/
   `saSerie` ourselves. This plan's stored procedure calls it with
   `@sCo_Consecutivo = 'AJUS_NUM'` and `@sCo_Sucur` passed through from
   the caller (matching the header field `@sCoSucuIn` already in
   scope), exactly as the ERP client itself would.

### `saTipoAjuste` manual-recount rows (unchanged from the original spec)

`saTipoAjuste` has 6 existing rows (verified live), none of which
cover a manual physical recount outside the unused
`saInventarioFisico` count-session flow. This plan seeds two new rows
as a data-only `INSERT` (not a schema change — `saTipoAjuste` is an
editable catalog):

| `co_tipo` | `des_tipo` | `tipo_trans` |
|---|---|---|
| `E00003` | Ajuste Por Conteo Manual (Sobrante) | `0` (entrada) |
| `S00005` | Ajuste Por Conteo Manual (Faltante) | `1` (salida) |

`E00003`/`S00005` are the next free codes in each series (`E`/`S` +
zero-padded sequence), matching the existing naming convention.
Re-verified live: `E00003` and `S00005` are still unused.

### Negative stock and other verified business rules (unchanged)

- `par_emp.i_stock_negativo` is a single global flag (currently
  `true` in this database) — Profit Plus already allows negative stock
  company-wide. This procedure does not read that flag; each caller
  decides `permitir_negativo` per line, matching how
  `pStockActualizar` itself works (no implicit default).
- `saAjuste` has zero historical rows in this database — this is a
  net-new workflow, not digitizing an existing habit, so there is no
  legacy data shape to stay compatible with.
- Services (`saArticulo.tipo='S'`) contribute zero to stock per the
  `StockActAjuste` view's own logic — out of scope for this procedure
  to special-case, since `pStockActualizar` and the cost-layer
  procedures already handle unit/type conversion correctly for any
  article type passed to them.

## Data Model

### New migration mechanism: `mssql-migrations/`

A new top-level directory, structurally parallel to
`drizzle/migrations/` but deliberately using different tooling and a
different tracking table, since it targets a different database with a
different deploy story (a shared production ERP, not an app-owned
SQLite file):

```
mssql-migrations/
  0001_create_migrations_table.sql
  0002_pApiCrearAjusteInventario.sql
  0003_seed_manual_recount_tipos.sql
scripts/migrate-mssql.ts
```

**Tracking table** (created by migration `0001`, the runner's own
bootstrap step):
```sql
CREATE TABLE dbo.__exporter_migrations (
    name        VARCHAR(255)  NOT NULL PRIMARY KEY,
    applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
```

**Runner** (`scripts/migrate-mssql.ts`, invoked via `bun run
migrate:mssql`, added to `package.json`'s scripts, mirroring the
existing `"migrate": "bun --bun run scripts/migrate.ts"` entry):
1. Connects via the same `DB_SERVER`/`DB_PORT`/`DB_NAME`/`DB_USER`/
   `DB_PASSWORD`/`DB_ENCRYPT`/`DB_TRUST_SERVER_CERT` env vars
   `lib/db/mssql.ts` already uses (no new env vars needed) — using a
   fresh, one-off `mssql` connection for the runner rather than the
   app's pooled singleton, since this is a standalone script, not a
   running server.
2. Ensures `dbo.__exporter_migrations` exists (migration `0001` is
   special-cased: applied via a plain `IF NOT EXISTS` check before the
   tracking table itself can be queried).
3. Reads `mssql-migrations/*.sql` in filename order, skips any name
   already present in `__exporter_migrations`, and for each new one:
   splits the file on lines containing only `GO` and runs each
   resulting batch in order via the `mssql` package's `.batch()` (not
   `.query()`, which does not accept multi-statement DDL the way
   `CREATE TYPE ... GO CREATE PROCEDURE ...` requires) — confirmed
   necessary and sufficient by actually deploying migration `0002`
   this way: `CREATE TYPE AjusteInventarioLineaType` and `CREATE
   PROCEDURE pApiCrearAjusteInventario` must be separate batches (SQL
   Server requires a type to exist before it can be referenced as a
   parameter type in the same script, and a `CREATE PROCEDURE` must be
   the first statement in its batch). Records the migration's name
   only after every batch in the file succeeds.
4. Prints what ran; idempotent by design — running it twice is a
   no-op the second time.

This mirrors `drizzle-kit`'s "list of numbered files + a tracking
table" shape closely enough to be immediately familiar to anyone who's
touched `drizzle/migrations/`, while staying a completely separate
code path — no import from `drizzle-orm` or the SQLite side anywhere
in this script.

### Migration `0002`: `pApiCrearAjusteInventario`

**This procedure body was written, deployed to the live dev database,
and actually executed multiple times during this design phase** — not
just read for plausibility. That live-fire testing surfaced three real
bugs the design-only version above (an earlier draft) would have
shipped with; all three are fixed in the version below and re-verified
by running it again afterward. Every claim in this section is backed
by an actual query result, not inference.

```sql
CREATE TYPE AjusteInventarioLineaType AS TABLE (
    co_tipo            CHAR(6)         NOT NULL,
    co_art             CHAR(30)        NOT NULL,
    co_alma            CHAR(6)         NOT NULL,
    co_uni             CHAR(6)         NOT NULL,
    total_art          DECIMAL(18,5)   NOT NULL,
    cost_unit          DECIMAL(18,5)   NULL,
    permitir_negativo  BIT             NOT NULL
);
GO

CREATE PROCEDURE [pApiCrearAjusteInventario]
    (
      @sMotivo VARCHAR(80),
      @dtFecha SMALLDATETIME,
      @sCoUsIn CHAR(6),
      @sCoSucuIn CHAR(6),
      @Lineas AjusteInventarioLineaType READONLY,
      @sAjueNumOut CHAR(20) OUTPUT
    )
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        EXEC pConsecutivoProximoOutPut
            @sCo_Sucur = @sCoSucuIn,
            @sCo_Consecutivo = 'AJUS_NUM',
            @strConsecutivoResult = @sAjueNumOut OUTPUT;

        EXEC pInsertarAjusteEntradaSalida
            @sAjue_Num = @sAjueNumOut, @sCo_Mone = 'BS    ', @sMotivo = @sMotivo,
            @sdFecha = @dtFecha, @deTasa = 1, @bAnulado = 0,
            @deAux01 = 0, @sAux02 = '', @sCo_Us_In = @sCoUsIn,
            @sCo_Sucu_In = @sCoSucuIn;

        DECLARE @RengNum INT = 1;
        DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
            SELECT co_tipo, co_art, co_alma, co_uni, total_art, cost_unit, permitir_negativo
            FROM @Lineas;

        DECLARE @co_tipo CHAR(6), @co_art CHAR(30), @co_alma CHAR(6),
                @co_uni CHAR(6), @total_art DECIMAL(18,5),
                @cost_unit DECIMAL(18,5), @permitir_negativo BIT;

        OPEN cur;
        FETCH NEXT FROM cur INTO @co_tipo, @co_art, @co_alma, @co_uni,
            @total_art, @cost_unit, @permitir_negativo;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF @cost_unit IS NULL
                SELECT TOP 1 @cost_unit = CHE.costo
                FROM saCostoHistoricoEntrada CHE
                JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
                WHERE A.co_art = @co_art
                ORDER BY CHE.fecha_emision DESC;

            SET @cost_unit = ISNULL(@cost_unit, 0);

            EXEC pInsertarRenglonesAjusteEntradaSalida
                @sAjue_Num = @sAjueNumOut, @iReng_Num = @RengNum,
                @sCo_Tipo = @co_tipo, @sCo_Art = @co_art, @sCo_Alma = @co_alma,
                @sCo_Uni = @co_uni, @sSco_Uni = @co_uni,
                @deTotal_Art = @total_art, @deStotal_Art = @total_art,
                @deCost_Unit = @cost_unit, @deCosto_Adi1 = @cost_unit,
                @deCosto_Adi2 = 0, @deCosto_Adi3 = 0,
                @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn;

            DECLARE @bSumar BIT;
            SELECT @bSumar = CASE WHEN tipo_trans = '0' THEN 1 ELSE 0 END
            FROM saTipoAjuste WHERE co_tipo = @co_tipo;

            EXEC pStockActualizar
                @sCo_Alma = @co_alma, @sCo_Art = @co_art, @sCo_Uni = @co_uni,
                @deCantidad = @total_art, @sTipoStock = 'ACT',
                @bSumarStock = @bSumar, @bPermiteStockNegativo = @permitir_negativo;

            SET @RengNum += 1;
            FETCH NEXT FROM cur INTO @co_tipo, @co_art, @co_alma, @co_uni,
                @total_art, @cost_unit, @permitir_negativo;
        END
        CLOSE cur;
        DEALLOCATE cur;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0
            ROLLBACK TRAN;

        IF CURSOR_STATUS('local', 'cur') >= 0
        BEGIN
            CLOSE cur;
            DEALLOCATE cur;
        END

        RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg);
        RETURN;
    END CATCH
END
```

### Three bugs a design-only pass would have missed, found by actually running this

1. **`co_mone='VES'` doesn't exist.** The original draft assumed a
   Venezuelan-bolívar currency code. Live `SELECT * FROM saMoneda`
   shows this database's actual base currency (the row with
   `cambio=1`) is coded `'BS'` ("Bolívares"), padded to `char(6)` —
   `'VES'` isn't in the table at all and the insert failed on
   `FK_saAjuste_saMoneda`. Fixed to `'BS    '`.

2. **A final `SELECT @sAjueNumOut AS ajue_num` is the wrong way to
   return the number.** `pInsertarAjusteEntradaSalida`,
   `pInsertarRenglonesAjusteEntradaSalida`, and `pStockActualizar`
   each produce their own resultset internally (verified: a
   successful call produced 4 separate resultsets under
   `node-mssql`). A trailing `SELECT` in this procedure is technically
   the *last* one, but `node-mssql`'s convenient `.recordset` property
   returns the *first* resultset, not the last — a caller using that
   shortcut (the natural thing to reach for) would silently get the
   wrong data back. Fixed by using an `OUTPUT` parameter
   (`@sAjueNumOut`) instead: the caller reads `result.output.sAjueNumOut`
   directly, independent of how many incidental resultsets the nested
   ERP procedures happen to produce, now or in a future ERP update.

3. **`XACT_ABORT ON` alone did not roll back the `saAjuste` header on
   a negative-stock failure — confirmed by reproducing it.** With the
   `XACT_ABORT`-only version, forcing a negative-stock error (a salida
   line far exceeding real stock, `permitir_negativo=0`) correctly
   left `saStockAlmacen.stock` unchanged, but left the `saAjuste`
   header row committed anyway — `saAjuste` row count went from 3 to 4
   across the failed call. Root cause: `pStockActualizar` manages its
   *own* sub-transaction via `SAVE TRANSACTION`/`ROLLBACK TRANSACTION
   TransacStock` when called with an already-open outer transaction
   (verified by reading its body during Plan 1's research) — its
   `RAISERROR` + `RETURN` after that savepoint rollback does not
   reliably escalate to aborting the *outer* transaction under
   `XACT_ABORT` alone. Fixed with an explicit `BEGIN TRY`/`BEGIN
   CATCH` that does `ROLLBACK TRAN` itself whenever
   `XACT_STATE() <> 0`, then re-raises the original error message.
   Re-tested the identical negative-stock scenario against this fixed
   version: `saAjuste` row count and `saStockAlmacen.stock` both
   stayed unchanged across the failed call, and the counter advanced
   by `pConsecutivoProximoOutPut` earlier in the same transaction
   rolled back too (verified via `saSerie.prox_n` before/after) — the
   all-or-nothing guarantee now genuinely holds end-to-end, not just
   for the stock table.

### Other notes

- `co_mone='BS    '` and `tasa=1` are hardcoded — this business
  operates in local currency for adjustments (confirmed: `saAjuste`
  had zero historical rows before this testing, so there's no
  precedent to match; `saAjuste.tasa` is `NOT NULL`, and multi-currency
  adjustment support is out of scope per the original spec's "Out of
  Scope" section, which never mentions foreign-currency adjustments).
  If this needs to change later, it's a parameter addition, not a
  redesign.
- Any error from `pStockActualizar` (e.g. "No existe stock ... para
  el artículo"), from `pConsecutivoProximoOutPut`, or from a bad
  `co_tipo`/`co_art`/`co_alma` passed by the caller propagates out of
  this procedure via the `CATCH` block's `RAISERROR('%s', ...)`,
  preserving the original message text unchanged, so the calling
  application (Plan 4's API route) sees the same descriptive message
  the ERP itself would show — confirmed live: the propagated message
  for the negative-stock test was exactly `pStockActualizar`'s own
  text, byte-for-byte.
- A live successful multi-line call (one entrada line, one salida
  line, net effect verified against `saStockAlmacen.stock` before and
  after) confirmed both line types work correctly through this
  procedure in one call, and that per-line `co_tipo`→`tipo_trans`
  resolution picks the right sign for `pStockActualizar`'s
  `@bSumarStock`.

### Migration `0003`: seed the manual-recount `saTipoAjuste` rows

```sql
IF NOT EXISTS (SELECT 1 FROM saTipoAjuste WHERE co_tipo = 'E00003')
    INSERT INTO saTipoAjuste (co_tipo, des_tipo, tipo_trans, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo)
    VALUES ('E00003', 'Ajuste Por Conteo Manual (Sobrante)', '0', 'PROFIT', NULL, GETDATE(), 'PROFIT', NULL, GETDATE());

IF NOT EXISTS (SELECT 1 FROM saTipoAjuste WHERE co_tipo = 'S00005')
    INSERT INTO saTipoAjuste (co_tipo, des_tipo, tipo_trans, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo)
    VALUES ('S00005', 'Ajuste Por Conteo Manual (Faltante)', '1', 'PROFIT', NULL, GETDATE(), 'PROFIT', NULL, GETDATE());
```

The `IF NOT EXISTS` guards make this migration idempotent on its own,
independent of the runner's tracking table — belt-and-suspenders,
since this INSERT touches shared production data.

## Error Handling / Edge Cases

- **Any line fails validation or hits a negative-stock guard**: the
  `BEGIN TRY`/`BEGIN CATCH` wrapper's explicit `ROLLBACK TRAN` ensures
  the whole batch rolls back — no header, no prior lines, no stock
  changes, no consumed adjustment number — reproduced live for the
  negative-stock case specifically (see "Three bugs..." above and
  Testing below); do not rely on `XACT_ABORT` alone for this, since it
  was tested and found insufficient against `pStockActualizar`'s
  internal savepoint-based rollback.
- **Article never priced, `cost_unit` omitted**: falls back to `0` per
  the original spec's decision, not a hard failure — an admin/analyst
  can follow up later; the adjustment still records correctly.
- **Concurrent adjustment creation**: `pConsecutivoProximoOutPut`
  updates `saSerie.prox_n`/`prox_a` inside its own logic, so two
  concurrent calls to this procedure get distinct `ajue_num` values
  without this procedure needing its own locking — verified by reading
  the procedure's body (it's a single `UPDATE` after the calculation,
  standard SQL Server read-committed behavior serializes concurrent
  writers on that row).
- **Migration re-run**: the runner skips anything already in
  `__exporter_migrations`; migration `0003`'s own `IF NOT EXISTS`
  guards mean even a manual out-of-band re-run of that file's SQL is
  safe.

## Testing

Integration tests using the `mssql` package directly (no Next.js
route exists yet to test through) against the real dev database
(`Ncake_a`, running in the already-present `profitplus-erp-mock`
Docker container — confirmed reachable and already used throughout
Plan 1's investigation and manual verification):

1. **Migration runner applies cleanly to a fresh state and is
   idempotent** — run `bun run migrate:mssql` twice, confirm the
   second run is a no-op (no errors, `__exporter_migrations` row count
   unchanged).
2. **Successful multi-line adjustment**: call
   `pApiCrearAjusteInventario` with 2+ lines (one entrada, one
   salida) against warehouse `14` (verified to carry real stock; this
   exact scenario was run live during design — see above), reading the
   adjustment number from the `sAjueNumOut` **output parameter**, not
   from any resultset. Confirm `saAjuste`/`saAjusteReng` rows exist,
   `saStockAlmacen.stock` changed by the expected net amount, and
   `sAjueNumOut` is non-null and unique across repeated calls.
3. **Negative-stock rejection**: call with `permitir_negativo=0` on a
   salida line whose quantity exceeds current stock, confirm the call
   throws (propagated `RAISERROR`) and — critically — confirm via a
   follow-up `SELECT` that **no** `saAjuste`/`saAjusteReng` row was
   left behind and `saStockAlmacen.stock` is unchanged (the
   all-or-nothing guarantee, tested directly, not assumed).
4. **Negative-stock allowed**: same setup with
   `permitir_negativo=1`, confirm it succeeds and stock goes negative.
5. **Cost fallback to 0**: call with `cost_unit=NULL` for an article
   confirmed (via a pre-test query) to have no
   `saCostoHistoricoEntrada` rows, confirm the resulting
   `saAjusteReng.cost_unit` is `0`, not an error.
6. **Cost lookup resolves correctly for a priced article**: call with
   `cost_unit=NULL` for an article confirmed to have
   `saCostoHistoricoEntrada` rows, confirm the resulting
   `saAjusteReng.cost_unit` matches the most recent entry's `costo`
   (validates the `cod_articulo_rowguid` join is correct, not just
   "doesn't crash").
7. **Manual-recount `saTipoAjuste` rows exist and are usable**:
   `SELECT` confirms `E00003`/`S00005` exist with the correct
   `tipo_trans`, and a full adjustment call using `co_tipo='E00003'`
   succeeds end-to-end.
8. **All-caps/whitespace consistency**: Profit Plus's `char` columns
   are fixed-width and space-padded — confirm the test helper trims
   values read back for comparison (the pattern this repo already uses
   via `lib/trim-strings.ts` for reads elsewhere) rather than a test
   failing on a padding mismatch that isn't a real bug.

Tests clean up after themselves (delete the test `saAjuste`/
`saAjusteReng` rows and restore `saStockAlmacen.stock` deltas) since
this runs against the same real dev database used for manual
verification and other tests, not an ephemeral fixture. **Prefer
snapshot-and-restore over compute-a-delta for stock cleanup**: capture
the exact `stock` value before each test and `UPDATE ... SET stock =
@capturedValue` afterward, rather than adding/subtracting the test
quantity back — a delta-based cleanup script written during this
design phase used string concatenation instead of numeric addition
(`sql` template literal interpolating a `DECIMAL` into `stock = stock
+ ${value}` without parameterizing it) and corrupted a real
`saStockAlmacen.stock` value by several orders of magnitude before
being caught and fixed. Snapshot-and-restore has no such failure mode.

## Out of Scope (this plan)

- The Next.js API route that calls this procedure — Plan 4.
- Deploying this migration to the real production Profit Plus server —
  a separate, deliberate operational step for later, not automated by
  this plan. `bun run migrate:mssql` is a manual command the operator
  points at whichever database they choose via env vars; this plan
  does not wire it into any CI/deploy pipeline.
- Multi-currency adjustments (hardcoded `co_mone='BS    '`, `tasa=1`).
- Any change to `saInventarioFisico`/physical-count-session flows —
  unused in this database, unrelated to manual ad-hoc adjustments.
- Retrying/queueing failed adjustment calls — the procedure either
  fully succeeds or fully rolls back; caller-side retry logic is a
  Plan 4 UI concern, not this plan's.
