# Price List Customer Assignment — Design Spec

**Status:** Design approved by user. SP signatures confirmed against the
Profit Plus knowledge base (see Section 5 and Section 10) — one item
(`pInsertarTipoCliente`'s exact parameter list) remains inferred by strong
analogy rather than verbatim-confirmed; verify it during implementation.

**Depends on:** `docs/superpowers/plans/2026-09-27-consignment-store-deliveries.md` — that plan is implemented first; this spec's implementation plan comes after it.

## 1. Purpose

Give admins and pricing staff a way to see which Profit Plus price list each
customer is on, and to actually change it — a write that takes effect at the
point of sale, not just a record of intent.

This replaces today's process, which is manual and has no visibility inside
this app: price-list assignment currently happens by editing customers
directly in Profit Plus, with nobody outside that session able to see who's
on what list without going and checking there.

## 2. Scope

**In scope:**
- Browse existing Profit Plus price lists (`saTipoPrecio`) — read-only, list
  + description only. No creating, editing, or deleting price lists, and no
  editing their SKU rates (`saArtPrecio`) — none of that is touched by this
  feature.
- Browse/search customers (`saCliente`), filterable by segment (`co_seg`),
  searchable by name, code, or tax ID.
- View each customer's currently effective price list (resolved via
  `saCliente.tip_cli → saTipoCliente.co_precio`).
- Reassign one customer, or bulk-reassign several selected customers, to a
  different price list. This is the one real write in this feature.
- A `pricing` module permission gate with two levels: `view` (browse only)
  and `edit` (can reassign).

**Explicitly out of scope** (all deferred to later, separate specs if ever
pursued):
- Promotions / time-boxed campaign pricing.
- Margin safety warnings or any cost-based guardrail (Profit Plus has no
  usable per-article cost field — see Section 7 — and the business's real
  margin methodology, per the user-provided contribution-margin analysis,
  needs production cost, returns rate, and commission data this app doesn't
  have; that's a separate, larger effort, closer in shape to the `/analitica`
  DWH dashboard than to this feature).
- Editing price-list SKU rates (`saArtPrecio`).
- An "effective price matrix" or per-SKU customer overrides.
- Any async/background sync machinery — every write here is synchronous,
  matching the rest of this app (see Section 6).
- A generalized "MCP sync" layer — this app talks to `mssql` directly, same
  as every other feature; there is no MCP write path anywhere in this
  codebase and this feature doesn't introduce one.

## 3. Data Model — What Profit Plus Already Gives Us

Confirmed via the `profit-plus-knowledge-base` MCP (schema/docs lookup, not
live-verified unless noted):

- **`saTipoPrecio`** — price-list catalog. PK `co_precio` (char(6)),
  `des_precio` (description). 11 rows exist today (e.g. contado Bs, USD
  contado, cadenas, bodegón, hipermercado).
- **`saArtPrecio`** — SKU-level rates per price list, with `desde`/`hasta`
  validity dates. Not touched by this feature at all — surfaced here only
  because it's what makes a price list meaningful once assigned.
- **`saCliente`** — customer master. Relevant fields: `co_cli` (PK),
  `cli_des` (name), `tip_cli` (FK → `saTipoCliente`), `co_seg` (segment),
  `validador` (optimistic-concurrency timestamp, required on every update).
  **No direct price-list column exists on `saCliente`.**
- **`saTipoCliente`** — customer-type catalog. Each row has `tip_cli` (PK)
  and `co_precio` (FK → `saTipoPrecio`) — this is the *only* lever Profit
  Plus provides for a customer's price list. Today only 2 rows exist
  (`INDEPENDIENTE`, `CADENA`), both pointing at the same `co_precio` — this
  ERP install has never actually differentiated customers by price list
  before.

### The `tip_cli` trade-off (read this before touching the write path)

`tip_cli` today means "customer type." This feature repurposes it as the de
facto price-list selector, because it's the only field Profit Plus's own
pricing/invoicing resolution actually reads — an app-owned side table would
be simpler to build but **would not change what a customer is charged at
checkout**, defeating the entire point of this feature (see Section 8 for
why that alternative was rejected).

The accepted risk: if `tip_cli` is used anywhere else — another report,
another workflow, a future feature — for its literal "customer type"
meaning, this feature will start colliding with that the moment it creates
new `saTipoCliente` rows per price list and reassigns customers across them.
**Before implementation, grep the whole repo (and ask about any known
external consumers, e.g. POS software, other reports run directly against
Profit Plus) for `tip_cli` usage beyond what this spec already covers.** If
a real second meaning turns up, stop and re-open this design — do not
silently proceed.

## 4. Price List → Customer Type Mapping

Since assignment happens through `saTipoCliente`, and today there's
essentially one usable row, this feature must be able to create a new
`saTipoCliente` row the first time a given price list is used as an
assignment target.

