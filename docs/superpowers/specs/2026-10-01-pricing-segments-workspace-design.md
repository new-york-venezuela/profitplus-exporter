# Pricing Workspace: Segments & Customer Assignment — Design Spec (Sub-project 1 of 4)

**Status:** Design approved in conversation (sections 1 and 2). Awaiting written-spec review.

**Supersedes the UI of:** `2026-09-27-price-list-customer-assignment-design.md`
(its ERP write path and permission gate are kept; its page is replaced).

## 0. Program context

The pricing feature is redesigned as four sub-projects, each with its own
spec → plan → implementation, built in this order:

| # | Sub-project | Scope |
|---|---|---|
| 1 | **Segments & customer assignment** (this spec) | New IA, segment management, customer moves, special one-customer segments |
| 2 | Price list management | Create/clone lists, edit article rates (`saArtPrecio`), read-only "Artículos" lookup (article → price in every list, customer effective price) |
| 3 | Promotions & discounts | Dated rate rows (`desde`/`hasta`), "active now" view, expiry fallback enforcement; decide how `saDescArticulo` volume discounts fit |
| 4 | Expiry tracking | "Ending soon" view, alerts, promo timeline (read-only) |

This spec only delivers sub-project 1. Tabs for 2–4 are not rendered until
those sub-projects ship.

## 1. Purpose

Let pricing staff see and change which price list each customer gets, using
the concept the business already thinks in: **segments**. Replace the
current single-table page, whose segment filter is free text, whose
price-list sidebar is inert, and whose bulk action is unconfirmed.

## 2. Key decisions (from brainstorming)

1. **Segment = customer type.** A segment is a `saTipoCliente` row (`tip_cli`).
   Each segment points to exactly one price list (`co_precio`). A customer's
   price list is its segment's list; this is how Profit already resolves it.
   `saCliente.co_seg` is **not** written by this feature: `saSegmento` is a
   free classification dimension (78 rows mixing channels, third parties and
   accounting concepts) likely used by accounting/commissions.
2. **Moving a customer to a segment is the way to give it a price list.**
   There is no separate segment write.
3. **Repointing a segment** to another list re-prices every customer in it in
   one ERP write (group assignment, e.g. "Independientes").
4. **Individual exceptions are one-customer segments**, created in one click
   ("Precio especial"). The generated `des_tipo` states who it is for, why, and
   when it ends, e.g. `Bodega El Sol · promo oct · hasta 31/10`.
5. **Limit = time only.** Expiry is stored and displayed here; reverting to a
   fallback segment is enforced in sub-projects 3/4 (Profit has no native
   expire-and-revert for customer types).
6. Article price lookup is a sub-project 2 deliverable, not part of this spec.

## 3. Out of scope

- Creating/editing price lists or SKU rates (sub-project 2).
- Promotions and discounts (3), expiry enforcement and alerts (4).
- Writing `saCliente.co_seg`; writing any other `saCliente` field.
- Margin guardrails, scale/volume limits.

## 4. UX

Route stays `/pricing`; a segment is selected via `?segment=<tip_cli>` so
views are linkable. Master/detail layout:

```
┌ Precios ─────────────────────────────────────────────────────────┐
├───────────────────┬──────────────────────────────────────────────┤
│ Segmentos [+ Nuevo]│ INDEPENDIENTES → Lista 08      [Cambiar lista]│
│ buscar             │ 142 clientes                                  │
│ ▸ INDEPENDIENTES   │ [buscar cliente] [zona ▾] [vendedor ▾]        │
│    08 · 142        │ ☐ Cliente        Zona   Vendedor  Último pedido│
│ ▸ Bodega El Sol ·  │ ...                                           │
│   promo oct · hasta│ ┌ N seleccionados ───────────────────────────┐│
│   31/10  ⏳ 12 d    │ │ [Mover a segmento ▾]  [Precio especial]    ││
└───────────────────┴──────────────────────────────────────────────┘
```

Behavior:
- **Segment rail:** searchable; each item shows name, list, customer count;
  special segments show an expiry badge (days left; warning style when
  expired or ≤7 days).
- **Cambiar lista:** confirm dialog with customer count and before → after
  list; single ERP write.
- **Customer panel:** debounced search, zona and vendedor filters
  (`SearchableSelect`), sortable columns, select-all (current page), server
  pagination (replaces the old `TOP 500` cap).
- **Sticky action bar** on selection: "Mover a segmento" (confirm dialog with
  per-segment before → after summary) and "Precio especial".
- **Precio especial dialog:** customer(s), reason, end date, price list
  (existing; cloning arrives with sub-project 2). Name is previewed live.
- **Results:** per-customer list with names, grouped success / conflict /
  error; conflicts offer a retry that re-reads `validador`.
