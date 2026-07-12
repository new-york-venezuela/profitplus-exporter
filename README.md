# ProfitPlus Exporter

Internal web app for querying Profit Plus ERP (SQL Server) and exporting
custom date-filtered reports to CSV. Built because the ERP's built-in
reports are rigid and can't be easily customized.

## Tech Stack

| Layer        | Technology                                   |
|-------------|----------------------------------------------|
| Framework    | Next.js 16 (App Router), TypeScript 5        |
| Package mgr  | Bun                                          |
| Auth DB      | SQLite via Drizzle ORM + better-sqlite3      |
| ERP DB       | SQL Server via mssql                         |
| Auth         | argon2id passwords, JWT in httpOnly cookies  |
| UI           | Tailwind CSS v4, @dnd-kit/sortable           |

## Prerequisites

- Node.js 20+ (for native module compilation)
- Bun 1.x — https://bun.sh
- Access to SQL Server instance with the ERP database

## Local Setup

```bash
# 1. Clone and install
git clone <repo>
cd profitplus-exporter
bun install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local:
#  - Set JWT_SECRET to: openssl rand -hex 32
#  - Set DB_* values for your SQL Server instance

# 3. Run database migrations
bun run migrate

# 4. Create first admin user
bun run seed

# 5. Start development server
bun dev
# Open http://localhost:3000
```

## Adding a Report

1. Create `lib/reports/<name>.ts` with your `ReportConfig`.
2. Add `<name>: YOUR_CONFIG` to `REPORTS` in `lib/reports/registry.ts`.
3. Add a nav entry to `components/sidebar.tsx`.
4. Create `app/(app)/reports/<name>/page.tsx` (copy ventas page, change config key).

See `AGENTS.md` for column definition format and `lib/reports/ventas.ts` for a working example once columns are populated.

## Scripts

| Command            | Purpose                                   |
|--------------------|-------------------------------------------|
| `bun dev`          | Start development server                  |
| `bun run build`    | Build for production                      |
| `bun run start`    | Start production server (after build)     |
| `bun run seed`     | Create admin user interactively           |
| `bun run migrate`  | Apply SQLite migrations                   |
| `bun run db:generate` | Generate new Drizzle migration         |
| `bun test`         | Run unit tests                            |
