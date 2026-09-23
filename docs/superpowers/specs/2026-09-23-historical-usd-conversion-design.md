# Historical (Per-Transaction) USD Conversion Across Analítica

Date: 2026-09-23
Status: Approved, pending implementation plan

## Context

Discovered while designing `2026-09-23-seller-product-store-matrix-design.md`:
every existing Analítica/DWH route that offers a `currency=usd` toggle
converts BS→USD by dividing an already-summed BS total by a single
**current** exchange rate (`getUsdRate()` in `app/api/dwh/lib/query-builder.ts`,
which reads the latest row in `fact.Fact_ExchangeRate`) — applied uniformly
to every row in the result, regardless of that row's own transaction date.

Concretely, today's pattern everywhere is:

1. SQL: `SUM(fs.NetAmount) AS SalesNet` (raw BS, summed first).
2. Route: `currency === 'usd' ? await getUsdRate() : null`.
3. Response: ships the raw BS total plus a single `usdRate` number.
4. Client (`app/(app)/analitica/lib/format.ts`'s `money()`): `n = n / rate` at
   render time, applied to that already-summed BS number.

Because `NetAmount` is stored in the ERP's base currency (BS — confirmed
live, `par_emp.g_moneda = 'BSD'`; see `erp_currency_bsd_usd` memory) and this
business's currency has devalued over time, dividing a 12-month BS total (or
any BS figure from a past period) by *today's* rate manufactures fictitious
trend movement: real historical USD income looks like it's growing or
shrinking purely because the BS/USD rate moved, not because the underlying
business did. Every chart, KPI, and table with a currency toggle across the
whole Analítica dashboard is affected.

This is a correctness bug in already-shipped code, not new-feature scope. It
blocks the seller-matrix spec's own "Ingreso USD" export column, which is
why it surfaced now, but it needs its own fix, plan, and review — this spec
covers only this fix.

## Scope

### In scope: 5 fact tables with a usable per-row rate

`fact.Fact_Sales`, `fact.Fact_Returns`, `fact.Fact_Collections`,
`fact.Fact_AR_Snapshot`, and `fact.Fact_Purchases` all carry a
`DocumentExchangeRate decimal(21,8) NULL` column, sourced directly from the
originating ERP document's own rate at the time it was recorded (e.g.
`saFacturaVenta.tasa`, `saDocumentoVenta.tasa`) — confirmed by reading each
table's `dwh-migrations/*.sql` load procedure. This column exists and is
populated today; it is simply never read by any route. This spec wires it
in.

Confirmed with the user: no ERP document is ever recorded directly in USD
(`co_mone` is always the base currency for sales/returns/collections/AR/
purchases) — every `Load_Fact_*` procedure for these 5 tables already
assumes this implicitly (none branches on `co_mone`/`CurrencyKey` when
populating `NetAmount`/`OutstandingBalance`). So `NetAmount / DocumentExchangeRate`
is always a valid BS→USD conversion for these tables; no currency-code
branching is needed.

**Routes touched**: every file calling the shared `getUsdRate()` against one
of these 5 tables — `ventas`, `resumen`, `profundidad-linea`, `cxc`,
`productos`, `clientes`, `vendedores`, `devoluciones`, `compras` — plus the
shared `query-builder.ts` itself.

**`app/api/dwh/dashboard/route.ts` — delete, don't fix.** This route has
the same current-rate bug (its own inline `EXCHANGE_RATE_QUERY`, not the
shared `getUsdRate()`), but confirmed live during this spec's review that
nothing under `app/` references `/api/dwh/dashboard` — the live Resumen tab
calls `/api/dwh/resumen` instead. It's dead code superseded by `resumen`.
User decision: delete `app/api/dwh/dashboard/` entirely as part of this
spec's implementation rather than fix a bug in an unreferenced route.

### Out of scope (phase 2, separate future spec)

