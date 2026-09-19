# CxC Debt Concentration Chart + Invoice Due-Date Repair Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only debt-concentration-by-customer chart to the CxC analytics tab, plus a dry-run-by-default CLI tool (backed by a new ERP stored procedure) to repair the confirmed invoice-due-date misconfiguration for specific customers in production.

**Architecture:** Part 1 follows the existing `section=`-dispatch pattern already used by `app/api/dwh/productos/route.ts` and `app/api/dwh/ventas/route.ts` — a new query branch in `app/api/dwh/cxc/route.ts`, a new response type, and a new Recharts stacked bar section in `tab-cxc.tsx`, reusing the tab's existing bucket palette and `clienteDimension` toggle. Part 2 follows the existing `mssql-migrations/`+`scripts/*.ts` pattern (see `0006_pApiCambiarUnidadArticulo.sql` + `scripts/send-invoice-reminders.ts`) — a transactional stored procedure with an audit-log table, invoked from a standalone CLI script that previews by default and only writes with `--apply`.

**Tech Stack:** Next.js App Router, TypeScript, `mssql` package (two singleton pools: ERP via `lib/db/mssql.ts`, DWH via `lib/db/dwh-mssql.ts`), Recharts, Bun test runner.

**Spec:** `docs/superpowers/specs/2026-09-19-cxc-overdue-concentration-and-due-date-repair-design.md`

## Global Constraints

- ERP `mssql` queries use `.input()` for ALL user-controlled values — never concatenate (AGENTS.md).
- DWH routes query only `dim.*`/`fact.*` tables, never raw ERP tables (AGENTS.md).
- Every `dwh/*` route's success response goes through `jsonWithCache`; error responses use a bare `NextResponse.json(..., {status: 500})`, never cached (`app/api/dwh/lib/query-builder.ts`).
- `mssql-migrations/*.sql` must be safely re-runnable (`DROP ... IF EXISTS` / `CREATE TABLE IF NOT EXISTS`) — see `dwh-migrations/README.md`'s equivalent rule and `0006_pApiCambiarUnidadArticulo.sql`'s pattern.
- CLI scripts connect via `lib/db/mssql.ts`'s `getPool()` (ERP) and always `await pool.close()` in a `finally` block (`scripts/send-invoice-reminders.ts`).
- No `git add -A` — stage files explicitly.
- Commit with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` per this session's system reminder.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/(app)/analitica/types.ts` | Add `DebtConcentrationRow`, `DebtConcentrationResponse` types |
| `app/api/dwh/cxc/route.ts` | Add `debtConcentrationQuery()`, `handleDebtConcentration()`, and `section=debtConcentration` dispatch |
| `app/api/dwh/cxc/__tests__/route.test.ts` | Add one more 401 test case for the new `section` value |
| `app/(app)/analitica/tabs/tab-cxc.tsx` | Add the stacked bar chart section, reusing `BUCKET_ORDER`/`BUCKET_COLORS` |
| `mssql-migrations/0007_pApiCorregirFechaVencimientoFactura.sql` | New audit table + new stored procedure |
| `scripts/fix-invoice-due-dates.ts` | New CLI: guardrail check, preview query, `--apply` invocation, reminder message |

---

### Task 1: DWH route — debt concentration query

