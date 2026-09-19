# CxC Debt Concentration Chart + Invoice Due-Date Repair Tooling

Date: 2026-09-19
Status: Approved, pending implementation plan

## Context

The CxC tab's "% vencido" KPI reads ~85% in production, which looked suspicious.
Investigated end-to-end this session:

1. **Data freshness ruled out**: `common_queries/ar_data_freshness_check.sql` against
   production showed both `saDocumentoVenta` (invoices) and `saCobro` (collections)
   are being written to within 1 day of "now" — the ETL/ERP sync is not stale.
2. **Aging bucket SQL confirmed correct**: `dwh-migrations/0012_fact_ar_snapshot.sql`'s
   `AgingBucket` CASE and `app/api/dwh/cxc/route.ts`'s `overdueShare` both compute
   exactly what they're supposed to from `fec_venc` (due date). No bug in either.
3. **Root cause**: `common_queries/ar_aging_bucket_audit.sql` showed 376 of 456 open
   `FACT` invoices (~82%, ~$20M of $24.6M open balance) have `fec_venc == fec_emis`
   — i.e., a 0-day credit term. Cross-referenced via the profit-plus-knowledge-base
   MCP: `saCondicionPago.dias_cred` is the number of days added to `fec_emis` to
   compute a document's default `fec_venc`; `co_cond = '000001'` = "Contado"
   (0 días), by design. A Contado invoice is *correctly* overdue the day after
   billing — that's not a bug, it's the definition of a cash-basis sale.
4. **Tested the misconfiguration hypothesis** (`common_queries/customer_credit_term_mismatch.sql`):
   is the 82% actually credit customers who got billed as Contado by mistake?
   Confirmed **partially true but small**: only 2 customers (AUTOMERCADOS PLAZA S
   San Bernardino, AUTOMERCADO LA MURALLA) and 6 invoices, $116,431.64 total
   (~0.47% of open FACT balance), have `saFacturaVenta.co_cond` disagreeing with
   the customer's own `saCliente.cond_pag` default. The other ~98% of "Contado-
   looking" balance belongs to customers who are genuinely, correctly configured
   as Contado. The 85% "vencido" figure is real and mostly *not* a bug — it's
   mostly a natural consequence of most of the customer base being 0-day-term.

Decision (from user): leave the aging/overdue definition as-is (no grace period,
no redefinition of "vencido" for Contado) — it's honest given `dias_cred = 0`.
Ship two things instead:

- Visibility into *where* debt concentrates by customer and aging bucket, to
  prioritize collections/investigation.
- Tooling to fix the confirmed 2-customer/6-invoice misconfiguration in
  production — and any future ones like it — once the customer's `saCliente.cond_pag`
  has been corrected in Profit Plus directly (out of scope here; that's a
  manual ERP data-entry fix the user does themselves).

## Part 1 — Debt concentration chart (CxC tab, read-only)

New stacked bar chart in `app/(app)/analitica/tabs/tab-cxc.tsx`, backed by a new
`section=debtConcentration` branch in `app/api/dwh/cxc/route.ts`, following the
exact `section=`-dispatch pattern already used by `app/api/dwh/productos/route.ts`
and this session's `app/api/dwh/ventas/route.ts` additions.

- Query: top 15 customers (via `getDimensionSpec('cliente_entidad')`, same as
  `topDebtorsQuery` in the existing route) by total `OutstandingBalance` from
  `fact.Fact_AR_Snapshot` at the latest `snapshotDateKey`, joined/grouped by
  `AgingBucket` (excluding `IsCreditNote = 1` rows, same as `AGING_BUCKETS_QUERY`).
- Response shape (new types in `app/(app)/analitica/types.ts`, alongside the
  existing `AgingBucketRow`/`DebtorRow`):
  ```typescript
  export interface DebtConcentrationRow {
    name: string; // LegalEntityName
    buckets: AgingBucketRow[]; // same 5-bucket shape as AgingTrendRow.buckets
  }
  export interface DebtConcentrationResponse {
    rows: DebtConcentrationRow[];
    usdRate: number | null;
  }
  ```
