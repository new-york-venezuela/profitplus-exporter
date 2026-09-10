# Task 2: Refactor analitica-client to tab shell + global filter bar — Status Report

## Status
**DONE** ✓

## Deliverable
File replaced: `app/(app)/analitica/analitica-client.tsx`

## Summary
Replaced the single-view dashboard component with a tabbed navigation shell that dispatches to 11 tab components (9 real + 2 stubs via `tab-stub.tsx`). The shell owns no data fetching of its own — all API calls are left to the child tab components (Tasks 3–14).

Key implementation details:
- **Named export preserved**: kept `export function AnaliticaClient()` (not default) since `page.tsx` imports it as `{ AnaliticaClient }`. `page.tsx` was not touched.
- **`TABS` array**: exactly as specified — 11 entries, with `compras` and `rutas` rendered inline via `() => <TabStub title="..." />`.
- **URL-driven state**: `tab`, `dateRange`, `currency` are all read from `useSearchParams()` and written via `useRouter().push()` through a single `updateParams()` helper that merges into existing params (so filters don't clobber each other or the active tab).
- **Currency persistence**: `analytics-currency` localStorage key, read as a fallback only when the URL has no `currency` param (URL wins over localStorage), matching "read from URL OR localStorage."
- **Lazy loading**: `mountedTabs: Set<string>` accumulates tab keys as they're activated. Only mounted tabs render at all (others get zero DOM presence); the active one is shown, previously-visited ones are kept mounted but hidden (`className="hidden"`) so they don't refetch on every tab switch, while still only fetching once on first activation.
- **Error handling**: if `?tab=` doesn't match any key in `TABS`, renders `Tab not found: {activeTab}` with no console output.
- **Suspense boundary**: added an outer `<Suspense>` around the `useSearchParams()`-consuming inner component. This is purely an internal implementation detail (doesn't change the public `AnaliticaClient` export or touch `page.tsx`) to keep the component safe under Next.js's client-rendering bailout rules for `useSearchParams`.
- Removed the old single-dashboard data fetching, `money()`/`pct()`/chart rendering, etc. — none of that belongs in the shell per the plan; it now moves to the individual tab components in later tasks.

## Verification Results

### TypeScript Compilation
- Ran `./node_modules/.bin/tsc --noEmit` (had to `bun install` first — `node_modules` was missing in this workspace).
- As-is (tab files don't exist yet): only the 10 expected `TS2307: Cannot find module './tabs/...'` errors, one per not-yet-created tab file — exactly what's expected since Tasks 3–14 haven't run.
- Sanity check: temporarily created throwaway stub files for all 10 missing modules (same prop shape: `{ dateRange, currency }` / `{ title }`), reran `tsc --noEmit` — **zero errors attributable to `analitica-client.tsx`**. Only 5 pre-existing, unrelated errors remained in `__tests__/integration/inventory-change-unit.integration.test.ts` (unrelated to this task). Deleted the throwaway stubs immediately after; `git status` confirms no leftover files.

### ESLint
- `./node_modules/.bin/eslint app/\(app\)/analitica/analitica-client.tsx` — clean, 0 problems.
- Two issues were caught and fixed during this pass by the project's React Compiler / hooks lint rules:
  1. `react-hooks/set-state-in-effect`: initially synced `currency` from the URL param via a `useEffect` calling `setState` — flagged as an anti-pattern. Replaced with a pure derivation (`currency = isValidCurrency(currencyParam) ? currencyParam : storedCurrency`), no effect needed.
  2. Same rule for `mountedTabs`: replaced the `useEffect` that added the active tab to the Set with React's documented "adjust state during render" pattern (a guarded, conditional `setState` call in the render body, not inside an effect).
  3. `react-hooks/preserve-manual-memoization`: `useCallback` deps array for `handleCurrencyChange` needed `setStoredCurrency` added explicitly for the compiler to preserve memoization.

### Manual review against the 10-point spec
1. Imports — all 11 tab components imported as specified (9 named default imports + `tab-stub`). ✓
2. `TABS` const array — matches spec exactly, including inline stub components for Compras/Rutas. ✓
3. State: `activeTab` (URL, default `resumen`), `currency` (URL → localStorage → default `bs`), `dateRange` (URL, default `12m`), `mountedTabs: Set<string>`. ✓
4. Navigation: all changes go through `updateParams()` → `router.push()`; currency also persisted to localStorage. ✓
5. Layout: `flex flex-col h-screen bg-gray-50` wrapping header / tab nav / `flex-1 overflow-auto` content area. ✓
6. Global filter bar: 30 días / 90 días / 12 meses buttons + Bs./USD toggle, both update state + URL together. ✓
7. Tab nav bar: 11 tabs, active tab has blue underline + blue text, inactive gray with hover. ✓
8. Tab content: active tab rendered with `dateRange`/`currency` props; only mounted tabs get any DOM presence; new tabs added to `mountedTabs` on first activation. ✓
9. Error handling: invalid `?tab=` renders "Tab not found: X", no console calls anywhere in the file. ✓
10. Global constraints: all filter state lives in URL params; localStorage used only for the currency key; zero API calls in the shell; Tailwind used throughout, matching the existing app's button/card styling conventions. ✓

## File Location
`/Users/eugenio/conductor/workspaces/profitplus-exporter/ashgabat/app/(app)/analitica/analitica-client.tsx`

## Commits
`93990b5` — `refactor: convert dashboard to tabbed shell with global filters`

## Concerns
- **Expected, not a defect**: `tsc --noEmit` will show 10 `Cannot find module` errors on `analitica-client.tsx` until Tasks 3–14 create the actual tab component files and `tab-stub.tsx`. Confirmed via a temporary throwaway-stub sanity check that the shell's own logic has zero type errors once those modules exist.
- **`node_modules` was absent in this workspace** at task start; ran `bun install` to enable local `tsc`/`eslint` verification. Not a code change, just an environment note for whoever verifies this next.
- Manual tests from the plan (clicking tabs in a running `npm run dev`/`bun dev` instance, checking `localStorage`, hard refresh, invalid `?tab=` in the address bar) were **not** run end-to-end in a browser, since 9 of the 11 tab components don't exist yet and importing them would break the dev server. Static verification (tsc + eslint + manual spec review, including a stub-backed compile check) was used instead. Full browser-based navigation testing is appropriate once Task 15 (integration testing) runs after all tab components exist.

---

## Fix Round 1

**Status:** FIXED

**Changes:**
- Line 151: h1 text changed from "Panel Analítico" to "Analítica"
- Tab mounting pattern: kept as-is (design accepted — see ledger ruling)

**Verification:**
- TypeScript: 0 errors (10 expected module-not-found remain)
- ESLint: 0 problems
- Commit: b225f6d fix: update header text to match spec