**Files:**
- Modify: `app/(app)/analitica/types.ts` (add types near `AgingBucketRow`/`AgingTrendRow`, currently around line 52-65 per this session's earlier read)
- Modify: `app/api/dwh/cxc/route.ts`
- Test: `app/api/dwh/cxc/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getDimensionSpec`, `isClienteDimension`, `jsonWithCache`, `type Dimension` from `app/api/dwh/lib/query-builder.ts` (already imported in this file); `AgingBucketRow` type (already defined in `types.ts`).
- Produces: `DebtConcentrationRow { name: string; buckets: AgingBucketRow[] }`, `DebtConcentrationResponse { rows: DebtConcentrationRow[]; usdRate: number | null }` — exported from `types.ts`, consumed by Task 2 (UI).

- [ ] **Step 1: Add the new types to `types.ts`**

Open `app/(app)/analitica/types.ts` and find the existing `AgingTrendRow` interface (it sits right after `AgingBucketRow`/`DebtorRow`, before `CxcResponse`). Add immediately after `AgingTrendRow`:

```typescript
export interface DebtConcentrationRow {
  name: string; // LegalEntityName or CustomerName, per clienteDimension
  buckets: AgingBucketRow[]; // same 5-bucket shape as AgingTrendRow.buckets
}

export interface DebtConcentrationResponse {
  rows: DebtConcentrationRow[];
  usdRate: number | null;
}
```

- [ ] **Step 2: Write the failing test for the new `section` value**

Open `app/api/dwh/cxc/__tests__/route.test.ts` and add a second test right after the existing one:

```typescript
  test('rejects unauthenticated requests with 401 for section=debtConcentration', async () => {
    const req = new NextRequest('http://localhost/api/dwh/cxc?section=debtConcentration');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 3: Run the test to verify it currently passes (401 is already the default for any unrecognized/unhandled request shape — this step confirms the baseline, not a new failure)**

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts`
Expected: both tests PASS (this route already 401s on any request without a valid session, before it even looks at `section` — so this step is a sanity check that the test file itself is wired up correctly, not a red/green TDD cycle for the auth behavior).

- [ ] **Step 4: Add `debtConcentrationQuery` to `app/api/dwh/cxc/route.ts`**

Add this function right after `topDebtorsQuery` (currently ends around line 52, just before the `WEEKDAY_VENCIMIENTO_QUERY` comment block):

```typescript
// Part 3e: top 15 customers by total outstanding balance at the latest
// snapshot, broken out by AgingBucket — same bucket set as the aging chart,
// but per-customer instead of aggregated, to show where overdue debt
// concentrates. Reuses the same dimension spec as topDebtorsQuery so the
// Entidad/Tienda toggle applies here too.
function debtConcentrationQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT TOP 15 ${spec.labelExpr} AS Name, a.AgingBucket, SUM(a.OutstandingBalance) AS Amount
    FROM fact.Fact_AR_Snapshot a
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
      AND ${spec.groupByColumn.split(',')[0].trim()} IN (
        SELECT TOP 15 ${spec.groupByColumn.split(',')[0].trim()}
        FROM fact.Fact_AR_Snapshot a2
        ${spec.joinClause.replace(/\bf\b/g, 'a2')}
        WHERE a2.SnapshotDateKey = @snapshotDateKey AND a2.IsCreditNote = 0
        GROUP BY ${spec.groupByColumn}
        ORDER BY SUM(a2.OutstandingBalance) DESC
      )
    GROUP BY ${spec.groupByColumn}, a.AgingBucket
    ORDER BY ${spec.groupByColumn.split(',')[0].trim()}
  `;
}
```

*Why the nested TOP 15*: the outer query needs every bucket row for each of the top 15 customers (up to 5 rows per customer), not just 15 rows total — a plain `TOP 15` on the outer query would cut off mid-customer. The inner subquery picks the top 15 customer keys by total balance; the outer query then pulls all bucket rows for exactly those keys.

- [ ] **Step 5: Add `handleDebtConcentration` next to the other `handle*` functions**

This route doesn't currently have `handle*`-style functions (unlike `productos/route.ts`) — its `GET` inlines everything. Add this as a plain async function right before `export async function GET`:

```typescript
async function handleDebtConcentration(snapshotDateKey: number, clienteDimension: Dimension, currency: string) {
  const pool = await getDwhPool();
  const [result, usdRate] = await Promise.all([
    pool.request().input('snapshotDateKey', snapshotDateKey).query(debtConcentrationQuery(clienteDimension)),
    currency === 'usd' ? getUsdRate() : Promise.resolve(null),
  ]);

  const byName = new Map<string, DebtConcentrationRow>();
  for (const r of result.recordset as { Name: string; AgingBucket: string; Amount: number }[]) {
    let entry = byName.get(r.Name);
    if (!entry) {
      entry = { name: r.Name, buckets: [] };
      byName.set(r.Name, entry);
    }
    entry.buckets.push({ bucket: r.AgingBucket, amount: Number(r.Amount) });
  }

  const response: DebtConcentrationResponse = { rows: Array.from(byName.values()), usdRate };
  return jsonWithCache(response);
}
```

Add `DebtConcentrationRow, DebtConcentrationResponse` to the existing `import type { ... } from '@/app/(app)/analitica/types'` line at the top of the file.

- [ ] **Step 6: Wire the `section=debtConcentration` dispatch into `GET`**

In `GET`, find the block that computes `snapshotDateKey` (`const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;`). Immediately after that line, add:

```typescript
    const section = searchParams.get('section');
    if (section === 'debtConcentration') {
      if (snapshotDateKey === null) {
        return jsonWithCache({ rows: [], usdRate: null } satisfies DebtConcentrationResponse);
      }
      return await handleDebtConcentration(snapshotDateKey, clienteDimension, currency);
    }