- UI: stacked `BarChart`, one bar per customer (horizontal, since customer names
  are long — same orientation precedent as Resumen's "Top 10 clientes" bar),
  segments colored with the existing `BUCKET_COLORS` palette from `tab-cxc.tsx`,
  entidad/tienda toggle reused from the tab's existing `clienteDimension` state
  (no new state needed — the fetch effect just adds this as a third query keyed
  on the same `clienteDimension`).
- No write capability, no new risk — this is the same shape as every other
  CxC/Resumen chart already shipped.

## Part 2 — Invoice due-date repair tooling (writes to production ERP)

### Stored procedure: `mssql-migrations/0007_pApiCorregirFechaVencimientoFactura.sql`

```sql
CREATE PROCEDURE [pApiCorregirFechaVencimientoFactura]
    (
      @sCoCli     CHAR(16),
      @dFecDesde  DATE,
      @dFecHasta  DATE,
      @sCoUsIn    CHAR(6)
    )
AS
BEGIN
    -- Recomputes fec_venc for this customer's open, non-voided FACT invoices
    -- in [@dFecDesde, @dFecHasta] (by fec_emis), using the customer's CURRENT
    -- saCliente.cond_pag -> saCondicionPago.dias_cred. Refuses to run if the
    -- customer's current cond_pag is still '000001' (Contado) — that means
    -- there's nothing to correct (or the ERP-side fix hasn't been made yet).
    -- Every changed row is logged to dbo.__exporter_invoice_due_date_fixes
    -- (old fec_venc, new fec_venc, co_us_in, timestamp) before the UPDATE,
    -- wrapped in one transaction, same TRY/CATCH + RAISERROR pattern as
    -- 0006_pApiCambiarUnidadArticulo.sql.
END
```

New audit table in the same migration file:
```sql
CREATE TABLE dbo.__exporter_invoice_due_date_fixes (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    co_cli        CHAR(16)      NOT NULL,
    nro_doc       CHAR(20)      NOT NULL,
    fec_venc_old  DATETIME      NOT NULL,
    fec_venc_new  DATETIME      NOT NULL,
    co_us_in      CHAR(6)       NOT NULL,
    fixed_at_utc  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);
```

### CLI script: `scripts/fix-invoice-due-dates.ts`

```
bun run scripts/fix-invoice-due-dates.ts --customer=<co_cli> --from=YYYY-MM-DD --to=YYYY-MM-DD [--apply]
```

- Connects via `lib/db/mssql.ts`'s `getPool()` (ERP pool), following
  `scripts/send-invoice-reminders.ts`'s connect/try/finally-close pattern.
- **Guardrail**: before doing anything, checks `saCliente.cond_pag` for
  `@sCoCli`. If it's still `'000001'`, exits with an error telling the user to
  fix the customer's condición de pago in Profit Plus first — this prevents
  running the repair before the actual root cause (customer misconfiguration)
  has been addressed.
- **Preview (default, no `--apply`)**: runs a plain `SELECT` mirroring the
  stored procedure's logic (same join: `saDocumentoVenta` → `saCliente` →
  `saCondicionPago`) and prints a table of every invoice that would change —
  `nro_doc`, current `fec_venc`, computed new `fec_venc`, `saldo`. No writes.
- **Apply (`--apply`)**: calls `pApiCorregirFechaVencimientoFactura` via
  `.input()` parameters (never string-concatenated), prints the same
  before/after table using the procedure's actual result, then prints a
  reminder: `Run 'bun run scripts/dwh-snapshot-load.ts' to refresh the CxC
  dashboard.` (per user decision, this is not auto-chained — kept as a
  separate, deliberate step).
- Confirmed scope-limited to `FACT` documents only (not `N/CR`/`N/DB`), open
  balances only (`saldo <> 0`), non-voided only (`anulado = 0`) — same filters
  used throughout every CxC/aging query already in this codebase.

## Testing

- Part 1 (chart): same manual verification approach as this session's Ventas
  work — a standalone script run via `bun --bun run --env-file=.env.local`
  against the live DWH to confirm the new query returns sane data (top
  customers × 5 buckets), since Chrome browser automation is unavailable in
  this environment. `tsc --noEmit` / `eslint` on the 3 touched files.
- Part 2 (repair tooling): dry-run (`--apply` omitted) against production for
  the 2 known customers first, manually diff the preview output against
  `common_queries/customer_credit_term_mismatch.sql`'s query 2 results to
  confirm they match exactly, before ever running with `--apply`. The
  guardrail (refuses to run while `cond_pag = '000001'`) is itself testable
  against a customer that hasn't been fixed yet.
