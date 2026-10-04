# CxC: granularity on trends, vencido vs. corriente in concentration, collection-priority ordering

Sub-project 5 of 5.

## Goal

1. DSO and aging trend charts honour daily / weekly / monthly granularity, with the same rules as Resumen/Ventas.
2. "Mayor concentración de crédito" (top 10) distinguishes **vencido** from **al corriente**.
3. "Concentración de deuda por cliente" (top 15) is ordered so the bars reflect collection priority.

## 1. Granularity for trends

- Add `'cxc'` to `GRANULARITY_TABS` in `analitica-client.tsx`; the tab already receives `granularity` via
  `TabComponentProps`. Rules come from `lib/granularity.ts` (`allowedGranularities`/`resolveGranularity`):
  daily or weekly for ranges up to a month, weekly for ranges up to a year, monthly otherwise. No new rules.
- Affected charts: **DSO** (`DSO_TREND_QUERY`) and **Antigüedad de saldos en el tiempo** (`agingTrend`). Both
  group snapshots by `YearMonth` today, which is why a short range yields only two points.
- Both are snapshot based, so each bucket (day, ISO week, month) uses the **last snapshot inside the bucket**
  (`MAX(SnapshotDateKey)` per bucket, bucket keys from `Dim_Date` incl. the week column from migration 0033).
  A bucket with no snapshot is omitted (no interpolation) and the chart uses `connectNulls={false}` where a
  line is drawn. If snapshots are only taken some days, granularity `day` shows only the days that have one.
- DSO per bucket = AR balance at the bucket's last snapshot ÷ net sales in the trailing period × days, using the
  same trailing-period rule as today but computed per bucket; keep that definition in the in-app help page. The
  `snapshotDate` is shown in the tooltip so the user knows which day each point represents.
- The chart range follows the page `dateRange` (today they may ignore it; the route must filter snapshots to
  the range, windowed with `.input()` bounds).
- Route: accept `granularity` (validated against `allowedGranularities`, same helper as other routes) and return
  `{ bucketKey, label, ... }` rows. Update `types.ts` (`DsoTrendRow`, `AgingTrendRow`).

## 2. Top 10 concentración: vencido vs. al corriente

- Today `topDebtors` returns total outstanding per customer. Extend each `DebtorRow` with `overdue` and `current`
  (`AgingBucket`/`DaysPastDue > 0` = vencido, `<= 0` or no past-due = al corriente), plus `overdueShare` per row.
  Totals must reconcile: `overdue + current = total`.
- UI: stacked bars or two columns: **Vencido** (red) and **Al corriente** (green), with a text label ("Vencido
  62%") so colour isn't the only signal. Rows stay ordered by total outstanding (this card is about
  concentration); sort affordances on the columns are optional.

## 3. Top 15 deuda por cliente: priority order

- Order by **vencido amount descending** (agreed): the sum of every bucket past its due date, in the current
  currency (USD via the snapshot-date rate as today). Ties by total outstanding.
- Chart: stacked horizontal bars by aging bucket as now, but the not-yet-due ("Al corriente") portion is a
  neutral grey and drawn **last**, so the coloured vencido part starts at the axis and bar length from the
  axis = urgency. Overdue buckets use a sequential light→dark red scale (1-30 lightest, 90+ darkest).
- Subtitle states the rule: "Ordenado por saldo vencido (mayor primero)". Show the vencido amount and share in
  the tooltip. The top 15 is chosen **by vencido**, not by total outstanding (this is a change from today:
  a customer with big current debt but no overdue no longer displaces overdue ones).
- Route: `debtConcentrationQuery` computes vencido per customer and orders/limits on it (`TOP 15`); the `rows`
  shape keeps `buckets` and adds `overdueTotal`.

## Testing

- Unit tests: bucketing of snapshots into day/week/month (last snapshot per bucket, empty buckets omitted).
- Route tests with seeded snapshots: granularity validation (400/fallback like other routes), the reconcile
  invariant `overdue + current = total`, and that the top-15 is selected and ordered by vencido.
- Browser check of the three charts after implementation.