```

This must come after `snapshotDateKey` and `clienteDimension`/`currency` are already computed earlier in `GET` (they are — `clienteDimension` and `currency` are parsed near the top of `GET`, `snapshotDateKey` right after the `Promise.all` for `latestSnapshot`/`usdRate`). Placing the branch here means it shares the same auth check (`requireDwhAccess`, already run at the top of `GET`) and doesn't duplicate the snapshot lookup.

- [ ] **Step 7: Run the tests again to confirm nothing broke**

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts`
Expected: both tests PASS.

- [ ] **Step 8: Typecheck and lint**

Run: `bunx tsc --noEmit`
Expected: no new errors (the pre-existing 5 errors in `__tests__/integration/inventory-change-unit.integration.test.ts` are unrelated and already present before this change — confirm via `git status --short` that this task didn't touch that file).

Run: `bunx eslint app/api/dwh/cxc/route.ts app/\(app\)/analitica/types.ts app/api/dwh/cxc/__tests__/route.test.ts`
Expected: no new errors.

- [ ] **Step 9: Verify the query against the live DWH**

Write a throwaway script (do NOT commit it) at `scripts/tmp-verify-debt-concentration.ts`:

```typescript
import { getDwhPool } from '../lib/db/dwh-mssql';

async function main() {
  const pool = await getDwhPool();
  const latest = await pool.request().query(`SELECT MAX(SnapshotDateKey) AS k FROM fact.Fact_AR_Snapshot`);
  const snapshotDateKey = latest.recordset[0].k;
  console.log('snapshotDateKey', snapshotDateKey);

  const result = await pool.request().input('snapshotDateKey', snapshotDateKey).query(`
    SELECT TOP 15 le.LegalEntityName AS Name, a.AgingBucket, SUM(a.OutstandingBalance) AS Amount
    FROM fact.Fact_AR_Snapshot a
    JOIN dim.Dim_Customer c ON c.CustomerKey = a.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
      AND le.LegalEntityKey IN (
        SELECT TOP 15 le2.LegalEntityKey
        FROM fact.Fact_AR_Snapshot a2
        JOIN dim.Dim_Customer c2 ON c2.CustomerKey = a2.CustomerKey
        JOIN dim.Dim_LegalEntity le2 ON le2.LegalEntityKey = c2.LegalEntityKey
        WHERE a2.SnapshotDateKey = @snapshotDateKey AND a2.IsCreditNote = 0
        GROUP BY le2.LegalEntityKey
        ORDER BY SUM(a2.OutstandingBalance) DESC
      )
    GROUP BY le.LegalEntityKey, le.LegalEntityName, a.AgingBucket
    ORDER BY le.LegalEntityKey
  `);
  console.table(result.recordset);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

Run: `bun --bun run --env-file=.env.local scripts/tmp-verify-debt-concentration.ts`
Expected: a table of rows, each with `Name`, `AgingBucket`, `Amount` — up to 5 rows per customer name, at most 15 distinct names. Confirm the amounts sum sensibly (spot-check one customer's rows sum to a plausible total).

Delete the script after verifying: `rm -f scripts/tmp-verify-debt-concentration.ts`

- [ ] **Step 10: Commit**

```bash
git add "app/(app)/analitica/types.ts" app/api/dwh/cxc/route.ts app/api/dwh/cxc/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat: add debt-concentration-by-customer query to CxC route

Adds section=debtConcentration: top 15 customers by outstanding balance,
broken out by aging bucket, so the CxC tab can show where overdue debt
concentrates. Reuses the existing dimension-pivot mechanism and bucket
classification already used by the aging chart and top-debtors table.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CxC tab — debt concentration chart UI

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-cxc.tsx`

**Interfaces:**
- Consumes: `DebtConcentrationResponse`, `DebtConcentrationRow` (Task 1), `BUCKET_ORDER`, `BUCKET_COLORS`, `pct`, `money`/`moneyLabel`/`moneyTooltip` (already imported), the tab's existing `clienteDimension` state (already declared at line 63: `const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad')`).
- Produces: nothing new consumed elsewhere — this is a leaf UI section.

- [ ] **Step 1: Add state and fetch effect**

In `tab-cxc.tsx`, right after the existing `const [clienteDimension, setClienteDimension] = useState<...>(...)` line, add:

```typescript
  const [debtConcentration, setDebtConcentration] = useState<DebtConcentrationResponse | null>(null);
  const [debtConcentrationLoading, setDebtConcentrationLoading] = useState<boolean>(true);
  const [debtConcentrationError, setDebtConcentrationError] = useState<string | null>(null);
```

Add `DebtConcentrationResponse` to the existing `import type { Currency, CxcResponse, DateRange } from '../types';` line (becomes `import type { Currency, CxcResponse, DateRange, DebtConcentrationResponse } from '../types';`).

Add a second `useEffect`, right after the existing one (which currently ends around line 92, closing with `}, [currency, clienteDimension]);`):

```typescript
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDebtConcentrationError(null);
      setDebtConcentrationLoading(true);
      try {
        const params = new URLSearchParams({ currency, clienteDimension, section: 'debtConcentration' });
        const res = await fetch(`/api/dwh/cxc?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setDebtConcentrationError(body.error ?? 'Error desconocido');
          return;
        }
        setDebtConcentration(await res.json());
      } catch {
        if (!cancelled) setDebtConcentrationError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setDebtConcentrationLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currency, clienteDimension]);
