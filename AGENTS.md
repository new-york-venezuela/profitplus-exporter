# AGENTS.md — Context for LLM Coding Assistants

This file describes the architecture, conventions, and extension patterns
for the ProfitPlus Exporter. Read this before making any changes.

## System Architecture

Two databases, one Next.js 16 App Router app:

| Database   | Purpose              | Driver              | Location          |
|-----------|----------------------|---------------------|-------------------|
| SQLite    | User accounts / auth | Drizzle + bun:sqlite | `data/exporter.db`    |
| SQL Server| ERP report data      | mssql singleton pool | Profit Plus server|

Sessions are **stateless JWTs** in `httpOnly` cookies — no session table.

## Directory Map

```
lib/
  auth/session.ts       — signToken(), verifyToken() — pure, Edge-safe
  auth/get-session.ts   — getSession() — uses next/headers, Server only
  db/schema.ts          — Drizzle tables: users, user_modules, inventory_warehouses, inventory_settings
  db/sqlite.ts          — Drizzle client singleton
  db/mssql.ts           — mssql pool singleton: getPool()
  reports/registry.ts   — ColumnDef, ReportConfig, REPORTS map
  reports/ventas.ts     — Ventas report config
  reports/compras.ts    — Compras report config
  dates.ts              — getPreviousMonthRange(), parseDate()
  csv.ts                — buildCsv() with UTF-8 BOM
```

**No `middleware.ts`** — there is no Edge Runtime request guard in this
app. Every route (page or API) must check auth/role/module access
independently; there is no shared enforcement layer to fall back on.
Server Components use `getSession()`; API Route Handlers use
`getSessionFromRequest(request)` instead (see Auth Flow Summary below).

## Database Quirk: Spanish Collation

The SQL Server ERP uses `Modern_Spanish_CI_AS` collation. This means:
- String comparisons are **case-insensitive** by default
- Characters like Á, É, Ñ, Ü are sorted correctly for Spanish
- The `BETWEEN` operator on date columns works as expected
- Column aliases in views may use Spanish characters — the `label` field in
  `ColumnDef` should match the intended display name, not the SQL alias

The CSV builder (`lib/csv.ts`) prepends a UTF-8 BOM (`﻿`) so Excel
on Spanish Windows auto-detects the encoding without the Import Wizard.

## Adding a New Report

1. Create `lib/reports/<name>.ts`:
   ```typescript
   import type { ReportConfig } from './registry';
   export const NAME_CONFIG: ReportConfig = {
     id:         '<name>',
     label:      'Display Name',
     queryType:  'view',        // or 'procedure'
     sourceName: 'v_view_name', // SQL view or SP name
     dateColumn: 'fecha',       // column used in WHERE clause (views only)
     columns: [
       { key: 'col_alias', label: 'Spanish Label', defaultVisible: true, defaultOrder: 0 },
       // alwaysVisible: true — column cannot be toggled off
     ],
   };
   ```

2. Add to `lib/reports/registry.ts`:
   ```typescript
   import { NAME_CONFIG } from './name';
   export const REPORTS = { ..., name: NAME_CONFIG };
   ```

3. Add nav link in `components/sidebar.tsx` (NAV_REPORTS array).

4. Create page: `app/(app)/reports/<name>/page.tsx` (copy from ventas).

No changes needed to API routes — they use `REPORTS[reportId]` dynamically.

## Auth Flow Summary

```
POST /api/auth/login
  → Bun.password.verify(hash, password)
  → signToken({ sub, role, name })
  → Set-Cookie: session=<jwt>; HttpOnly

Every page/route (no shared middleware — checked independently)
  → fail → redirect /login or 401 JSON

Server Components (page.tsx)
  → getSession() (lib/auth/get-session.ts) → verifyToken(cookie)
  → relies on next/headers cookies(), only valid inside a real request scope

API Route Handlers
  → getSessionFromRequest(request) (lib/inventory/access.ts) → verifyToken(cookie)
  → reads the cookie off the NextRequest directly — use this instead of
    getSession() in route handlers, since getSession() throws when called
    outside a live Next.js request (e.g. in a test)

Admin-only API routes
  → getSessionFromRequest(request) → check role === 'admin' → 403 if not

Admin page (Server Component)
  → getSession() → role !== 'admin' → redirect('/reports/ventas')
```

## Code Conventions

- **No date library** — use `lib/dates.ts` for all date math
- **Drizzle queries are synchronous** — no `await` needed; `Bun.password` and `jose` are async
- **mssql queries use `.input()` for ALL user-controlled values** — never concatenate
- **CSV encoding** — always use `buildCsv()` from `lib/csv.ts`; never construct CSV manually
- **Error responses** — always `{ error: string }` shape with appropriate HTTP status
- **Admin check** — check `role === 'admin'` in every admin route independently (no middleware to rely on instead); Server Components call `getSession()`, API Route Handlers call `getSessionFromRequest(request)` instead — `getSession()` throws outside a live request scope

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable              | Used by                          |
|-----------------------|----------------------------------|
| `SQLITE_PATH`         | `lib/db/sqlite.ts`               |
| `JWT_SECRET`          | `lib/auth/session.ts`            |
| `DB_SERVER` + `DB_*`  | `lib/db/mssql.ts`                |
| `NODE_ENV`            | Cookie `secure` flag, dev guards |
