# Stored Procedure Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Libro de Ventas and Libro de Compras reports to use SQL Server stored procedures, populate column definitions, and test the full export flow from browser to CSV.

**Architecture:** Switch report configs from view-based (`queryType: 'view'`) to procedure-based (`queryType: 'procedure'`). The API layer already supports procedures via `.execute()`, so no backend changes needed. Populate column arrays to match the stored procedure schema. Test end-to-end: date picker → preview → export.

**Tech Stack:** Next.js 16 (App Router), TypeScript, mssql driver, Tailwind CSS

## Global Constraints

- SQL Server uses `Modern_Spanish_CI_AS` collation
- Stored procedures: `dbo.sp_GetVentasByDateRange`, `dbo.sp_GetComprasByDateRange` (already exist in Docker schema)
- Column keys must match SQL procedure column aliases exactly
- CSV output prepends UTF-8 BOM for Excel auto-detection
- Report configs live in `lib/reports/{ventas,compras}.ts`

---

### Task 1: Update Ventas Report Config

**Files:**
- Modify: `lib/reports/ventas.ts`

**Interfaces:**
- Consumes: Existing `ReportConfig` interface from `lib/reports/registry.ts`
- Produces: `VENTAS_CONFIG` with `queryType: 'procedure'`, 11 columns matching `sp_GetVentasByDateRange` schema

**Steps:**

- [ ] **Step 1: Review current ventas.ts and stored procedure schema**

Open `lib/reports/ventas.ts`. Current config uses view-based query with placeholder columns.

Open `docker/mssql/init.sql` lines 104-124. Procedure returns: `id, fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion, created_at`.

- [ ] **Step 2: Update ventas.ts with procedure config and full column definitions**

Replace entire file content:

```typescript
import type { ReportConfig } from './registry';

export const VENTAS_CONFIG: ReportConfig = {
  id:         'ventas',
  label:      'Libro de Ventas',
  queryType:  'procedure',
  sourceName: 'dbo.sp_GetVentasByDateRange',
  columns: [
    { key: 'fecha',               label: 'Fecha',              defaultVisible: true,  defaultOrder: 0, alwaysVisible: true },
    { key: 'numero_comprobante',  label: 'Número Comprobante', defaultVisible: true,  defaultOrder: 1 },
    { key: 'tipo_comprobante',    label: 'Tipo Comprobante',   defaultVisible: true,  defaultOrder: 2 },
    { key: 'ruc_cliente',         label: 'RUC Cliente',        defaultVisible: true,  defaultOrder: 3 },
    { key: 'nombre_cliente',      label: 'Nombre Cliente',     defaultVisible: true,  defaultOrder: 4 },
    { key: 'monto_neto',          label: 'Monto Neto',         defaultVisible: true,  defaultOrder: 5 },
    { key: 'monto_impuesto',      label: 'Monto Impuesto',     defaultVisible: true,  defaultOrder: 6 },
    { key: 'monto_total',         label: 'Monto Total',        defaultVisible: true,  defaultOrder: 7 },
    { key: 'descripcion',         label: 'Descripción',        defaultVisible: false, defaultOrder: 8 },
    { key: 'id',                  label: 'ID',                 defaultVisible: false, defaultOrder: 9 },
    { key: 'created_at',          label: 'Creado',             defaultVisible: false, defaultOrder: 10 },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/reports/ventas.ts
git commit -m "feat: Update ventas report to use stored procedure dbo.sp_GetVentasByDateRange"
```

---

### Task 2: Update Compras Report Config

**Files:**
- Modify: `lib/reports/compras.ts`

**Interfaces:**
- Consumes: Existing `ReportConfig` interface from `lib/reports/registry.ts`
- Produces: `COMPRAS_CONFIG` with `queryType: 'procedure'`, 11 columns matching `sp_GetComprasByDateRange` schema

**Steps:**

- [ ] **Step 1: Review current compras.ts and stored procedure schema**

Open `lib/reports/compras.ts`. Current config has view reference and empty columns.

Open `docker/mssql/init.sql` lines 74-94. Procedure returns: `id, fecha, numero_comprobante, tipo_comprobante, ruc_proveedor, nombre_proveedor, monto_total, monto_impuesto, monto_neto, descripcion, created_at`.

- [ ] **Step 2: Update compras.ts with procedure config and full column definitions**

Replace entire file content:

