# Repo Hygiene & Cleanup Pass — 2026-09-13

Done autonomously while you were away, per your instructions. Two parts: (1) resolved the branch/merge situation from the DWH analytics work, (2) a conservative first-pass cleanup — dead code, duplication, one stale test — none of it a design change.

## 1. Branch situation — resolved

Three branches existed in a chain, none merged: `main` → `feature/customer-legal-entity-grouping` → `feature/finanzas-compras-facts`. All three are now merged into local `main` (37 commits total, all fast-forwards, no conflicts).

**Not yet pushed to `origin/main`** — pushing directly to `main` was denied by this session's permission settings, which I did not attempt to bypass. Everything else (feature branches, this cleanup) is committed and verified locally. **You'll need to run `git push origin main` yourself**, or approve the push if you'd rather I do it.

## 2. Why the DWH kept appearing "missing"

Partway through verification, `DWH_AlimentosNY` was gone from the SQL Server instance entirely. Root cause found: `scripts/dwh/__tests__/sql-agent-jobs.test.ts` intentionally `DROP DATABASE`s the DWH in its `afterAll` cleanup, as part of its own from-scratch integration test. Running the unit test suite (`bun run test:unit`) always ends with the DWH gone — this is by design for that test, not a bug, but it means **after running `test:unit`, you need to `bun run migrate:dwh && bun run scripts/dwh-incremental-load.ts` before the app or E2E suite will show real data again.** I did this each time it came up; flagging it here so it doesn't look alarming next time.

Also found and fixed: two assertions in that same test file still expected the *original* 9-step "DWH - Incremental Load" job — stale since this session's Finanzas/Compras work added 5 more steps. Updated to the current, live-verified 14-step order.

## 3. Cleanup changes

Everything below was verified with a passing build, typecheck, and the full E2E suite (`e2e/analitica.spec.ts`, 5/5) both before and after — no behavior change anywhere in this section.

### Removed
- **`app/api/dwh/lib/types.ts`** — dead file. Its one import site never used the imported type, and its `dateRange` union was already stale (predated the custom-date-range feature).
- **Unused dependencies**: `argon2`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-markdown` — zero references anywhere in the app. Password hashing already goes through `bcrypt` exclusively.

### Extracted (duplication → shared, tested module)
- **Money-formatting helpers** (`money`/`moneyLabel`/`moneyTooltip`) were byte-identical, hand-copied into all 9 `analitica` tab components. Now live in `app/(app)/analitica/lib/format.ts`, with a new unit test suite (`format.test.ts`, 11 tests) covering both currencies, rate conversion, and the Recharts-tooltip array-unwrapping edge case.
- **DWH route auth check** — the same 6-line "get session → check DWH module access → 401/403" block was copied into all 11 `app/api/dwh/*/route.ts` files. Now a single `requireDwhAccess(request)` in `lib/dwh/access.ts`, with a new unit test suite (`access.test.ts`, 4 tests) covering the 401, 403, and success paths.

### Left alone, flagged for a decision
- **`lib/components/reports/SucursalSelector.tsx`** — has zero current consumers, but traces back to an unfinished plan (`docs/superpowers/plans/2026-07-16-libro-de-compras-csv-export.md`) whose last step — wiring it into a report page — never happened. This might be intentionally-incomplete work you still want, not dead code. Left untouched; your call whether to finish wiring it up or remove it.

## 4. What this pass deliberately did *not* touch

Per your framing ("first cleaning pass," not the architecture rework you want to brainstorm separately):
- No file splits — reviewed the largest files (`articulos-client.tsx`, `tab-ventas.tsx`) but every split point would be a design judgment call, not a mechanical extraction.
- No changes to the DWH schema, migrations, or query logic.
- Two pre-existing `@typescript-eslint/no-explicit-any` lint errors (`tab-compras.tsx`, `tab-ventas.tsx`) and a handful of pre-existing unused-var warnings elsewhere — confirmed present before this pass, left as-is since fixing them would touch typing/behavior, not just structure.
- The `SucursalSelector.tsx` question above.

## 5. Verification

- `bun run tsc --noEmit`: clean except 5 pre-existing errors in `__tests__/integration/inventory-change-unit.integration.test.ts` (confirmed present on `main` before this session's work started).
- `bun run lint`: clean except pre-existing warnings/errors in files this pass didn't touch.
- `bun run test:unit`: 285 passing (up from 269 before this session — 15 new tests added: 11 for the money helpers, 4 for `requireDwhAccess`). Remaining failures are a pre-existing connection-pool timeout pattern when running many DWH integration test files concurrently under `--isolate` — confirmed unrelated to this pass by re-running with a longer timeout, where only the two stale-assertion failures (now fixed) remained.
- `bun run build`: clean.
- `e2e/analitica.spec.ts` (Ventas, Devoluciones, Vendedores, Finanzas, Compras): 5/5 passing, both before and after every change in this pass.
- Two E2E failures unrelated to this pass, confirmed pre-existing by re-running against the un-refactored code: `admin-users.spec.ts` (a flaky modal-overlay timing issue) and 3 `password-reset.spec.ts` tests (Mailhog test-mail service isn't running in this environment).
