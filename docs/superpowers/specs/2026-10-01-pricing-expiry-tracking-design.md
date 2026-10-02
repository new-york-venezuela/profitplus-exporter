# Pricing Workspace: Expiry Tracking — Design Spec (Sub-project 4 of 4)

**Status:** Design approved in conversation. Awaiting written-spec review.

**Depends on:** sub-project 3 (`pricing_promotions`, the sweep script) and
sub-project 2 (rate rows). Read-only apart from alert settings.

## 1. Purpose

Make it hard to be surprised by an expiring or broken price: show what is about
to end, what failed to revert, and which articles have lapsed without a price,
both in the app and by email.

## 2. Key decisions (from brainstorming)

1. All three tracking surfaces ship: a health dashboard, an email digest, and a
   timeline view.
2. **All checks run live.** The catalog is ~30 articles (expected to stay under
   ~50) across a handful of lists, so `saArtPrecio` holds hundreds of rows and
   there is no snapshot, cache, or refresh button.
3. The digest is sent by the same scheduled script that performs the
   sub-project 3 sweep (one Task Scheduler task) and reuses the existing
   `EmailService` (Handlebars templates, SMTP env vars already used by the
   password-reset flow).
4. Health logic lives in pure functions shared by the API and the digest, so the
   page and the email cannot disagree.

## 3. Out of scope

- Push/Slack/SMS channels; per-user notification preferences.
- Auto-fixing lapsed prices (the dashboard links to the fix).
- Historical analytics of price changes.

## 4. UX — "Vencimientos" tab

List/timeline toggle.

**Health lists** (each row links to the promotion, list or customer to act on):
- *Terminan pronto*: promotions ending in the next 7 / 14 / 30 days (selector).
- *Vencidas sin revertir*: ended segment promotions that still have customers on
  the promo segment.
- *Sin precio vigente*: articles that have rate rows in a list but none valid
  today, limited to lists with at least one customer assigned.
- *Estado del barrido*: last sweep run; warning when older than 36 hours or when
  its last run reported failures.

**Timeline view:** promotions as bars on a monthly timeline, colored by status,
with month navigation. Plain CSS (no chart library) and an accessible list
fallback underneath.

States/a11y: skeletons, empty states ("Todo en orden"), status conveyed by text as
well as color, keyboard-navigable timeline items.

## 5. Heartbeat

The sweep script writes a row to `pricing_sweep_runs` on every run:
`id`, `run_at`, `ok` (0/1), `moved`, `failed`, `error` (text, nullable). The
dashboard reads the latest row.

## 6. Email digest

- Sent by the scheduled script after the sweep, via
  `EmailService.send(to, 'pricing-expiry-digest', data)`: new template
  `lib/email/templates/pricing-expiry-digest.hbs` and a subject entry in
  `getSubjectForTemplate`.
- Sent only when there is something to report (no empty emails).
- *Ending soon* is notified at 7 days and 1 day before the end date;
  `pricing_alert_log(promotion_id, kind, sent_on)` prevents repeats.
- *Sweep failures*, *vencidas sin revertir* and *sin precio vigente* are notified
  daily until resolved.
- Recipients default to admins plus users with a `pricing_edit` grant who have an
  email address. `pricing_alert_settings` (single row: `enabled`, `days_ahead`,
  `recipients` JSON null = use defaults) overrides this; a settings dialog on the
  tab edits it, admin only.
- A failed send is logged and reported in the script's exit code; it never
  blocks the sweep.

## 7. Code structure

`lib/pricing/health.ts`: pure functions
`endingSoon(promotions, today, days)`, `unrevertedSegmentPromotions(promotions, customerCountsByTipCli, today)`,
`lapsedPrices(rateRows, listsInUse, today)`, `sweepStatus(lastRun, now)`.
Data access (ERP counts/rates, SQLite promotions/runs) is fetched by thin
loaders; the API route and the digest script both call loaders → pure functions.

## 8. API & permissions

Double-gated as always; `{ error: string }` on failure; `.input()` for all ERP
queries; PostHog events/exceptions per AGENTS.md.

- `GET /api/pricing/health` (`view`): the four sections.
- `GET/PUT /api/pricing/alert-settings` (admin only).

## 9. Testing

- Unit: each check in `health.ts` with an injected clock; digest "nothing to send"
  and dedupe via `pricing_alert_log`; recipient defaulting.
- Integration (non-production ERP): the "sin precio vigente" query and the
  per-`tip_cli` customer count against known fixtures.
- E2E: tab, toggle, settings dialog (admin vs non-admin).
- Template render test for `pricing-expiry-digest.hbs` with sample data.

## 10. Open items to verify during implementation

1. Production has the same SMTP variables set that the password-reset flow uses.
2. Row counts of `saArtPrecio` on the non-production instance (confirm the
   "hundreds of rows" assumption before shipping; no code change expected).