```typescript
import type { ReportConfig } from './registry';

export const COMPRAS_CONFIG: ReportConfig = {
  id:         'compras',
  label:      'Libro de Compras',
  queryType:  'procedure',
  sourceName: 'dbo.sp_GetComprasByDateRange',
  columns: [
    { key: 'fecha',               label: 'Fecha',              defaultVisible: true,  defaultOrder: 0, alwaysVisible: true },
    { key: 'numero_comprobante',  label: 'Número Comprobante', defaultVisible: true,  defaultOrder: 1 },
    { key: 'tipo_comprobante',    label: 'Tipo Comprobante',   defaultVisible: true,  defaultOrder: 2 },
    { key: 'ruc_proveedor',       label: 'RUC Proveedor',      defaultVisible: true,  defaultOrder: 3 },
    { key: 'nombre_proveedor',    label: 'Nombre Proveedor',   defaultVisible: true,  defaultOrder: 4 },
    { key: 'monto_neto',          label: 'Monto Neto',         defaultVisible: true,  defaultOrder: 5 },
    { key: 'monto_impuesto',      label: 'Monto Impuesto',     defaultVisible: true,  defaultOrder: 6 },
    { key: 'monto_total',         label: 'Monto Total',        defaultVisible: true,  defaultOrder: 7 },
    { key: 'descripcion',         label: 'Descripción',        defaultVisible: false, defaultOrder: 8 },
    { key: 'id',                  label: 'ID',                 defaultVisible: false, defaultOrder: 9 },
    { key: 'created_at',          label: 'Creado',             defaultVisible: false, defaultOrder: 10 },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/reports/compras.ts
git commit -m "feat: Update compras report to use stored procedure dbo.sp_GetComprasByDateRange"
```

---

### Task 3: Populate Database with Test Data

**Files:**
- Create: `docker/data-seed.sql` (optional, for reference; data inserted via init.py)
- Modify: `docker/init.py` (add test data inserts)

**Interfaces:**
- Consumes: Existing Docker MSSQL container with schema from `init.sql`
- Produces: Compras and Ventas tables populated with realistic test data (5-10 rows spanning last 30 days)

**Steps:**

- [ ] **Step 1: Review current init.py**

Open `docker/init.py`. Check what it currently does (likely only schema creation via init.sql).

- [ ] **Step 2: Add test data inserts to init.py**

After schema creation in init.py, add INSERT statements for test data. Append this code block before the success message:

```python
# Insert test data for ventas
insert_ventas = """
INSERT INTO dbo.ventas (fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
  (CAST(GETDATE() - 15 AS DATE), 'FAC-2026-001', 'Factura', '20123456789', 'Cliente A S.A.', 1000.00, 180.00, 820.00, 'Venta de productos'),
  (CAST(GETDATE() - 14 AS DATE), 'FAC-2026-002', 'Factura', '20987654321', 'Cliente B Inc.', 2500.00, 450.00, 2050.00, 'Servicios consultaría'),
  (CAST(GETDATE() - 10 AS DATE), 'FAC-2026-003', 'Factura', '20555555555', 'Cliente C Corp.', 750.00, 135.00, 615.00, 'Venta de materiales'),
  (CAST(GETDATE() - 5 AS DATE), 'FAC-2026-004', 'Factura', '20123456789', 'Cliente A S.A.', 1200.00, 216.00, 984.00, 'Venta de productos nuevos'),
  (CAST(GETDATE() AS DATE), 'FAC-2026-005', 'Factura', '20999999999', 'Cliente D Ltd.', 3000.00, 540.00, 2460.00, 'Servicios mensual');
"""

# Insert test data for compras
insert_compras = """
INSERT INTO dbo.compras (fecha, numero_comprobante, tipo_comprobante, ruc_proveedor, nombre_proveedor, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
  (CAST(GETDATE() - 20 AS DATE), 'OC-2026-001', 'Orden de Compra', '20111111111', 'Proveedor X S.A.', 500.00, 90.00, 410.00, 'Compra de insumos'),
  (CAST(GETDATE() - 18 AS DATE), 'OC-2026-002', 'Factura', '20222222222', 'Proveedor Y Inc.', 1500.00, 270.00, 1230.00, 'Compra de materias primas'),
  (CAST(GETDATE() - 12 AS DATE), 'OC-2026-003', 'Orden de Compra', '20333333333', 'Proveedor Z Corp.', 800.00, 144.00, 656.00, 'Suministros de oficina'),
  (CAST(GETDATE() - 7 AS DATE), 'OC-2026-004', 'Factura', '20111111111', 'Proveedor X S.A.', 2000.00, 360.00, 1640.00, 'Compra de equipos'),
  (CAST(GETDATE() - 1 AS DATE), 'OC-2026-005', 'Orden de Compra', '20444444444', 'Proveedor W Ltd.', 1200.00, 216.00, 984.00, 'Repuestos y mantenimiento');
"""

cursor.execute(insert_ventas)
cursor.execute(insert_compras)
cursor.commit()
print("✓ Test data inserted into ventas and compras tables")
```

Add this **before** the final `print("✓ Database initialized successfully")` in init.py.

- [ ] **Step 2b: Verify init.py structure and ensure cursor.commit() exists**

Confirm init.py has cursor and connection objects (likely via `pyodbc` or `pymssql`). The commit call must be present. If using a different pattern, adapt the INSERT code to match.

- [ ] **Step 3: Commit**

```bash
git add docker/init.py
git commit -m "test: Add seed data for ventas and compras tables"
```

---

### Task 4: Start Docker and Verify Database State

**Files:**
- (None modified)

**Interfaces:**
- Consumes: docker-compose.yml, init.sql, init.py
- Produces: Running MSSQL container with initialized schema and test data

**Steps:**

- [ ] **Step 1: Start Docker services**

```bash
cd docker
docker-compose up -d
```