**Auto-create on first use:** when a user assigns a customer to a price list
that has no existing `saTipoCliente` row pointing at its `co_precio`, the
write path creates one inline (in the same request) before reassigning the
customer, rather than requiring a manual pre-provisioning step. This keeps
the feature self-contained — nobody has to remember to run a setup script
before a new price list becomes assignable.

The created row's `tip_cli` code and description are derived from the
target price list (e.g. mirroring `des_precio`), so the mapping stays
legible to anyone looking at `saTipoCliente` directly in Profit Plus later.

**Confirmed schema** (`saTipoCliente`): `tip_cli` (char(6), PK),
`des_tipo` (varchar(60), NOT NULL — required), `co_precio` (char(6), NOT
NULL, FK → `saTipoPrecio.co_precio` — required), `campo1`–`campo8`
(varchar(60), free/unused), standard audit columns (`co_us_in`,
`co_sucu_in`, `fe_us_in`, `co_us_mo`, `co_sucu_mo`, `fe_us_mo`), `validador`
(optimistic concurrency), `rowguid`. No triggers on this table. Only 2 rows
exist today (both → `co_precio = '01'`).

A native insert SP, `pInsertarTipoCliente`, is confirmed to exist — use it
rather than a raw `INSERT`, consistent with this feature's rule of using
native SPs wherever Profit Plus provides one. Its exact parameter list
wasn't retrievable from the knowledge base at the detail level; by strong
analogy to its documented sibling `pInsertarTipoProveedor` (identical
insert-SP pattern: business columns + `campo1`–`campo8` + inserting
user/branch, ending in the standard `pInsertarPista` audit call), it almost
certainly takes `@sTip_Cli`, `@sDes_Tipo`, `@sCo_Precio`, `@campo1..8`,
`@sCo_Us_In`, `@sCo_Sucu_in` — **confirm the real signature against the
live ERP (or a deeper knowledge-base query) before writing this call**, it
is the one open item in this spec (Section 10).

## 5. Customer Reassignment Write Path

Reassignment updates `saCliente.tip_cli` via the native `pActualizarCliente`
stored procedure. Using the native SP rather than a raw `UPDATE` is
deliberate: it carries the standard optimistic-concurrency (`validador`)
check and the ERP's own audit-trail write (`pInsertarPista`), for free,
matching how every other Profit Plus write subsystem behaves.

