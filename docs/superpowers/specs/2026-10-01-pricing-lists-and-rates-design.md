# Pricing Workspace: Price Lists & Rates — Design Spec (Sub-project 2 of 4)

**Status:** Design approved in conversation (sections 1 and 2). Awaiting written-spec review.

**Depends on:** `2026-10-01-pricing-segments-workspace-design.md` (sub-project 1):
the `/pricing` tab shell, `pricing_audit_log`, `requirePricingAccess`.
**Followed by:** sub-project 3 (promotions) reuses this spec's rate-write
algorithm and grid.

## 1. Purpose

Let pricing staff create price lists, clone them, and change article rates
with full history, using either a price or a percentage as the input.
Provide a read-only article lookup showing an article's price in every list.

## 2. Key decisions (from brainstorming)

1. **Rate changes are close-and-insert.** The old `saArtPrecio` row gets
   `hasta = effectiveFrom − 1` and a new row starts at `desde = effectiveFrom`.
   History is preserved, and future-dated (scheduled) changes work.
2. **Entry is inline editing plus bulk % adjust.** No Excel import in this
   sub-project (export of a list is allowed; import is deferred).
3. **Price ↔ percentage are linked.** Typing a price shows the % change; typing a
   % computes the price. The comparison reference is selectable: default
   "previous rate in this list", or any other list.
