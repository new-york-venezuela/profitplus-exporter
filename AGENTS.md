# AGENTS.md — Context for LLM Coding Assistants

This file describes the architecture, conventions, and extension patterns
for the ProfitPlus Exporter. Read this before making any changes.

## System Architecture

Two databases, one Next.js 15 App Router app:

| Database   | Purpose              | Driver              | Location          |
|-----------|----------------------|---------------------|-------------------|
| SQLite    | User accounts / auth | Drizzle + better-sqlite3 | `data/app.db`    |
| SQL Server| ERP report data      | mssql singleton pool | Profit Plus server|

Sessions are **stateless JWTs** in `httpOnly` cookies — no session table.

## Directory Map

```
lib/
  auth/session.ts       — signToken(), verifyToken() — pure, Edge-safe
  auth/get-session.ts   — getSession() — uses next/headers, Server only
  db/schema.ts          — Drizzle users table
  db/sqlite.ts          — Drizzle client singleton
  db/mssql.ts           — mssql pool singleton: getPool()
  reports/registry.ts   — ColumnDef, ReportConfig, REPORTS map
  reports/ventas.ts     — Ventas report config
  reports/compras.ts    — Compras report config
  dates.ts              — getPreviousMonthRange(), parseDate()
  csv.ts                — buildCsv() with UTF-8 BOM

middleware.ts           — Edge Runtime JWT guard (no next/headers here!)
```

## Critical Constraint: Edge Runtime in middleware.ts

`middleware.ts` runs in Next.js Edge Runtime. You MUST NOT import:
- `next/headers`
- `better-sqlite3`
- `mssql`
- `argon2`
- Any Node.js built-ins that aren't Edge-compatible

Only `jose` and `lib/auth/session.ts` are safe to import there.

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
  → argon2.verify(hash, password)
  → signToken({ sub, role, name })
  → Set-Cookie: session=<jwt>; HttpOnly

middleware.ts (every request except /login, /api/auth/*)
  → verifyToken(cookie)
  → fail → redirect /login or 401 JSON

Admin-only API routes
  → getSession() → check role === 'admin' → 403 if not

Admin page (Server Component)
  → getSession() → role !== 'admin' → redirect('/reports/ventas')
```

## Code Conventions

- **No date library** — use `lib/dates.ts` for all date math
- **Drizzle queries are synchronous** — no `await` needed; `argon2` and `jose` are async
- **mssql queries use `.input()` for ALL user-controlled values** — never concatenate
- **CSV encoding** — always use `buildCsv()` from `lib/csv.ts`; never construct CSV manually
- **Error responses** — always `{ error: string }` shape with appropriate HTTP status
- **Admin check** — call `getSession()` and check `role === 'admin'` in every admin route handler independently (don't rely solely on middleware)

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable              | Used by                          |
|-----------------------|----------------------------------|
| `SQLITE_PATH`         | `lib/db/sqlite.ts`               |
| `JWT_SECRET`          | `lib/auth/session.ts`            |
| `DB_SERVER` + `DB_*`  | `lib/db/mssql.ts`                |
| `NODE_ENV`            | Cookie `secure` flag, dev guards |
