# Development & Deployment Instructions

Covers local development setup (including the mock ERP + DWH for offline
work) and production deployment on Windows Server + IIS.

---

# Part 1: Development

## Prerequisites

- **Bun 1.x** — https://bun.sh
- Access to a SQL Server instance with the ERP database, **or** the
  Dockerized mock ERP described below for fully offline development
- Node.js 20+ is only needed if a tool in your chain requires it; the app
  itself runs entirely under Bun

## First-Time Setup

```bash
git clone <repo>
cd profitplus-exporter
bun install

cp .env.example .env.local
# Edit .env.local:
#  - JWT_SECRET: openssl rand -hex 32
#  - DB_* values for your SQL Server instance (or the mock ERP, see below)

bun run migrate         # SQLite: users, user_modules, inventory_warehouses, inventory_settings
bun run migrate:mssql   # ERP: stored procedures the app needs (mssql-migrations/), e.g. pApiCrearAjusteInventario
bun run seed            # create the first admin user (interactive prompt)

bun dev                 # http://localhost:3000
```

`migrate:mssql` runs against the **ERP** database (`DB_*`), not the DWH —
it installs stored procedures the inventory-adjustments feature calls
directly (`mssql-migrations/`), separate from both `migrate` (SQLite) and
`migrate:dwh` (the DWH warehouse, see below). Skip it only if you're not
touching inventory adjustments and the target ERP already has these
procedures installed.

## Two Databases, Three Migration Targets

| Database                 | Purpose                                   | Driver                | Config                | Migrate with          |
|---------------------------|--------------------------------------------|------------------------|------------------------|-------------------------|
| SQLite (`data/exporter.db`) | User accounts, module permissions          | Drizzle + `bun:sqlite` | `SQLITE_PATH`          | `bun run migrate`       |
| SQL Server — ERP           | Live Profit Plus data (reports, inventory) — plus app-specific stored procedures | `mssql` singleton pool | `DB_*`                 | `bun run migrate:mssql` |
| SQL Server — DWH            | `DWH_AlimentosNY`, sales/returns/collections analytics | `mssql` singleton pool (separate) | `DW_*` (falls back to `DB_*`) | `bun run migrate:dwh`   |

The ERP database itself is Profit Plus's own schema (not ours to migrate) —
`migrate:mssql` only adds a handful of app-specific stored procedures
(`mssql-migrations/`) the app calls directly, like
`pApiCrearAjusteInventario` for inventory adjustments.

The DWH lives on the **same SQL Server instance** as the ERP by default —
it's a different database (`DWH_AlimentosNY`), not a different server. Only
set `DW_*` vars if the DWH is genuinely on a different host/credentials than
the ERP; otherwise leave them unset and the DWH tooling reuses `DB_*` with
`DW_NAME` defaulting to `DWH_AlimentosNY`.

## Mock ERP for Offline Development

A Dockerized SQL Server instance seeded with a real (anonymized) Profit
Plus backup lets you develop without VPN access to the production ERP.

```bash
cd docker
docker-compose up -d          # starts mcr.microsoft.com/mssql/server, restores Ncake_a.bak
./init-db.sh                  # runs mssql/init.sql + mssql/data.sql against it
```

Point `.env.local` at it — this matches the block already at the bottom of
`.env.example`:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourStr0ngP@ssw0rd
DB_NAME=Ncake_a
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true
```

See `docker/README.md` for details on what's seeded and how to reset it.

## Setting Up the DWH Locally

The DWH (`DWH_AlimentosNY`) is a separate, pre-aggregated Kimball-style
warehouse built from the ERP via `dwh-migrations/` — dimension tables
(`dim.*`), fact tables (`fact.*`), and `Load_*`/`Snapshot_*` stored
procedures. It powers `/analitica` (the analytics dashboard) and is
independent of the raw ERP tables the rest of the app queries.

```bash
# 1. Apply all DWH schema migrations (creates the database if it doesn't exist)
bun run migrate:dwh

