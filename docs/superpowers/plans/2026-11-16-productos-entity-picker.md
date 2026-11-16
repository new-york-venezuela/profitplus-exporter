# Productos Casa Matriz / Tienda Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Productos tienda picker offers casas matriz (aggregate of all their stores) and individual stores; every Productos section honours either.

**Architecture:** One pure module parses the `tienda` param into a typed filter and emits the SQL key-subquery plus input bindings. The route and `fetchGroupShare` consume it instead of the bare `tiendaCode`. The picker payload gains a `group` field rendered by `SearchableSelect`.

**Tech Stack:** Next.js 16, bun test, mssql, React.

**Spec:** `docs/superpowers/specs/2026-11-16-productos-entity-picker-design.md`

## Global Constraints

- `tienda` param: `e:<LegalEntityKey>` entity, `t:<code>` store, bare value = store.
- Entity filter resolves via CURRENT rows (`IsCurrent = 1 AND LegalEntityKey = @entidadKey`), then matches every SCD version of those codes. Never filter facts on `LegalEntityKey` directly (old versions are NULL).
- All user values via `.input()`; never concatenate.
- Casas matriz = `Dim_LegalEntity.StoreCount > 1`. No store drilldown in this change.
- Do not touch the Clientes/Devoluciones tienda filters.

## Review Focus

- Malformed param (`e:abc`, `e:`, `t:`, empty, whitespace) -> treated as no filter, never an SQL error.
- Entity with a store that has old SCD versions: sales under old keys still counted (test asserts SQL goes through `CustomerCode IN (...)`).
- Matriz root appears in both groups without value collision (`e:` vs `t:` prefixes).
- Stale numeric selection from before the previous fix (`tienda=42`) -> treated as store code, matches nothing, no error.
- Profundidad tier column hidden only for a single store, shown for an entity.

---

### Task 1: Tienda filter module

**Files:**
- Create: `lib/productos/tienda-filter.ts`
- Test: `lib/productos/__tests__/tienda-filter.test.ts`

**Interfaces:**
- Produces:
  - `type TiendaFilter = { kind: 'entidad'; key: number } | { kind: 'tienda'; code: string }`
  - `parseTienda(param: string | null): TiendaFilter | null`
  - `tiendaKeysSql(f: TiendaFilter): string` — a `SELECT tk.CustomerKey ...` subquery using `@tiendaCode` or `@entidadKey`
  - `bindTienda(req: { input(name: string, value: unknown): unknown }, f: TiendaFilter | null): void`
  - `isSingleStore(f: TiendaFilter | null): boolean`

- [ ] **Step 1: Write failing tests** covering: `parseTienda('e:12')` -> `{kind:'entidad',key:12}`; `'t:J123'` and bare `'J123'` -> `{kind:'tienda',code:'J123'}`; `'e:abc'`, `'e:'`, `'t:'`, `''`, `'  '`, `null` -> `null`; `tiendaKeysSql` for entidad contains `cur.IsCurrent = 1`, `cur.LegalEntityKey = @entidadKey` and `CustomerCode IN`; for tienda contains `tk.CustomerCode = @tiendaCode`; `bindTienda` binds `entidadKey` (number) or `tiendaCode` (string) and nothing for `null`; `isSingleStore`.
- [ ] **Step 2: Run** `bun test lib/productos/__tests__/tienda-filter.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the module above. Reuse the exact store subquery currently in `app/api/dwh/productos/route.ts` (`TIENDA_KEYS`).
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(productos): tienda filter module (entidad|tienda)`.

### Task 2: Wire route, group share and picker payload

**Files:**
- Modify: `app/api/dwh/productos/route.ts` (replace `tiendaCode`/`TIENDA_KEYS`/`bindFilters` tienda handling with `TiendaFilter`; rewrite `tiendasQuery` and the `?tiendas=1` response)
- Modify: `lib/productos/queries.ts` (`GroupShareQueryOptions.tiendaCode` -> `tienda: TiendaFilter | null`)
- Modify: `scripts/dwh/__tests__/consolidation-queries.test.ts` (`tiendaCode: null` -> `tienda: null`; store case -> `tienda: { kind: 'tienda', code: 'C1' }`; add an entity case if the fixture has a matriz, else skip)
- Test: `app/api/dwh/productos/__tests__/route.filters.test.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `GET ?tiendas=1` -> `{ tiendas: { value: string; label: string; group: 'Casas matriz' | 'Tiendas' }[] }`; values `e:<key>` / `t:<code>` (trimmed). Entities listed: `StoreCount > 1` with at least one non-voided sale across its current stores' codes, label `"<name> · <n> tiendas"`, ordered by name, entities first.

- [ ] **Step 1: Update/add failing tests** in `route.filters.test.ts`: the existing store tests (`tienda=J123` bare and `t:J123`) still bind `tiendaCode: 'J123'`; `tienda=e:7` on `section=porLineaMes` and `section=grupos` binds `entidadKey: 7` and SQL contains `LegalEntityKey = @entidadKey`; `tienda=e:abc` runs with no tienda input; `?tiendas=1` with mocked rows returns both groups with prefixed values and the store-count label.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local app/api/dwh/productos` — expect the new tests FAIL.
- [ ] **Step 3: Implement.** Parse once in `GET` via `parseTienda`; build `tiendaOnlyWhere` and `returnsTiendaWhere` as `AND fs|fr.CustomerKey IN (${tiendaKeysSql(f)})`; `bindFilters` calls `bindTienda`. Picker: run the entity query and the existing store query (two statements or two requests; keep each readable) and concatenate.
- [ ] **Step 4: Run** `bunx tsc --noEmit -p .` and `bun test --isolate --env-file=.env.local app/api/dwh` — expect clean / all pass.
- [ ] **Step 5: Commit** `feat(productos): casa matriz filter across all sections`.

### Task 3: Grouped picker UI

**Files:**
- Modify: `lib/components/searchable-select.tsx` (optional `group?: string` on `SearchableSelectOption`; render a non-selectable header when the group changes in the filtered list; no change when no option has a group)
- Modify: `app/(app)/analitica/tabs/tab-productos.tsx` (tiendas state type gains `group`; `hideTier={isSingleStore(parseTienda(tienda))}` — import the pure helpers, they are client-safe; label "Tienda:" -> "Entidad / tienda:")
- Test: `lib/components/__tests__/searchable-select.test.tsx` (component test, follow `app/(app)/analitica/components/__tests__/` conventions: import `screen` from `test/dom-setup` first, `cleanup` in `afterEach`)

**Interfaces:**
- Consumes: Task 2 payload shape; Task 1 `parseTienda`, `isSingleStore`.

- [ ] **Step 1: Write failing tests:** options with two groups render two header texts in order; options without `group` render no headers; typing a query that matches only one group hides the other header.
- [ ] **Step 2: Run** `bun run test:components` — expect new tests FAIL.
- [ ] **Step 3: Implement** the grouped rendering and the tab changes.
- [ ] **Step 4: Run** `bun run test:components`, `bunx tsc --noEmit -p .` — expect pass/clean. Then verify in the running app: pick a casa matriz, confirm the table, Profundidad (tier visible), trend and Grupos change and that the line totals equal the sum of its stores picked one by one.
- [ ] **Step 5: Commit** `feat(productos): grouped entidad/tienda picker`.