Expected output: Container `profitplus-erp-mock` and `profitplus-init` start. Init container runs to completion and exits.

- [ ] **Step 2: Wait for initialization to complete**

```bash
sleep 10
docker logs profitplus-init
```

Expected: Final message shows "✓ Test data inserted" and "✓ Database initialized successfully". If errors, check container logs: `docker logs profitplus-erp-mock`.

- [ ] **Step 3: Verify data was inserted (optional validation)**

```bash
# Use sqlcmd or mssql-cli if available, or skip if not installed locally
docker exec profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'YourStr0ngP@ssw0rd' -d ProfitPlus -Q "SELECT COUNT(*) FROM dbo.ventas; SELECT COUNT(*) FROM dbo.compras;"
```

Expected: Both tables show 5 rows each. If no tools available, proceed to Task 5 to test via app.

---

### Task 5: Start Development Server and Test Report Pages

**Files:**
- (None modified)

**Interfaces:**
- Consumes: Running Docker MSSQL, Report configs from Tasks 1-2, API routes, report-page component
- Produces: Working report pages with date pickers, column managers, preview tables, and export buttons

**Steps:**

- [ ] **Step 1: Start dev server**

```bash
bun dev
```

Expected: Server starts on `http://localhost:3000`. Watch for any TypeScript errors from updated report configs.

- [ ] **Step 2: Open browser and navigate to login**

Open `http://localhost:3000` in browser. You should land on `/login` (or see login form if already authenticated).

- [ ] **Step 3: Log in with admin credentials**

Use credentials from `.env.local` or seed output. If you haven't run `bun run seed`, do so now in a separate terminal:

```bash
bun run seed
```

Follow prompts to create admin user (e.g., email: `admin@test.com`, password: `Test1234!`).

- [ ] **Step 4: Navigate to Libro de Ventas**

After login, click "Libro de Ventas" in sidebar. You should see:
- Date range picker (pre-populated with previous month)
- Column manager (checkbox list)
- Preview table with 5 ventas rows
- Export button

Check that columns match: Fecha, Número Comprobante, Tipo Comprobante, RUC Cliente, Nombre Cliente, Monto Neto, Monto Impuesto, Monto Total (visible by default), plus Descripción, ID, Creado (hidden).

- [ ] **Step 5: Test date range filtering**

Change start date to 25 days ago. Expect preview to show all 5 rows. Change start date to 2 days ago. Expect 1-2 rows (only recent entries). Verify rows update in real-time.

- [ ] **Step 6: Test column visibility toggle**

In column manager, uncheck "Número Comprobante". Verify it disappears from preview table and column order. Check it again, verify it reappears.

- [ ] **Step 7: Export to CSV**

Click "Exportar CSV". Browser should download file `ventas_YYYY-MM-DD_YYYY-MM-DD.csv`. Open file in text editor or Excel. Verify:
  - First line contains BOM (`﻿`) for Excel auto-detection
  - Header row: `Fecha,Número Comprobante,Tipo Comprobante,RUC Cliente,Nombre Cliente,Monto Neto,Monto Impuesto,Monto Total`
  - 5 data rows with correct values
  - Data matches preview table

- [ ] **Step 8: Navigate to Libro de Compras**

Click "Libro de Compras" in sidebar. Verify same structure as Ventas but with Proveedor columns instead of Cliente:
- Fecha, Número Comprobante, Tipo Comprobante, RUC Proveedor, Nombre Proveedor, Monto Neto, Monto Impuesto, Monto Total (visible), Descripción, ID, Creado (hidden)

- [ ] **Step 9: Repeat tests for Compras**

Date filtering, column toggling, export. Verify CSV has 5 compras rows with correct schema.

- [ ] **Step 10: Test edge case — empty date range**

Set start date to 90 days ago. Expect 0 rows (test data is within 30 days). Verify no errors, just empty preview.

---

### Task 6: Review and Commit Final State

**Files:**
- (All changes from Tasks 1-3)

**Interfaces:**
- Consumes: Working report pages, export CSVs, test data
- Produces: Clean git history with three focused commits

**Steps:**

- [ ] **Step 1: Verify all commits are in place**

```bash
git log --oneline | head -10
```

Expected:
```
<new commit hash> feat: Update compras report to use stored procedure...
<new commit hash> feat: Update ventas report to use stored procedure...
<new commit hash> test: Add seed data for ventas and compras tables
```

- [ ] **Step 2: Run type check to ensure no TypeScript errors**

```bash
bun run build
```

Expected: Build completes without errors. If errors, review config updates in Tasks 1-2 for mismatched column keys.

- [ ] **Step 3: Verify env vars are set**

Confirm `.env.local` has:
- `DB_SERVER` pointing to localhost or docker host
- `DB_DATABASE=ProfitPlus`
- `DB_USER=sa`
- `DB_PASSWORD=YourStr0ngP@ssw0rd` (or matching docker-compose.yml)
- `JWT_SECRET` set (should already exist)

- [ ] **Step 4: Document completion**

Manual sign-off: Report pages show data, filters work, exports produce valid CSVs matching schema. End-to-end flow complete.
