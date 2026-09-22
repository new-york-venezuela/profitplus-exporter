# Active Customer Visit Cadence

Date: 2026-09-21
Status: Approved, pending implementation plan

## Context

Fourth of four related specs (see
`2026-09-21-profundidad-linea-tab-design.md` for the full list and shared
context). Sales are used as a proxy for visits: if a seller is expected to
visit a customer weekly, a week without a sale means (probably) a missed
visit. The user wants to know, per customer, how often they're actually
buying — primarily as a plain frequency view, with an optional manual
target for comparison, not the other way around (confirmed with user: "more
important that we show how many sales per week/month than comparing it
against a target").

### What already exists

The Clientes tab (`app/api/dwh/clientes/route.ts`,
`app/(app)/analitica/tabs/tab-clientes.tsx`) already has:
- `trendQuery`/`handleTrend`: monthly active-customer counts and month-over-
  month churn rate, at either legal-entity or tienda grain
  (`clienteDimension` param).
- `churnedQuery`/`handleChurned`: customers with ≥1 sale in the prior period
  but none in the current period, with last-purchase date and lost revenue.

These answer "is the customer base as a whole growing/shrinking" and "who
disappeared entirely." Neither answers this spec's actual question: **for a
customer who is still active, how often are they buying, and is that
slowing down** — the gap this spec fills.

### Confirmed: no cadence/frequency field exists anywhere in Profit Plus

Searched `saCliente`, `saZona`, and the knowledge base for any
visit-frequency, route-schedule, or periodicity concept — none exists. Route
codes exist (`saZona`'s `CCS-02`/`CCS-05`/etc. "Ruta N" values, noted in
`saZona`'s KB doc) but only as a geographic/delivery grouping, not a
schedule. Expected cadence has no source of truth anywhere in the ERP and
must be entered manually if used at all (confirmed with user).

## Design

### Primary view: per-customer sales frequency (no target needed)

New section, either as a new tab (`Cadencia` or similar) or a new section
within the existing Clientes tab — **recommendation: new tab**, since this
is a distinct question from Clientes' existing Pareto/churn framing and
would otherwise overload an already-dense tab (466 lines). Final placement
decided at implementation time if the user prefers folding it into Clientes
instead.

Core table, one row per active legal entity (reusing `Dim_LegalEntity`,
consistent with every other spec in this batch): days since last sale,
count of distinct sale-days in the selected range, and an average
inter-purchase gap (days between consecutive purchases, averaged over the
range) — this last figure is the actual "how many sales per week/month"
answer, expressed as a gap so it reads naturally against a weekly/biweekly
mental model ("cada 6 días" is more directly actionable than "0.16 veces
por día").

```sql
;WITH PurchaseDays AS (
  SELECT DISTINCT le.LegalEntityKey, d.FullDate
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
  JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
  WHERE fs.IsVoided = 0 <dateWhere>
),
Gaps AS (
  SELECT
    LegalEntityKey,
    FullDate,
    DATEDIFF(day, LAG(FullDate) OVER (PARTITION BY LegalEntityKey ORDER BY FullDate), FullDate) AS GapDays
  FROM PurchaseDays
)
SELECT
  le.LegalEntityKey,
  le.LegalEntityName,
  COUNT(DISTINCT pd.FullDate) AS PurchaseDayCount,
  AVG(CAST(g.GapDays AS float)) AS AvgGapDays,
  MAX(pd.FullDate) AS LastPurchaseDate,
  DATEDIFF(day, MAX(pd.FullDate), GETDATE()) AS DaysSinceLastPurchase
FROM dim.Dim_LegalEntity le
JOIN PurchaseDays pd ON pd.LegalEntityKey = le.LegalEntityKey
LEFT JOIN Gaps g ON g.LegalEntityKey = le.LegalEntityKey AND g.GapDays IS NOT NULL
GROUP BY le.LegalEntityKey, le.LegalEntityName
ORDER BY DaysSinceLastPurchase DESC
```

Sorted by `DaysSinceLastPurchase` descending by default — the customers
going quietest float to the top, which is the actionable read even before
any target is set.

### Secondary, optional overlay: manual per-customer/segment target

New SQLite table, following the existing `inventory_settings`-style
convention (`lib/db/schema.ts`):

```typescript
export const visitCadenceTargets = sqliteTable('visit_cadence_targets', {
  id:                 integer('id').primaryKey({ autoIncrement: true }),
  legalEntityKey:     integer('legal_entity_key').unique(), // null = segment-level default
  segmentCode:        text('segment_code'),                 // 'CADENA' | 'INDEPENDIENTES', used when legalEntityKey is null
  targetGapDays:      integer('target_gap_days').notNull(), // e.g. 7 = expected weekly
});
```

A row with `legalEntityKey` set overrides any segment-level default for that
specific entity; a row with `legalEntityKey NULL` and `segmentCode` set
defines a fallback for every entity in that segment without its own
override. This mirrors the specificity pattern already used elsewhere in
this codebase (e.g. per-user module grants overriding role defaults) rather
than inventing a new precedence scheme.

When a target exists (entity-specific or segment-level), the main table
gains an `isOverdue` flag (`DaysSinceLastPurchase > targetGapDays`) and
sorts overdue customers to the top within their segment. When no target
exists for a customer, the row simply shows its frequency data with no
overdue flag — consistent with the "frequency first, target optional"
priority the user set.

New API routes: `GET/POST/DELETE
app/api/admin/cadencia-targets/route.ts` (or nested under the new tab's own
API, decide at implementation time based on whether target management is
admin-only or open to any dwh-access user — **recommendation: dwh-access is
enough**, since this is an operational sales tool, not an admin/security
setting, unlike the existing `admin/*` routes which gate on `role ===
'admin'`). Simple CRUD following the existing `hasDwhAccess()` gate used by
every other route in this batch, both on the page and the API route
independently per this codebase's established convention.

### Types

```typescript
export interface CadenceRow {
  legalEntityKey: number;
  legalEntityName: string;
  purchaseDayCount: number;
  avgGapDays: number | null;      // null if only one purchase in range (no gap to compute)
  lastPurchaseDate: string;       // ISO date
  daysSinceLastPurchase: number;
  segment: CustomerSegment | null; // reuses spec 1's CustomerSegment type
  targetGapDays: number | null;    // resolved: entity override, else segment default, else null
  isOverdue: boolean | null;       // null when no target resolves for this entity
}

export interface CadenceResponse {
  rows: CadenceRow[];
}
```

### UI

New tab, table sorted by `daysSinceLastPurchase` descending, with segment
as a filter (reusing the CADENA/INDEPENDIENTES filter pattern from spec 1).
Rows with a resolved target show a red/amber badge when `isOverdue`; rows
without a target show only the plain frequency figures, no badge — avoiding
implying non-compliance where no expectation was ever set. Target
management (setting `targetGapDays` per entity or per segment) is a small
inline edit affordance on each row plus a segment-default control at the
top of the tab, not a separate settings page — consistent with how
`inventory_settings` is edited inline in `config-inventario` rather than
through a generic settings form.

### Error handling / edge cases

- An entity with exactly one purchase in range has `avgGapDays = null` (no
  second data point to diff against) — shown as "—", not `0`.
- `DaysSinceLastPurchase` is computed against `GETDATE()` regardless of the
  selected date range's end — this is intentionally always "how overdue are
  they right now," not relative to a historical report window, since the
  entire point is current operational visibility.
- An entity with zero purchases in the selected range at all doesn't appear
  in this view (it belongs to the existing churned-customers list in
  Clientes instead) — this view is scoped to customers with *some* recent
  activity whose cadence may be slipping, not customers who are already
  gone.

## Testing

- Unit test for target resolution precedence (entity override → segment
  default → null), pure function, same pattern as prior specs.
- Route test for the cadence query and for the CRUD target routes
  (following `app/api/dwh/vendedores/__tests__/route.test.ts`'s mocking
  pattern for the DWH read side, and the existing SQLite-route test pattern
  — e.g. `app/api/dwh/clientes/__tests__/route.test.ts` — for whichever is
  closer to the final route shape).
- Manual check against live data: confirm `AvgGapDays` for a handful of
  known-frequent customers looks sane (e.g. matches what's visible by eye
  in their raw invoice list) before trusting the aggregate.

## Out of scope

- Any statistical inference of cadence from history as a *default* target
  (explicitly deferred — user chose manual-only for now; historical
  inference could be revisited later as a suggested starting value, but
  isn't part of this spec).
- Route-based (`saZona` "Ruta N") scheduling — noted as a possible future
  target-setting convenience (set once per route instead of per customer)
  but not built here, since it adds a second precedence layer not
  requested.
- Any connection to the seller/commission specs (2, 3) — cadence here is
  purely about customer purchase frequency, not seller performance
  attribution.