`fact.Fact_Expenses` and `fact.Fact_CashMovements` have **no**
exchange-rate or currency column at all (confirmed: no `ExchangeRate`/
`CurrencyKey` column in either table's `CREATE TABLE`). Historical per-row
conversion is structurally impossible for these until a schema + `Load_*`
ETL change captures a rate at load time (likely by joining each source row's
own date against `saTasa`/`Fact_ExchangeRate` during load, the same way
`Fact_AR_Snapshot` already captures `d.tasa` from its ERP source). The
routes reading these tables — `finanzas` and `multimoneda` — are **not**
touched by this spec and keep today's current-rate-only behavior. This is a
known, explicitly deferred gap, not an oversight.

## Design

### 1. Shared conversion in `query-builder.ts`

Add a fact-aware SQL helper that every affected query's `SUM(NetAmount)`
routes through. For a fact table aliased `f` with a `DocumentExchangeRate`
column:

```sql
LEFT JOIN fact.Fact_ExchangeRate fx
  ON fx.DateKey = f.DateKey AND fx.CurrencyKey = @usdCurrencyKey
```

joined once per query (not per aggregate), and every money aggregate becomes
a pair:

```sql
SUM(f.NetAmount) AS AmountBs,
SUM(f.NetAmount / NULLIF(COALESCE(f.DocumentExchangeRate, fx.RateSell), 0)) AS AmountUsd
```

Per-row division happens **before** the `SUM`, which is the actual fix — a
`(seller, product, week)` group that spans multiple invoices at different
historical rates gets each invoice converted at its own rate, then summed,
rather than the whole group's BS total divided by one rate.

**Missing-rate fallback** (confirmed with user): when a row's own
`DocumentExchangeRate` is `NULL` or `0`, fall back to that row's own
`DateKey`'s rate in `fact.Fact_ExchangeRate` (already loaded independently
from `saTasa`, unrelated to the document itself) via the `fx` join above.
`NULLIF(..., 0)` on the final divisor means a row with neither a document
rate nor a same-day exchange rate produces `NULL` for `AmountUsd` (excluded
from the USD sum, included in BS) rather than a divide-by-zero error or a
silently wrong 0.

**`Fact_AR_Snapshot` note:** `OutstandingBalance`/`DocumentExchangeRate` is a
point-in-time value keyed to the invoice's own recorded rate (`d.tasa` at
load time), not the snapshot date — no special-casing needed; the same
per-row expression applies unchanged.

`getUsdRate()` (single latest-rate lookup) stays in `query-builder.ts` for
now — it becomes dead code once every call site is migrated in this same
spec's implementation, and should be deleted at the end of the plan (verify
zero remaining call sites before removing it, so nothing outside this
spec's scope was silently relying on it).

### 2. Every route response ships both currencies, always

Per user decision, the client no longer performs any BS→USD division. Every
route drops its `currency` query-param branch (`currency === 'usd' ?
getUsdRate() : null`) and instead always computes both amounts server-side.
Every money field across every response type in
`app/(app)/analitica/types.ts` changes shape:

```typescript
// Before
salesNet: number;

// After
salesNet: { bs: number; usd: number | null }; // usd null only when no rate was resolvable for every underlying row
```

This applies to every field currently paired with a `usdRate` — confirmed
by the earlier `grep` of `types.ts`: `salesNet`, `netRevenue`, `avgTicket`,
`salesPerActiveClient`, `margin`'s underlying amounts, `lostRevenue`,
`avgMonthlyPrice`, `totalSalesNet`, per-línea `salesNet` maps, `Outstanding`
figures in CxC, etc. — the implementation plan enumerates the exact field
list per file since `types.ts` is the single source of truth for response
shapes.

`usdRate` and the `currency` request query param are removed from every
response type and every route handler in scope. `DateRange`/`GroupBy`/other
non-money fields are unaffected.

### 3. Client: `lib/format.ts` and every consuming tab

`money()`, `moneyLabel()`, `moneyTooltip()` in
`app/(app)/analitica/lib/format.ts` drop the `rate` parameter entirely —
they take the already-resolved `{ bs, usd }` pair (or just the one number
the caller has already selected) and format it, with no division:

```typescript
// Before
export function money(n: number, currency: Currency = 'bs', rate?: number): string {
  if (currency === 'usd' && rate) n = n / rate;
  ...
}

// After
export function money(amount: { bs: number; usd: number | null }, currency: Currency): string {
  const n = currency === 'usd' ? amount.usd : amount.bs;
  if (n === null) return '—'; // no resolvable rate for this figure
  ...
}
```

Every tab component (`tab-resumen`, `tab-ventas`, `tab-clientes`,
`tab-productos`, `tab-profundidad`, `tab-vendedores`, `tab-cxc`,
`tab-devoluciones`, `tab-compras` — all 9 confirmed via the earlier `grep`
of `moneyLabel`/`moneyTooltip` usage, excluding `tab-finanzas` since
Finanzas is out of scope) updates its call sites from
`moneyLabel(row.salesNet, currency, rate)` to
`moneyLabel(row.salesNet, currency)`, and drops any local `usdRate` state
that only existed to thread the rate through props.

### 4. Migration/backfill

No new column or migration needed — `DocumentExchangeRate` already exists
and is populated on all 5 in-scope fact tables. This is purely a query and
API-shape change, not a data change.

## Non-goals

- No fix for `Fact_Expenses`/`Fact_CashMovements` (`finanzas`,
  `multimoneda` routes) — explicitly deferred, needs its own schema/ETL
  spec first.
- No change to how `Fact_ExchangeRate` itself is loaded or to
  `Load_Fact_ExchangeRate`.
- No new currency beyond BS/USD — `Dim_Currency` may have other rows, but
  this dashboard has only ever offered a BS/USD toggle and continues to.
- No change to the new seller-matrix feature's own spec beyond unblocking
  its dependency — once this ships, that spec's "Ingreso USD"/"Devolución
  USD" export columns call the same shared per-row conversion expression
  this spec introduces, rather than inventing a separate one.

## Testing

- Update every existing route test (`__tests__/route.test.ts` under each
  affected `app/api/dwh/*/`) to assert the new `{ bs, usd }` shape and to
  seed test fixtures with varying `DocumentExchangeRate` values across the
  date range under test, verifying the historical-conversion math directly
  (e.g. two same-BS-amount rows at different rates must NOT produce equal
  USD amounts).
- A dedicated test for the missing-rate fallback: a row with
  `DocumentExchangeRate = NULL` falls back to `Fact_ExchangeRate` for its
  own `DateKey`; a row with neither produces `usd: null` for that
  aggregate, not a crash or a silent 0.
- `lib/format.test.ts` (existing) updated for the new `money()`/
  `moneyLabel()` signatures.
- Manual verification in-browser (per this repo's convention — no existing
  component-level tests for these tabs) that every affected tab's currency
  toggle still renders correctly and that a multi-month trend chart in USD
  no longer shows the artificial devaluation-driven curve.

## Open items resolved during brainstorming

- **Fix scope**: two-phase — fix the 5 tables with a usable rate now;
  Expenses/CashMovements deferred to a separate future spec (needs
  schema+ETL work first) — confirmed.
- **Where conversion happens**: server always computes and returns both BS
  and USD; the client-side `currency` toggle only selects which field to
  display, with zero client-side division — confirmed (stronger option,
  closes off the whole bug class rather than just fixing today's call
  sites).
- **Missing/zero rate fallback**: fall back to that row's own date's
  `Fact_ExchangeRate.RateSell`; only `null` if that's also unavailable —
  confirmed.
- **Invoice currency assumption**: confirmed directly by the user — every
  in-scope ERP document is always recorded in BS, never issued directly in
  USD, so no `co_mone` branching is needed in the conversion expression.
- **Plan structure**: one continuous implementation plan, no phased
  checkpoints — confirmed.
- **Dead `dashboard` route**: confirmed unreferenced anywhere in `app/`;
  delete rather than fix — confirmed.