- **States/a11y:** loading skeletons, empty states, error banners on failed
  fetches, labeled checkboxes, visible focus rings, results in an
  `aria-live` region, touch targets ≥ 44px for row actions.
- Convention: data-driven pickers use `lib/components/searchable-select.tsx`;
  styling follows the existing app tokens rather than ad-hoc gray/blue classes.

## 5. ERP writes (stored procedures only)

| Action | Procedure | Notes |
|---|---|---|
| Create segment | `pInsertarTipoCliente` | Param list inferred by analogy; **verify in implementation**. Code = next free zero-padded numeric 6-digit `tip_cli`, checked against existing rows (existing rows use `000001`/`000002` and codes equal to price-list codes from the previous feature). |
| Rename / repoint segment | `pActualizarTipoCliente` via new wrapper `pApiActualizarTipoCliente` (`migrations/mssql/0010`) | Optimistic concurrency on `validador`; only `des_tipo` and `co_precio` change; stamps `co_us_mo`/`fe_us_mo`. Same style as `0008`/`0009`. |
| Move customer | `pActualizarCliente` (existing `updateCustomerTipCli`) | Unchanged: `sCampos = 'tip_cli'`, per-customer `validador` conflict. |
| Read | `saTipoCliente` ⨝ `saTipoPrecio`, customer counts, `saCliente` | New segments endpoint; customers endpoint gains `segment` (tip_cli), pagination, sort. |

`ensureTipoClienteForPriceList` (hidden 1:1 mapping) is removed from the
assignment path: assignment now targets an explicit segment. Existing
segments created by the previous feature are adopted as `kind = 'group'`
without any ERP change.

## 6. App data (SQLite, Drizzle, new numbered migration)

`pricing_segment_meta`
- `tip_cli` text PK
- `kind` text: `group` | `special`
- `customer_co_cli` text null (special only)
- `reason` text null
- `expires_at` text null (ISO date)
- `fallback_tip_cli` text null
- `previous_tip_cli` text null
- `created_by` text, `created_at` text

`pricing_audit_log`
- `id` integer PK, `at` text, `user_id` text, `action` text
  (`segment_create` | `segment_repoint` | `segment_rename` | `customer_move`),
  `target` text (tip_cli or co_cli), `before_json` text, `after_json` text

Name generation (`lib/pricing/segment-name.ts`) is pure: inputs
(customer name, reason, end date) → `des_tipo` ≤ 60 chars, truncating the
customer and reason segments first and never the end date. The ERP name is
the visible source of truth; metadata is keyed by `tip_cli`, so a hand-edit in
Profit does not orphan it.

## 7. API & permissions

All routes: `getSessionFromRequest` + `requirePricingAccess(request, 'view'|'edit')`;
the page repeats the check server-side (no middleware in this app).
Errors are `{ error: string }`.

- `GET  /api/pricing/segments` (view)
- `POST /api/pricing/segments` (edit) create group/special segment
- `PATCH /api/pricing/segments/[tipCli]` (edit) rename / repoint list / set expiry
- `GET  /api/pricing/customers` (view) extended: `segment`, `page`, `pageSize`, `sort`
- `POST /api/pricing/assignments` (edit) body changes to
  `{ customerCodes, targetTipCli }`
- `GET /api/pricing/price-lists` unchanged

All user input goes through `.input()`. PostHog: `captureEvent` before each
success return, `captureException` in catch blocks, per AGENTS.md.

## 8. Error handling

- Per-customer outcome `success | conflict | error` (kept); a repoint that hits a
  stale `validador` returns 409 with a "recargar" message.
- Moving a customer already in the target segment is a no-op success.
- Creating a special segment is not atomic across ERP and SQLite: ERP create
  first, then metadata; if metadata fails the response says so and a retry is
  idempotent on `tip_cli`. Orphan ERP segments without metadata are shown as
  `kind = group` with no badge.
- Expiry date in the past is rejected at creation.

## 9. Testing

- Unit: `segment-name`, next-code allocation, request validators, audit
  before/after builders.
- Integration (non-production ERP, run like `test:pricing-erp`): create segment,
  repoint, move customers, conflict path; restore afterwards.
- Access tests extend `pricing-access.test.ts` (view cannot write; both gates).
- E2E (Playwright, e2e suite conventions): segment select → bulk move with
  confirm → result list. Pin `SQLITE_PATH` to `e2e/.tmp` (data-wipe hazard).

## 10. Open items to verify during implementation

1. Exact parameter lists of `pInsertarTipoCliente` and `pActualizarTipoCliente`.
2. Whether any other Profit module relies on `saTipoCliente.tip_cli` meaning
   "customer type" in a way that many new segments would disturb (default
   `par_emp.v_tip_cli` is the one known reference).
3. `des_tipo` length (assumed 60) and whether `tip_cli` accepts non-numeric codes.