4. **Warehouse follows the existing rows.** Live data shows every `saArtPrecio` row
   tied to one warehouse (`co_alma_calculado = '000015'`, none "TODOS"), so a rate
   change keeps the warehouse of the row it replaces. A new article in a list uses
   that list's dominant warehouse; an empty list uses the install-wide dominant
   warehouse, falling back to all warehouses (`co_alma` NULL). An article with rows
   in two different warehouses inside the same list is read-only in the grid with a
   badge (ambiguous). (found during planning; replaces the earlier "only NULL
   warehouse rows are editable" assumption)
5. Clone copies only current rates, with optional % adjustment and start date.
   (assumed)
6. Rate editing uses the existing `pricing_edit` grant. (assumed)

## 3. Out of scope

- Promotions/discount semantics and expiry fallback (sub-project 3).
- Expiry alerts (4); Excel import; choosing or changing the warehouse of a rate
  (it is inherited, never edited).
- `saDescArticulo` volume discounts (sub-project 3 decides).
- Margin guardrails (`saArtMargen` is unused in this install).
- Deleting lists or rate rows; voiding a list.

## 4. UX

New **Listas** tab beside Segmentos. Rail of lists + rates grid.

```
┌ Precios ── [Segmentos] [Listas] ─────────────────────────────────┐
├──────────────────┬───────────────────────────────────────────────┤
│ Listas [+ Nueva] │ 08 INDEPENDIENTES · BSD   [Clonar] [Exportar]  │
│ buscar           │ Comparar con: [Tarifa anterior ▾]  Vigente desde: [hoy]│
│ 01 CONTADO BS    │ [buscar artículo]  [categoría ▾]               │
│ 08 INDEPEND. ◀   │ ☐ Artículo     Vigente  Δ%    Nuevo   Nuevo Δ% │
│   11 clientes    │ ☐ Harina 1kg   12,40   —     [13,00] [+4,8%]  │
│                  │ ┌ 2 seleccionados: [+%] [−%] [Fijar precio] ──┐│
│                  │ │ 3 cambios pendientes   [Descartar][Aplicar]  ││
└──────────────────┴───────────────────────────────────────────────┘
```

- **List rail:** code, name, currency, active-rate count, segments/customers
  using it; voided lists (e.g. `05 ANUL`) behind a toggle.
- **Grid:** the whole list is loaded in one request (catalog is ~30 articles,
  expected to stay under ~50) and searched, filtered and sorted client-side; no
  pagination. Columns: Artículo, Vigente, Δ% (vs. reference), Nuevo (editable),
  Nuevo Δ% (editable). Articles with rows in two warehouses in this list are
  read-only with a badge.
- **Pending changes** live client-side; edited cells highlighted; "Descartar"
  clears. Bulk bar (+%, −%, Fijar precio) stages changes, never writes.
- **Aplicar:** confirm dialog with count, `effectiveFrom` (default today; future
  dates = scheduled), and before → after summary. Unchanged rows skipped.
- **Nueva lista:** name + currency. **Clonar:** source list, new name, optional
  %, start date.
- **Artículos lookup:** search an article → its rate in every list (current,
  next scheduled, collapsible history). Choosing a customer shows its
  effective price (customer → segment → list → rate).
- **States/a11y:** skeletons, empty states, keyboard-navigable grid, labeled
  inputs, `aria-live` apply results, targets ≥ 44px; `SearchableSelect` for
  data-driven pickers.

## 5. Rules

**Rounding/linking.** Price is the source of truth.
`price = round_half_up(ref × (1 + p/100), 2)`; Δ% is recomputed from the
rounded price (a typed 5 % may display 5,02 %; the UI marks Δ% as derived).
ERP stores 5 decimals; grid shows 2. Zero, negative and non-numeric prices are
rejected before the confirm step. Reference price missing → Δ% shows "—" and
the % input is disabled for that row.

**Apply algorithm (per article and warehouse, one SQL transaction).** Rows are unique on
`(co_art, co_precio, co_alma_calculado, desde)`; the algorithm is a pure planner
(`planRatePeriod`) that takes the existing rows and returns insert/update operations,
and it already supports a bounded end date (`to`) so sub-project 3 reuses it:
1. No current row → insert `desde = effectiveFrom`.
2. Current row started before `effectiveFrom` → set its `hasta = effectiveFrom − 1`, insert new row.
3. Current row started exactly on `effectiveFrom` → update `monto` in place.
4. A later scheduled row exists → new row's `hasta = next.desde − 1` (no overlap).
5. Unchanged price → skip.

Concurrency via `validador`; a conflict fails that article only and is
reported for retry. Every row written carries the list's `co_mone`.

**Currency.** `saTipoPrecio` has no currency column; a list's currency is
derived from its rows' `co_mone`. An empty new list keeps its chosen currency in
`pricing_list_meta`.

## 6. ERP writes (stored procedures only)

| Action | Procedure |
|---|---|
| Create list | `pInsertarTipoPrecio`; code = next free 2-digit `NN` (existing `01`–`10`), 6-char fallback |
| Rename list | `pActualizarTipoPrecio` |
| Insert/update rate row | `saArtPrecio` row procedures (`pActualizarRenglonesPrecioArticulo` + insert counterpart); wrapped in `migrations/mssql/0011` if the stock procedures need service-user stamping, like `0008`/`0009` |
| Clone | create list, then insert all row copies in a single transaction; any failure rolls the whole clone back |

## 7. App data (SQLite)

- `pricing_list_meta(co_precio PK, co_mone, created_by, created_at)`.
- Reuses `pricing_audit_log` with actions `list_create`, `list_clone`,
  `rates_apply`; `before_json`/`after_json` hold the batch (list, effective
  date, per-article old/new rate) so a batch can be reversed.

## 8. API & permissions

All routes `getSessionFromRequest` + `requirePricingAccess`; pages repeat the
check. `{ error: string }` on failure; every query uses `.input()`; PostHog
`captureEvent`/`captureException` as in AGENTS.md.

- `GET  /api/pricing/lists/[coPrecio]/rates` (view) — all rates for the list; `compareTo` selects the reference list
- `POST /api/pricing/lists` (edit) — create or clone
- `PATCH /api/pricing/lists/[coPrecio]` (edit) — rename
- `POST /api/pricing/lists/[coPrecio]/rates/apply` (edit) — `{ effectiveFrom, changes: [{ coArt, monto }] }`
- `GET  /api/pricing/articles?search=` and `/api/pricing/articles/[coArt]/prices?customer=` (view)
- `GET /api/pricing/price-lists` (sub-project 1) gains currency and rate count.

## 9. Error handling

- Per-article outcome `success | conflict | error | skipped`; the dialog lists
  failures by article name with retry that re-reads `validador`.
- `effectiveFrom` in the past is allowed only for same-day (rule 3); earlier
  dates are rejected to avoid rewriting history.
- An apply batch runs article by article; each article's two writes are one
  transaction, and a failure on one article doesn't affect the others.

## 10. Testing

- Unit: rounding/linking, the five apply cases (including same-day and
  scheduled-next), code allocation, validators.
- Integration (non-production ERP, like `test:pricing-erp`): create list,
  apply, re-apply same day, scheduled change, clone (including rollback on a
  mid-clone failure); restore afterwards.
- Access tests: view cannot write, both gates.
- E2E: stage edits → confirm → result; `SQLITE_PATH` pinned to `e2e/.tmp`.

## 11. Open items to verify during implementation

1. Exact insert procedure and parameters for `saArtPrecio` rows; whether a
   `pApi` wrapper is needed.
2. `pInsertarTipoPrecio` / `pActualizarTipoPrecio` parameter lists.
3. Whether any Profit trigger, report, or invoicing lookup assumes at most one
   open row per article and list.
4. Whether article category/line filtering should use `saArticulo.co_cat` or
   `co_lin` (confirm what the business filters by).
