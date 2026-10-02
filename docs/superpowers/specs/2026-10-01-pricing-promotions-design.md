# Pricing Workspace: Promotions & Discounts — Design Spec (Sub-project 3 of 4)

**Status:** Design approved in conversation (sections 1 and 2). Awaiting written-spec review.

**Depends on:** sub-project 1 (segments, special segments, `pricing_audit_log`,
tab shell) and sub-project 2 (rates grid, list clone, rate-write algorithm).
**Followed by:** sub-project 4 (expiry tracking) reads the data this one writes.

## 1. Purpose

Let pricing staff run time-boxed promotional prices: define what is discounted,
for whom, and until when, and have the promotion end cleanly and by default
without manual cleanup. Document how all of it works inside the app.

## 2. Key decisions (from brainstorming)

1. **Two promotion kinds, one wizard.**
   - **Sobre una lista** (default): dated rows inside an existing list. Applies to
     everyone on that list. Expiry is handled natively by Profit's `desde`/`hasta`
     lookup, with no job.
   - **Para un segmento o cliente**: a promo list (clone of a base list + promo
     rows) assigned through a sub-project 1 special segment. A daily sweep
     reverts customers at expiry.
2. **The app never creates overlapping rows** for the same article and list
   (Profit's behavior on overlap is undocumented). A promo `[from, to]` splits
   the regular rate into regular → promo → regular-continuation.
3. **Promo prices only.** Every discount is expressed as a dated price.
   `saDescArticulo` volume-tier discounts are out of scope (not displayed, not
   managed).
4. **A docs drawer** reuses the existing `HelpPanel` (`components/help-panel.tsx`,
   `react-markdown`, `/api/help/[page]` reading `content/help/<page>.md`) with one
   markdown file per tab: `pricing-segmentos`, `pricing-listas`,
   `pricing-promociones`, `pricing-vencimientos`.
5. The revert trigger is a script run by Windows Task Scheduler, matching the
   existing `send-invoice-reminders` precedent.

## 3. Out of scope

- Volume/quantity discount tiers (`saDescArticulo`, `saDescCategoria`, `saDescLinea`).
- Alerts and the expiry calendar (sub-project 4).
- Choosing a warehouse for promo rows: they inherit the warehouse of the regular row they split (see sub-project 2, decision 4).
- Margin guardrails; approvals workflow.
- Editing a promotion's articles after it has started (cancel and recreate).

## 4. UX

New **Promociones** tab.

- **List view:** groups *Activas / Programadas / Terminadas / Canceladas*; each row
  shows name, kind, target list or segment, dates, item count, days left;
  warning badge when ≤7 days remain.
- **Nueva promoción** wizard:
  1. *Qué*: name, reason, kind; kind 1 picks the target list; kind 2 picks
     customers/segment and the base list to clone.
  2. *Artículos y precio*: sub-project 2's grid; pick by search/category/selection;
     promo price or % discount, price↔% linked, reference = current rate.
  3. *Fechas*: start and end both required; end > start; start not in the past.
  4. *Revisión*: before → after per article, timeline; kind 2 lists the customers
     that move and when they revert. **Aplicar** writes.
- **Detail view:** items (promo vs regular), timeline bar, actions *Cancelar*,
  *Cambiar fecha de fin*, *Duplicar*.
- **Docs drawer:** every pricing tab renders `<HelpPanel page="pricing-<tab>" />`
  (existing floating "?" button and right-hand drawer). The four help files are a
  deliverable of this sub-project, written against the real behavior, including
  "Qué pasa cuando vence". Any focus/Esc improvements to `HelpPanel` are out of scope.
- **States/a11y:** skeletons, empty states, status badges with text as well as
  color, locale date formatting consistent with the app, targets ≥ 44px.

## 5. Rate-write core

Sub-project 2's algorithm is generalized to
`applyRatePeriod(list, article, from, to | null, monto)`. Sub-project 2 calls it
with `to = null`; promotions call it with an end date. One code path, one
test suite.

**Overlay promo, per article, one SQL transaction:**
1. Read the regular row covering `[from, to]`.
2. Close it at `from − 1`.
3. Insert the promo row `[from, to]`.
4. Insert a continuation row from `to + 1` with the regular amount and the
   regular row's original `hasta`.
5. A future scheduled row inside the window → reject that article with a clear
   message (no overlaps are ever created).

**Cancel / change end date (never leaves a day without an active rate):**
- Cancel before start (or starting today) → the promo row is repriced in place to the
  regular amount recorded at creation (`regular_monto`).
- Cancel while active → the promo row keeps the elapsed days (`hasta = today − 1`) and a
  new row `[today, ends_on]` carries the regular amount.
- Change end date → the promo row's `hasta` moves and the continuation row's `desde`
  shifts accordingly (or a continuation row is inserted when the promo originally
  reached the end of its regular row).
- Deactivating (`Inactivo = 1`) the promo row is **not** used: it would leave the period
  uncovered because the regular row was closed the day before.
- Cancelling or shortening an ended promotion is rejected.

## 6. Segment promotions (kind 2)

**Setup:** clone the base list (sub-project 2) → apply promo rows to the clone
and write continuation rows at the regular price from `ends_on + 1` → create a
special segment pointing at the promo list with `expires_at` and
`fallback_tip_cli` → move the customers, recording each `previous_tip_cli`.

The full clone with continuation rows means a failed revert degrades to "stale
regular price", never "no price" and never "promo forever".

**Revert:** `bun run pricing:sweep-promotions`, run daily from Windows Task
Scheduler (documented in `INSTRUCTIONS.md` next to the invoice-reminders step).
It finds ended segment promotions with customers still on the promo segment and
moves them to `previous_tip_cli`; skips customers already moved elsewhere by
hand; if `previous_tip_cli` no longer exists it uses `fallback_tip_cli`; is
idempotent; logs each move to `pricing_audit_log`; exits non-zero on any failure.

## 7. App data (SQLite, new migration)

`pricing_promotions`
- `id` integer PK, `name`, `reason`, `kind` (`overlay` | `segment`)
- `co_precio` (overlay target, or promo list for segment kind)
- `tip_cli` text null (segment kind), `base_co_precio` text null
- `starts_on`, `ends_on` (ISO dates), `status` (stored only as `cancelled`; otherwise
  computed from dates and the injectable clock on read)
- `created_by`, `created_at`

`pricing_promotion_items`: `promotion_id`, `co_art`, `promo_monto`, `regular_monto`.

ERP rows remain the source of truth for prices; these tables make a dated row
identifiable as a named promotion with a reason.

## 8. API & permissions

All routes double-gated (`requirePricingAccess`; `view` for GET, `edit` for writes),
`{ error: string }` on failure, `.input()` everywhere, PostHog events/exceptions
per AGENTS.md.

- `GET/POST /api/pricing/promotions`
- `GET/PATCH /api/pricing/promotions/[id]` (PATCH: change end date, cancel)
- `POST /api/pricing/promotions/preview` (view): before → after rows and rejected
  articles, no writes.
- Docs: add the four `pricing-*` slugs to `HELP_PAGES` in
  `app/api/help/[page]/route.ts`; files live in `content/help/`.

## 9. Error handling

- Per-article outcomes as in sub-project 2; a failed article leaves the promotion
  *partially applied* and the detail view offers retry.
- Cancelled or ended promotions are read-only.
- Rejections are explained per article (overlap with a scheduled row, missing
  regular rate, locked by concurrency conflict).

## 10. Testing

- Unit: `applyRatePeriod` cases; overlap rejection; status computation; sweep
  selection (including hand-moved customers and missing `previous_tip_cli`).
  A date-injectable clock is used so expiry tests never depend on the real date.
- Integration (non-production ERP, like `test:pricing-erp`): overlay create /
  cancel / extend; segment create and sweep revert; restore afterwards.
- E2E: wizard → apply → detail; `SQLITE_PATH` pinned to `e2e/.tmp`.
- Docs: a test that each `pricing-*` slug in the allowlist has a file in `content/help/`.

## 11. Open items to verify during implementation

1. Profit's invoicing lookup honors `desde`/`hasta` on article price rows (as
   `pObtenerPrecios` indicates); confirm on the non-production instance.
2. `pActualizarRenglonesPrecioArticulo` accepts a changed `desde`.
3. Task Scheduler instructions added to `INSTRUCTIONS.md`.