**Confirmed signature:** `pActualizarCliente` takes the same full parameter
set as `pInsertarCliente` (every `saCliente` business column — this is a
**whole-record update**, not a partial/changed-fields update) plus:
`@sCo_CliOri` (the customer being updated, used in the WHERE), `@sCo_Cli`
(new code, allows rename), `@tsValidador` (the optimistic-concurrency token,
compared against the row's current `validador` in the WHERE clause),
`@gRowguid` (accepted but not used in the WHERE), `@sCo_us_mo`/
`@sCo_Sucu_Mo` (modifying user/branch), and `@sCampos` (free-text
changed-fields description for the audit trail). Because it's whole-record,
this feature must read the customer's current full row before calling it,
change only `tip_cli`, and pass everything else back unchanged.

**Concurrency:** there is no explicit rowcount/status output param — the
confirmed pattern (shared across the whole `pActualizar*` family) is an
`OUTPUT` clause capturing the updated row into a table variable, which the
SP then returns as its result set. If the passed `@tsValidador` doesn't
match the current row, the `UPDATE` affects 0 rows and that result set comes
back **empty** — that emptiness is the signal to detect, not a return code.
On an empty result: return an error to the caller (not a silent success),
and have the UI re-fetch that customer's current state so the user can see
what changed and retry with fresh data. No automatic retry — a human should
see that a conflict happened, since it means someone else touched this
customer concurrently.

**Bulk reassignment:** applies the same single-customer write in a loop
(one `pActualizarCliente` call per customer), not a batched/set-based
update — this keeps per-customer concurrency conflicts isolated (one
customer's conflict doesn't fail the whole batch) and reuses the exact same
code path as a single reassignment. The bulk response reports per-customer
outcome (succeeded / conflict / error), not just an aggregate count.

## 6. Synchronous Writes, No New Infrastructure

Every write (single reassignment, bulk reassignment, auto-created
`saTipoCliente` row) happens inline within the API request/response cycle,
exactly like the existing inventory-adjustment feature
(`pApiCrearAjusteInventario`). There is no job queue, no background worker,
and no async "sync" state machine — this app has never had one, and nothing
about this feature's write volume or latency justifies introducing one.
The UI reflects write outcome as an immediate per-row `Saving… / Saved /
Error` state, not a persistent queue status.

## 7. Why No Margin Warning (context, not a requirement)

Recorded here so a future reader doesn't wonder why the original request's
margin-safety guardrail is missing: Profit Plus has no direct per-article
cost column (`saArticulo` has no cost field; actual cost values live in
`saCostoHistoricoSalida`, selected by a `tipo_cos` method flag — last cost,
average cost, replacement cost, or vendor cost, ambiguous by design). This
app's own `/analitica` dashboard already documents working around this
exact gap by using Purchases as a cost proxy
(`app/(app)/analitica/tabs/tab-finanzas.tsx`). Combined with the user's own
margin methodology (a manual contribution-margin spreadsheet factoring in
production cost, returns rate, and sales commissions — none of which live
in any ERP table this app reads today), building a trustworthy margin
guardrail is a separate, materially larger effort. This spec doesn't attempt
it.

## 8. Alternatives Considered and Rejected

- **App-owned customer→price-list table, no `tip_cli` write.** Rejected:
  doesn't change what Profit Plus actually charges at checkout, since
  nothing in the ERP's own pricing resolution reads an app-owned table.
  Would produce a planning tool, not an operational one — and the user
  explicitly wants this feature to control live pricing.
- **Promotions modeled as flagged `saTipoPrecio` rows (`campo1` as a promo
  marker + promo dates in `campo2`/`campo3`).** Dropped along with all of
  Promotions being cut from scope — no longer relevant, but recorded here in
  case Promotions comes back as a future spec: this shortcut was considered
  and would need re-evaluating against the extendability concerns raised in
  this conversation (a single shared free-text column is fragile for
  anything beyond one flag).
- **Manual one-time migration to pre-seed every `saTipoCliente` row.**
  Rejected in favor of auto-create-on-first-use — avoids a setup step
  blocking use of a brand-new price list created later directly in Profit
  Plus.
- **Automatic retry-once on a concurrency conflict.** Rejected in favor of
  surfacing the conflict — simpler, and a concurrent edit on customer pricing
  data is worth a human looking at rather than silently overwriting.

## 9. Access Control

New `pricing` module, following the existing `hasInventoryAccess`/
`hasDwhAccess` shape (`lib/inventory/access.ts`, `lib/dwh/access.ts`), but
with a two-level grant instead of a boolean:

- `hasPricingAccess(db, userId, role): Promise<'none' | 'view' | 'edit'>`
- Admins always resolve to `'edit'`.
- `'view'`: can browse both perspectives, cannot reassign.
- `'edit'`: can also reassign (single or bulk).

**Implementation note (superseding this section's original "add a `level`
column" idea):** `user_modules` (`lib/db/schema.ts`) has no value column at
all today — `module` is a plain text enum, and a grant is just a row's
existence for `(userId, module)`. Rather than adding a `level` column
(which would sit meaningless/NULL on every existing `inventory`/`dwh` row
forever), this feature adds two more allowed enum values instead:
`'pricing_view'` and `'pricing_edit'`. A user's effective level is `'edit'`
if a `pricing_edit` row exists, `'view'` if a `pricing_view` OR
`pricing_edit` row exists, else no access. This requires **no schema
migration at all** — existing `inventory`/`dwh` rows and their access
checks are completely untouched, eliminating the regression risk a shared
new column would have carried. Every route in this feature checks access
independently per page and per API route, per this app's no-shared-
middleware convention (`AGENTS.md`).

## 10. Open Verification Items (resolve during implementation, not before)

Most of this section's original questions are now confirmed (Sections 4–5).
One item remains before the write-path task is considered done:

1. **Exact `pInsertarTipoCliente` parameter list.** Confirmed to exist as a
   native SP (no raw `INSERT` needed), but its parameter names weren't
   retrievable at the detail level from the knowledge base — Section 4's
   inferred signature (by analogy to `pInsertarTipoProveedor`) needs
   confirming against the live ERP (e.g. `sp_helptext` or a targeted
   knowledge-base query) before writing the call.
2. **Whether anything outside this app reads `tip_cli` for its literal
   "customer type" meaning** — the grep/verification called out in Section 3.
   Not resolvable from ERP schema docs alone; needs a repo-wide grep plus
   asking about any known external consumers (POS software, other reports
   run directly against Profit Plus) before the write path ships.

## 11. Testing Notes

- Follows this app's existing MSSQL-integration test pattern (see
  `scripts/dwh/__tests__/*` for the shape, though this feature's tests run
  against the ERP test config, not `DW_*`/DWH).
- Needs at least: (a) reassignment happy path updates `tip_cli` and is
  reflected on re-read, (b) reassignment to a price list with no existing
  `saTipoCliente` row auto-creates one and succeeds, (c) a concurrency
  conflict (stale `validador`) surfaces as an error and does not silently
  no-op, (d) bulk reassignment with a mix of one succeeding and one
  conflicting customer reports both outcomes independently rather than
  failing the whole batch or masking the conflict.