# 2. Populate it by running each Load_*/Snapshot_Fact_AR procedure once,
#    in dependency order (dims before facts; see dwh-migrations/README.md
#    "Layout" section for the full list). There's no single "load everything"
#    script outside of Task 11's disabled-by-default SQL Agent job — for
#    local dev, run them directly against the DWH pool, e.g. via a throwaway
#    tsx script or SSMS:
```

```sql
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
EXEC dwh.Snapshot_Fact_AR;   -- @SnapshotDate defaults to today (UTC)
```

Without this, `/analitica` will 500 with "Invalid object name" (schema
exists, tables are empty/absent depending on which step was skipped) or
render empty charts (tables exist but have no rows).

For real production-cadence loading, see `dwh-migrations/README.md` →
"Enabling the SQL Agent jobs" — the two jobs (`DWH - Incremental Load`,
`DWH - Daily AR Snapshot`) are created disabled by migration `0013` and
need a schedule decided before enabling.

**Adding a new migration**: see `dwh-migrations/README.md` for numbering,
idempotency (`IF NOT EXISTS` / `CREATE OR ALTER`), and the two-column
watermark pattern needed if the new fact table sources a Profit Plus detail
table without a `validador` rowversion column (`saFacturaVentaReng` and
friends — see that file's "Incremental watermark strategy" section before
assuming `validador` exists on a new source table).

## Granting Module Access (Inventory / Analítica)

Both the inventory module (`/inventario/*`) and the analytics dashboard
(`/analitica`) are gated behind a per-user module grant, not just role.
Admins (`role = 'admin'`) always have access to both; regular users need an
explicit grant from `/admin/users` (checkbox per user, per module) or via:

```
PUT /api/admin/users/:id/modules
Body: { "modules": ["inventory", "dwh"] }
```

See `AGENTS.md` → "Module-Based Permissions" for how this is enforced at
both the page and API layer.

## Running Tests

```bash
bun test                 # unit tests, excludes e2e/ and the MSSQL integration test
bun run test:unit        # same, plus excludes compras-export.integration.test.ts
bun run test:mssql       # the one integration test that needs a live/mock ERP connection
```

**DWH tests** (`scripts/dwh/__tests__/`) need `DW_NAME` pointed at a
disposable test database — they create it, migrate it, run assertions, and
drop it in `afterAll`. Never point `DW_NAME` at a database you care about
when running these:

```bash
DW_NAME=DWH_AlimentosNY_Test bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/
```

The `--timeout 30000` is required, not optional — the default 5s `bun test`
timeout is too tight once `beforeAll` applies 5+ migrations against a fresh
database. `bunfig.toml`'s `[test] timeout` key does **not** work for this in
Bun 1.3.14 (confirmed empirically) — always pass `--timeout` on the CLI.

```bash
bun run e2e               # Playwright, excludes @mssql-tagged specs
bun run e2e:mssql         # Playwright specs that need the mock/live ERP
bun run e2e:ui            # Playwright UI mode
bun run e2e:seed          # seed data for e2e runs
```

## Adding a New ERP Report

See `AGENTS.md` → "Adding a New Report" for the full walkthrough
(`ReportConfig`, registry, sidebar nav, page). Unchanged from the original
report-export feature — this pattern is separate from the DWH/analytics
dashboard below.

## Adding a New Chart to the Analytics Dashboard

The dashboard (`app/(app)/analitica/`) queries the DWH directly — it does
not go through the ERP report registry. To add a new metric:

1. Add a query to `app/api/dwh/dashboard/route.ts` (or a new route if the
   dashboard grows past one API call) — query `dim.*`/`fact.*` tables only,
   never the raw ERP tables from here; the DWH has already handled
   collation/RTRIM at load time so these queries stay simple.
2. Extend the JSON response shape and the corresponding TypeScript
   interface in `app/(app)/analitica/analitica-client.tsx`.
3. Add a chart using Recharts (`ResponsiveContainer` + `BarChart` /
   `ComposedChart` — see existing charts in that file for the estabished
   KPI-card / chart-card layout conventions).

---

# Part 2: Production Deployment — Windows Server + IIS

## Architecture

```
Internet/Intranet → IIS (port 80/443)
                    └── ARR Reverse Proxy
                        └── Bun (port 3000, managed by NSSM)
                            └── Next.js production server
                                ├── SQLite (users/auth, local file)
                                ├── SQL Server: ERP (reports, inventory)
                                └── SQL Server: DWH_AlimentosNY (analytics)
```

The ERP and DWH connections can point at the same SQL Server instance or
different ones — see `DW_*` fallback behavior in Part 1.

## Prerequisites

Install on the Windows Server:

1. **Bun** — Run in PowerShell: `irm bun.sh/install.ps1 | iex`
2. **IIS** with:
   - **Application Request Routing (ARR)** 3.0
   - **URL Rewrite** 2.1
   Both installable via Web Platform Installer or winget.
3. **NSSM** (Non-Sucking Service Manager) — https://nssm.cc/download

## Step 1: Prepare the App

```powershell
# On the server, choose a deployment directory
$APP = "C:\inetpub\apps\profitplus-exporter"
New-Item -ItemType Directory -Path $APP

# Copy built files (from your dev machine or CI):
# - .next/
# - public/
# - package.json
# - node_modules/          (run `bun install --production` on server instead)
# - drizzle/migrations/
# - dwh-migrations/
# - mssql-migrations/
# - scripts/migrate.ts
# - scripts/migrate-dwh.ts
# - scripts/migrate-mssql.ts
# - scripts/seed.ts
# - lib/                   (needed by scripts at runtime)
# - .env.local              (create on server, never commit)
```

## Step 2: Install Dependencies on Server

```powershell
cd $APP
bun install --production
```

This compiles native modules (`better-sqlite3`, `argon2`, `mssql`) for Windows.

## Step 3: Configure Environment

Create `C:\inetpub\apps\profitplus-exporter\.env.local`:

```env
# ERP
DB_SERVER=<sql-server-ip>
DB_PORT=1433
DB_NAME=<erp-db-name>
DB_USER=<readonly-user>
DB_PASSWORD=<password>
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true

# DWH — omit entirely if it's the same instance/credentials as the ERP above;
# DW_NAME defaults to DWH_AlimentosNY, everything else falls back to DB_*
# DW_SERVER=<dwh-sql-server-ip>
# DW_PORT=1433
# DW_NAME=DWH_AlimentosNY
# DW_USER=<readonly-user>
# DW_PASSWORD=<password>

# Absolute path OUTSIDE the app directory — survives redeploys
SQLITE_PATH=C:\data\profitplus-exporter\app.db

JWT_SECRET=<run: openssl rand -hex 32>
JWT_EXPIRY_DAYS=7

NEXT_PUBLIC_APP_NAME=ProfitPlus Exporter
NODE_ENV=production
```

Create the SQLite data directory:

```powershell
New-Item -ItemType Directory -Path "C:\data\profitplus-exporter"
```

## Step 4: Run Migrations & Create Admin

```powershell
cd $APP
bun run migrate         # SQLite: users, permissions
bun run migrate:mssql   # ERP: app-specific stored procedures (mssql-migrations/)
bun run migrate:dwh     # SQL Server: DWH_AlimentosNY schema (dim/fact tables, Load_* procs)
bun run seed
```

`migrate:dwh` only creates/updates schema — it does not load any data. See
"Loading the DWH" below.

## Step 5: Build the App

```powershell
cd $APP
bun run build
```

Expected: `.next/` directory populated with production build.

## Step 6: Register as a Windows Service via NSSM

```powershell
# Download nssm.exe and place in C:\tools\nssm.exe

C:\tools\nssm.exe install ProfitPlusExporter

# In the NSSM dialog:
# Path:           C:\Users\<user>\.bun\bin\bun.exe
# Startup dir:    C:\inetpub\apps\profitplus-exporter
# Arguments:      run start
# Display name:   ProfitPlus Exporter

# Or via command line:
C:\tools\nssm.exe install ProfitPlusExporter `
  "C:\Users\Administrator\.bun\bin\bun.exe" "run start"
C:\tools\nssm.exe set ProfitPlusExporter AppDirectory $APP
C:\tools\nssm.exe set ProfitPlusExporter DisplayName "ProfitPlus Exporter"
C:\tools\nssm.exe set ProfitPlusExporter Start SERVICE_AUTO_START

# Start the service
C:\tools\nssm.exe start ProfitPlusExporter

# Verify it's running on port 3000
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

## Step 7: Configure IIS Reverse Proxy

### 7a. Enable ARR proxy

Open IIS Manager → Server node → Application Request Routing Cache → Server Proxy Settings → Check "Enable proxy" → Apply.

### 7b. Create IIS Site

```powershell
# Create a new IIS site pointing to a dummy directory
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\profitplus"
New-WebSite -Name "ProfitPlusExporter" `
  -Port 80 `
  -PhysicalPath "C:\inetpub\wwwroot\profitplus" `
  -Force
```

### 7c. Add URL Rewrite rule

Create `C:\inetpub\wwwroot\profitplus\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 7d. Verify

Open `http://<server-ip>` in a browser — you should see the ProfitPlus login page.

## Step 8: Loading the DWH

`migrate:dwh` (Step 4) only creates schema. To populate it and keep it
current, either:

- **One-off load**: run each `dwh.Load_*` procedure and
  `dwh.Snapshot_Fact_AR` directly via SSMS, in the dependency order listed
  in "Setting Up the DWH Locally" above, or
- **Scheduled load (recommended for production)**: enable the two SQL
  Agent jobs created (disabled) by `dwh-migrations/0013_sql_agent_jobs.sql`
  — `DWH - Incremental Load` and `DWH - Daily AR Snapshot`. See
  `dwh-migrations/README.md` → "Enabling the SQL Agent jobs" for the exact
  `sp_update_job`/`sp_add_jobschedule` calls and how to pick a cadence.

Until at least one load has run, `/analitica` renders with empty charts
(not an error) — the API treats zero rows as valid, empty data.

## Redeploy Procedure

```powershell
# 1. Stop service
C:\tools\nssm.exe stop ProfitPlusExporter

# 2. Copy new files (excluding .env.local and data/)
# 3. Install dependencies (if package.json changed)
bun install --production

# 4. Run migrations (if schema changed)
bun run migrate
bun run migrate:mssql # if mssql-migrations/ has new files
bun run migrate:dwh   # if dwh-migrations/ has new files

# 5. Build
bun run build

# 6. Start service
C:\tools\nssm.exe start ProfitPlusExporter
```

## Service Management

```powershell
C:\tools\nssm.exe status ProfitPlusExporter  # Check status
C:\tools\nssm.exe restart ProfitPlusExporter  # Restart
C:\tools\nssm.exe edit ProfitPlusExporter     # Edit config
```