```

- [ ] **Step 2: Add the chart section to the JSX**

Find the closing `</ChartCard>` of the "Tendencia de antigüedad de saldos" section (the last section in the file, right before the root `</div>`). Add a new `ChartCard` immediately after it, before the root closing `</div>`:

```tsx
      {/* Debt concentration by customer */}
      <ChartCard
        title="Concentración de deuda por cliente"
        subtitle="Top 15 clientes por saldo pendiente, desglosado por antigüedad — para priorizar cobranza"
      >
        {debtConcentrationLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : debtConcentrationError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{debtConcentrationError}</p>
        ) : !debtConcentration || debtConcentration.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(320, debtConcentration.rows.length * 32)}>
            <BarChart
              data={debtConcentration.rows.map(row => {
                const flat: Record<string, string | number> = { name: row.name };
                for (const bucket of BUCKET_ORDER) {
                  flat[bucket] = row.buckets.find(b => b.bucket === bucket)?.amount ?? 0;
                }
                return flat;
              })}
              layout="vertical"
              margin={{ left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
              <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {BUCKET_ORDER.map(bucket => (
                <Bar key={bucket} dataKey={bucket} name={bucket} stackId="debt" fill={BUCKET_COLORS[bucket]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
```

This reuses `rate` (already computed at the top of the component as `const rate = data.usdRate ?? undefined;`) and the existing `BarChart`/`Bar`/`XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`/`Legend` imports — all already imported in this file per the existing weekday/aging-trend charts.

- [ ] **Step 3: Typecheck and lint**

Run: `bunx tsc --noEmit`
Expected: no new errors.

Run: `bunx eslint "app/(app)/analitica/tabs/tab-cxc.tsx"`
Expected: no new errors.

- [ ] **Step 4: Manual verification note**

Chrome browser automation was unavailable earlier in this session (extension not connected) — if it's connected now, navigate to `/analitica` (CxC tab) and visually confirm the new chart renders with stacked, correctly-colored bars and a working Entidad/Tienda toggle. If the extension is still unavailable, explicitly say so rather than claiming visual verification — Task 1's live-DWH query check (already done) is the fallback evidence that the data is correct; this step only confirms rendering.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-cxc.tsx"
git commit -m "$(cat <<'EOF'
feat: add debt-concentration-by-customer chart to CxC tab

Stacked horizontal bar chart, one bar per top-15 customer, segments colored
by the existing aging-bucket palette. Reuses the tab's Entidad/Tienda
toggle so it stays in sync with the rest of the tab.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: ERP migration — repair stored procedure + audit table

**Files:**
- Create: `mssql-migrations/0007_pApiCorregirFechaVencimientoFactura.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: stored procedure `pApiCorregirFechaVencimientoFactura(@sCoCli, @dFecDesde, @dFecHasta, @sCoUsIn)` and table `dbo.__exporter_invoice_due_date_fixes(id, co_cli, nro_doc, fec_venc_old, fec_venc_new, co_us_in, fixed_at_utc)` — both consumed by Task 4 (CLI script).

- [ ] **Step 1: Write the migration file**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_invoice_due_date_fixes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_invoice_due_date_fixes (
        id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        co_cli        CHAR(16)      NOT NULL,
        nro_doc       CHAR(20)      NOT NULL,
        fec_venc_old  DATETIME      NOT NULL,
        fec_venc_new  DATETIME      NOT NULL,
        co_us_in      CHAR(6)       NOT NULL,
        fixed_at_utc  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCorregirFechaVencimientoFactura')
    DROP PROCEDURE pApiCorregirFechaVencimientoFactura;
GO

CREATE PROCEDURE [pApiCorregirFechaVencimientoFactura]
    (
      @sCoCli     CHAR(16),
      @dFecDesde  DATE,
      @dFecHasta  DATE,
      @sCoUsIn    CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        -- Verify customer exists
        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
        BEGIN
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCli);
        END

        DECLARE @sCondPag CHAR(6) = (SELECT cond_pag FROM saCliente WHERE co_cli = @sCoCli);

        -- Refuse to run while the customer's own condición de pago is still
        -- Contado (000001) — there is nothing to correct until the customer
        -- record itself has been fixed in Profit Plus.
        IF @sCondPag IS NULL OR @sCondPag = '000001'
        BEGIN
            RAISERROR('Cliente %s tiene condición de pago Contado (000001) — corrija el cliente en Profit Plus antes de ejecutar esta reparación', 16, 1, @sCoCli);
        END

        DECLARE @iDiasCred INT = (SELECT dias_cred FROM saCondicionPago WHERE co_cond = @sCondPag);
        IF @iDiasCred IS NULL
        BEGIN
            RAISERROR('Condición de pago %s del cliente %s no existe en saCondicionPago', 16, 1, @sCondPag, @sCoCli);
        END

        -- Log every row that will change, BEFORE the UPDATE, so fec_venc_old
        -- reflects the pre-fix value.
        INSERT INTO dbo.__exporter_invoice_due_date_fixes (co_cli, nro_doc, fec_venc_old, fec_venc_new, co_us_in)
        SELECT
            d.co_cli,
            d.nro_doc,
            d.fec_venc,
            DATEADD(day, @iDiasCred, d.fec_emis),
            @sCoUsIn
        FROM saDocumentoVenta d
        WHERE d.co_cli = @sCoCli
          AND d.co_tipo_doc = 'FACT'
          AND d.anulado = 0
          AND d.saldo <> 0
          AND CAST(d.fec_emis AS date) BETWEEN @dFecDesde AND @dFecHasta
          AND d.fec_venc = d.fec_emis;

        UPDATE d
        SET d.fec_venc = DATEADD(day, @iDiasCred, d.fec_emis)
        FROM saDocumentoVenta d
        WHERE d.co_cli = @sCoCli
          AND d.co_tipo_doc = 'FACT'
          AND d.anulado = 0
          AND d.saldo <> 0
          AND CAST(d.fec_emis AS date) BETWEEN @dFecDesde AND @dFecHasta
          AND d.fec_venc = d.fec_emis;

        COMMIT TRAN;

        SELECT nro_doc, fec_venc_old, fec_venc_new
        FROM dbo.__exporter_invoice_due_date_fixes
        WHERE co_cli = @sCoCli AND fixed_at_utc >= DATEADD(second, -5, SYSUTCDATETIME())
        ORDER BY nro_doc;
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

*Design notes for the implementer:*
- The `WHERE d.fec_venc = d.fec_emis` filter on both the log-insert and the UPDATE scopes this to exactly the "looks like Contado" population from the audit query (`common_queries/customer_credit_term_mismatch.sql`) — it will not touch invoices that already have a real due date for some other reason.
- `saFacturaVenta.co_cond` is deliberately NOT updated here — the spec's root-cause fix is correcting `saCliente.cond_pag` (done manually by the user in Profit Plus) and then recomputing `fec_venc`; changing the historical `co_cond` value on already-issued invoices is out of scope and riskier (it's a fiscal/audit field on the invoice document itself).
- The final `SELECT` returns the just-fixed rows so the CLI script (Task 4) can print them directly from the procedure's result set on `--apply`, without a second round-trip.

- [ ] **Step 2: Run the migration locally against the dev ERP DB**

Run: `bun run scripts/migrate-mssql.ts`
Expected output includes `0007_pApiCorregirFechaVencimientoFactura.sql` in the applied list (or `✓ No hay migraciones nuevas que aplicar` if already applied from a prior partial run — re-run is safe per the `IF EXISTS`/`IF NOT EXISTS` guards).

- [ ] **Step 3: Verify the procedure and table exist**

Write a throwaway script (do NOT commit) `scripts/tmp-verify-migration-0007.ts`:

```typescript
import { getPool } from '../lib/db/mssql';

async function main() {
  const pool = await getPool();
  const proc = await pool.request().query(`SELECT name FROM sys.procedures WHERE name = 'pApiCorregirFechaVencimientoFactura'`);
  const table = await pool.request().query(`SELECT name FROM sys.tables WHERE name = '__exporter_invoice_due_date_fixes'`);
  console.log('procedure exists:', proc.recordset.length === 1);
  console.log('table exists:', table.recordset.length === 1);
  await pool.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

Run: `bun --bun run --env-file=.env.local scripts/tmp-verify-migration-0007.ts`
Expected: both lines print `true`.

Delete the script after verifying: `rm -f scripts/tmp-verify-migration-0007.ts`

- [ ] **Step 4: Commit**

```bash
git add mssql-migrations/0007_pApiCorregirFechaVencimientoFactura.sql
git commit -m "$(cat <<'EOF'
feat: add pApiCorregirFechaVencimientoFactura stored procedure

Recomputes fec_venc for a customer's open FACT invoices from their current
saCliente.cond_pag/saCondicionPago.dias_cred, but only for invoices that
currently look Contado (fec_venc == fec_emis) and only after confirming
the customer's own cond_pag is no longer Contado. Logs every change to a
new dbo.__exporter_invoice_due_date_fixes audit table before writing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: CLI script — preview and apply

**Files:**
- Create: `scripts/fix-invoice-due-dates.ts`
- Test: `__tests__/integration/fix-invoice-due-dates.integration.test.ts`

**Interfaces:**
- Consumes: `getPool` from `lib/db/mssql.ts`; `pApiCorregirFechaVencimientoFactura` stored procedure and `dbo.__exporter_invoice_due_date_fixes` table (Task 3).
- Produces: an exported `parseArgs(argv: string[])` function and an exported `runFix(options: FixOptions)` function — both used by the integration test; `main()` wires them together for CLI use, following the `if (import.meta.main)` pattern from `scripts/migrate-mssql.ts`.

- [ ] **Step 1: Write the failing test for argument parsing**

Create `__tests__/integration/fix-invoice-due-dates.integration.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { parseArgs } from '@/scripts/fix-invoice-due-dates';

describe('fix-invoice-due-dates parseArgs', () => {
  test('parses required flags without --apply', () => {
    const opts = parseArgs(['--customer=J-306725024-6', '--from=2026-01-01', '--to=2026-09-19']);
    expect(opts).toEqual({
      customer: 'J-306725024-6',
      from: '2026-01-01',
      to: '2026-09-19',
      apply: false,
    });
  });

  test('parses --apply flag', () => {
    const opts = parseArgs(['--customer=J-306725024-6', '--from=2026-01-01', '--to=2026-09-19', '--apply']);
    expect(opts.apply).toBe(true);
  });

  test('throws when --customer is missing', () => {
    expect(() => parseArgs(['--from=2026-01-01', '--to=2026-09-19'])).toThrow(/--customer/);
  });

  test('throws when --from is missing', () => {
    expect(() => parseArgs(['--customer=J-306725024-6', '--to=2026-09-19'])).toThrow(/--from/);
  });

  test('throws when --to is missing', () => {
    expect(() => parseArgs(['--customer=J-306725024-6', '--from=2026-01-01'])).toThrow(/--to/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test __tests__/integration/fix-invoice-due-dates.integration.test.ts`
Expected: FAIL — `scripts/fix-invoice-due-dates.ts` doesn't exist yet.

- [ ] **Step 3: Write the script**

Create `scripts/fix-invoice-due-dates.ts`:

```typescript
import { getPool } from '../lib/db/mssql';

export interface FixOptions {
  customer: string;
  from: string;
  to: string;
  apply: boolean;
}

export function parseArgs(argv: string[]): FixOptions {
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    const match = /^--([a-z]+)=(.+)$/.exec(arg);
    if (match) flags.set(match[1], match[2]);
  }

  const customer = flags.get('customer');
  if (!customer) throw new Error('Missing required flag: --customer=<co_cli>');
  const from = flags.get('from');
  if (!from) throw new Error('Missing required flag: --from=YYYY-MM-DD');
  const to = flags.get('to');
  if (!to) throw new Error('Missing required flag: --to=YYYY-MM-DD');

  return { customer, from, to, apply };
}

interface PreviewRow {
  nro_doc: string;
  fec_venc_old: Date;
  fec_venc_new: Date;
  saldo: number;
}

async function checkGuardrail(pool: Awaited<ReturnType<typeof getPool>>, customer: string): Promise<void> {
  const result = await pool.request()
    .input('coCli', customer)
    .query(`SELECT cond_pag FROM saCliente WHERE co_cli = @coCli`);
  const row = result.recordset[0] as { cond_pag: string | null } | undefined;
  if (!row) throw new Error(`Cliente ${customer} no encontrado`);
  if (!row.cond_pag || row.cond_pag === '000001') {
    throw new Error(
      `Cliente ${customer} tiene condición de pago Contado (000001) — corrija el cliente en Profit Plus antes de ejecutar esta reparación`
    );
  }
}

async function preview(pool: Awaited<ReturnType<typeof getPool>>, options: FixOptions): Promise<PreviewRow[]> {
  const result = await pool.request()
    .input('coCli', options.customer)
    .input('fecDesde', options.from)
    .input('fecHasta', options.to)
    .query(`
      SELECT
        d.nro_doc,
        d.fec_venc AS fec_venc_old,
        DATEADD(day, cp.dias_cred, d.fec_emis) AS fec_venc_new,
        d.saldo
      FROM saDocumentoVenta d
      INNER JOIN saCliente c ON c.co_cli = d.co_cli
      INNER JOIN saCondicionPago cp ON cp.co_cond = c.cond_pag
      WHERE d.co_cli = @coCli
        AND d.co_tipo_doc = 'FACT'
        AND d.anulado = 0
        AND d.saldo <> 0
        AND CAST(d.fec_emis AS date) BETWEEN @fecDesde AND @fecHasta
        AND d.fec_venc = d.fec_emis
      ORDER BY d.nro_doc
    `);
  return result.recordset as PreviewRow[];
}

function printPreview(rows: PreviewRow[]): void {
  if (rows.length === 0) {
    console.log('No invoices match — nothing to fix in this range.');
    return;
  }
  console.table(
    rows.map(r => ({
      nro_doc: r.nro_doc,
      fec_venc_old: r.fec_venc_old,
      fec_venc_new: r.fec_venc_new,
      saldo: r.saldo,
    }))
  );
}

export async function runFix(options: FixOptions): Promise<void> {
  const pool = await getPool();
  try {
    await checkGuardrail(pool, options.customer);

    const previewRows = await preview(pool, options);
    printPreview(previewRows);

    if (!options.apply) {
      console.log(`\n${previewRows.length} invoice(s) would change. Re-run with --apply to write these changes.`);
      return;
    }

    if (previewRows.length === 0) {
      return;
    }

    // .input() labels here bind BY NAME over the TDS RPC wire protocol
    // (mssql/tedious write "@<label>" for every parameter on .execute()) —
    // unlike .query(), where the label is just the placeholder text you
    // write into the SQL string yourself. These four labels must match the
    // stored procedure's actual declared parameter names exactly (no
    // leading @, the driver adds it), or SQL Server rejects the call before
    // any statement runs.
    const result = await pool.request()
      .input('sCoCli', options.customer)
      .input('dFecDesde', options.from)
      .input('dFecHasta', options.to)
      .input('sCoUsIn', 'SYSTEM')
      .execute('pApiCorregirFechaVencimientoFactura');

    console.log(`\nApplied. ${result.recordset.length} invoice(s) updated:`);
    console.table(result.recordset);
    console.log(`\nRun 'bun run scripts/dwh-snapshot-load.ts' to refresh the CxC dashboard.`);
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  try {
    const options = parseArgs(process.argv.slice(2));
    runFix(options)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('[fix-invoice-due-dates] fatal error:', err instanceof Error ? err.message : err);
        process.exit(1);
      });
  } catch (err) {
    console.error('[fix-invoice-due-dates]', err instanceof Error ? err.message : err);
    console.error('Usage: bun run scripts/fix-invoice-due-dates.ts --customer=<co_cli> --from=YYYY-MM-DD --to=YYYY-MM-DD [--apply]');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test __tests__/integration/fix-invoice-due-dates.integration.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit`
Expected: no new errors.

Run: `bunx eslint scripts/fix-invoice-due-dates.ts __tests__/integration/fix-invoice-due-dates.integration.test.ts`
Expected: no new errors.

- [ ] **Step 6: Manual dry-run against the dev ERP DB**

Run: `bun --bun run --env-file=.env.local scripts/fix-invoice-due-dates.ts --customer="J-306725024-6" --from=2026-01-01 --to=2026-09-19`

Expected: either the guardrail error (if this customer's `cond_pag` hasn't been corrected in this environment's ERP data yet — expected, since the real fix happens in production Profit Plus, not here), or a preview table. Confirm the script does NOT write anything (no `--apply` passed) — re-run the same command a second time and confirm identical output (idempotent read-only preview).

- [ ] **Step 7: Commit**

```bash
git add scripts/fix-invoice-due-dates.ts __tests__/integration/fix-invoice-due-dates.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: add fix-invoice-due-dates CLI for the CxC due-date repair

Dry-run by default: previews which open FACT invoices would have fec_venc
recomputed from the customer's current credit terms, and refuses to run at
all while the customer's own cond_pag is still Contado. --apply invokes
pApiCorregirFechaVencimientoFactura to actually write the change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage**: Part 1 (chart) → Tasks 1-2. Part 2 (stored procedure + audit table + CLI) → Tasks 3-4. Every spec section has a task.
- **Placeholder scan**: no TBD/TODO; every step has literal code.
- **Type consistency**: `DebtConcentrationRow`/`DebtConcentrationResponse` (Task 1) are the exact names consumed in Task 2's `import type` line. `FixOptions`/`parseArgs`/`runFix` (Task 4) are the exact names the test imports. `pApiCorregirFechaVencimientoFactura`'s parameter names (`@sCoCli`, `@dFecDesde`, `@dFecHasta`, `@sCoUsIn`) MUST match the `.input('sCoCli', ...)` etc. labels in Task 4's `runFix` `.execute()` call exactly (no leading `@`) — corrected during implementation review: `mssql`'s `.execute()` binds parameters BY NAME over the TDS RPC protocol, not positionally, so a label mismatch fails the call at the RPC layer before any statement in the procedure runs. (`.input()` calls used with `.query()`, in `checkGuardrail`/`preview`, are unaffected by this — there the label is simply the placeholder text referenced in the SQL string itself, correct as originally written.)
