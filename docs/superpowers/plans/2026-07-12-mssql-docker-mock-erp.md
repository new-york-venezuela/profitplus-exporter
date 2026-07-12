# MSSQL Docker Mock ERP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a lightweight MSSQL container that simulates the ProfitPlus ERP with `compras` and `ventas` tables, stored procedures for date-range queries, and sample test queries to validate the integration flow.

**Architecture:** Docker Compose orchestrates a single MSSQL 2019 container with initialization scripts that create schema, populate sample data (facturas and notas de crédito as separate rows), and define two stored procedures matching the ERP's query interface. Test queries file provides coverage of date ranges, edge cases, and N/CR-to-FACT matching scenarios.

**Tech Stack:** Docker, MSSQL 2019, T-SQL, docker-compose

## Global Constraints

- MSSQL 2019 (lightweight Developer Edition)
- Spanish collation: `Modern_Spanish_CI_AS`
- Stored procedures accept `@startDate` and `endDate` parameters
- Separate rows for facturas and notas de crédito (no pre-joining)
- Sample data must be realistic (dates, invoice numbers, RUCs, amounts)
- All initialization scripts idempotent (safe to re-run)

---

## File Structure

```
docker/
  mssql/
    init.sql                    — CREATE TABLE + STORED PROCEDURE definitions
    data.sql                    — INSERT sample data (facturas, N/CR)
  docker-compose.yml            — MSSQL service definition
tests/
  mssql/
    test-queries.sql           — ~15 test scenarios (date ranges, edge cases, N/CR matching)
.env.example                    — Add DB_* vars for docker MSSQL (updated)
```

---

## Task 1: Create docker-compose.yml

**Files:**
- Create: `docker/docker-compose.yml`

**Interfaces:**
- Produces: MSSQL service on port 1433 with SA password, mounted init volume

**Steps:**

- [ ] **Step 1: Create docker directory**

```bash
mkdir -p /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/mssql
```

- [ ] **Step 2: Write docker-compose.yml**

```yaml
version: '3.8'

services:
  mssql:
    image: mcr.microsoft.com/mssql/server:2019-latest
    container_name: profitplus-erp-mock
    environment:
      SA_PASSWORD: "YourStr0ngP@ssw0rd"
      ACCEPT_EULA: "Y"
      MSSQL_COLLATION: "Modern_Spanish_CI_AS"
    ports:
      - "1433:1433"
    volumes:
      - ./mssql/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./mssql/data.sql:/docker-entrypoint-initdb.d/02-data.sql
      - mssql-data:/var/opt/mssql
    networks:
      - profitplus-network
    healthcheck:
      test: [CMD, "/opt/mssql-tools/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-P", "YourStr0ngP@ssw0rd", "-Q", "SELECT 1"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mssql-data:

networks:
  profitplus-network:
    driver: bridge
```

Save as `/Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/docker-compose.yml`

- [ ] **Step 3: Verify file exists**

```bash
ls -la /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/docker-compose.yml
```

Expected: File exists, ~60 lines

- [ ] **Step 4: Commit**

```bash
git add docker/docker-compose.yml
git commit -m "chore: add docker-compose for MSSQL mock ERP container"
```

---

## Task 2: Create MSSQL Schema & Stored Procedures

**Files:**
- Create: `docker/mssql/init.sql`

**Interfaces:**
- Produces: `compras` table, `ventas` table, `sp_GetComprasByDateRange`, `sp_GetVentasByDateRange` procedures

**Steps:**

- [ ] **Step 1: Write init.sql with schema**

```sql
-- Create ProfitPlus database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ProfitPlus')
BEGIN
    CREATE DATABASE ProfitPlus COLLATE Modern_Spanish_CI_AS;
END
GO

USE ProfitPlus;
GO

-- Drop existing tables if they exist (idempotent)
IF OBJECT_ID('dbo.compras', 'U') IS NOT NULL DROP TABLE dbo.compras;
IF OBJECT_ID('dbo.ventas', 'U') IS NOT NULL DROP TABLE dbo.ventas;
GO

-- Tabla: COMPRAS (Purchases / Libro de Compras)
CREATE TABLE dbo.compras (
    id INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATE NOT NULL,
    numero_comprobante NVARCHAR(50) NOT NULL,
    tipo_comprobante NVARCHAR(20) NOT NULL,  -- FACTURA, NOTA DE CREDITO, etc.
    ruc_proveedor NVARCHAR(20) NOT NULL,
    nombre_proveedor NVARCHAR(255) NOT NULL,
    monto_total DECIMAL(18, 2) NOT NULL,
    monto_impuesto DECIMAL(18, 2) NOT NULL,
    monto_neto DECIMAL(18, 2) NOT NULL,
    descripcion NVARCHAR(500),
    created_at DATETIME DEFAULT GETDATE()
);

-- Tabla: VENTAS (Sales / Libro de Ventas)
CREATE TABLE dbo.ventas (
    id INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATE NOT NULL,
    numero_comprobante NVARCHAR(50) NOT NULL,
    tipo_comprobante NVARCHAR(20) NOT NULL,  -- FACTURA, NOTA DE CREDITO, etc.
    ruc_cliente NVARCHAR(20) NOT NULL,
    nombre_cliente NVARCHAR(255) NOT NULL,
    monto_total DECIMAL(18, 2) NOT NULL,
    monto_impuesto DECIMAL(18, 2) NOT NULL,
    monto_neto DECIMAL(18, 2) NOT NULL,
    descripcion NVARCHAR(500),
    created_at DATETIME DEFAULT GETDATE()
);

-- Create indexes for faster date range queries
CREATE INDEX idx_compras_fecha ON dbo.compras(fecha);
CREATE INDEX idx_ventas_fecha ON dbo.ventas(fecha);
GO

-- Stored Procedure: Get Compras by Date Range
IF OBJECT_ID('dbo.sp_GetComprasByDateRange', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetComprasByDateRange;
GO

CREATE PROCEDURE dbo.sp_GetComprasByDateRange
    @startDate DATE,
    @endDate DATE
AS
BEGIN
    SELECT
        id,
        fecha,
        numero_comprobante,
        tipo_comprobante,
        ruc_proveedor,
        nombre_proveedor,
        monto_total,
        monto_impuesto,
        monto_neto,
        descripcion
    FROM dbo.compras
    WHERE fecha BETWEEN @startDate AND @endDate
    ORDER BY fecha DESC, numero_comprobante;
END
GO

-- Stored Procedure: Get Ventas by Date Range
IF OBJECT_ID('dbo.sp_GetVentasByDateRange', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetVentasByDateRange;
GO

CREATE PROCEDURE dbo.sp_GetVentasByDateRange
    @startDate DATE,
    @endDate DATE
AS
BEGIN
    SELECT
        id,
        fecha,
        numero_comprobante,
        tipo_comprobante,
        ruc_cliente,
        nombre_cliente,
        monto_total,
        monto_impuesto,
        monto_neto,
        descripcion
    FROM dbo.ventas
    WHERE fecha BETWEEN @startDate AND @endDate
    ORDER BY fecha DESC, numero_comprobante;
END
GO
```

Save as `/Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/mssql/init.sql`

- [ ] **Step 2: Verify file created**

```bash
ls -la /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/mssql/init.sql
```

Expected: File exists, ~110 lines

- [ ] **Step 3: Commit**

```bash
git add docker/mssql/init.sql
git commit -m "feat: create MSSQL schema for compras and ventas with stored procedures"
```

---

## Task 3: Create Sample Data

**Files:**
- Create: `docker/mssql/data.sql`

**Interfaces:**
- Consumes: Tables from Task 2 (`compras`, `ventas`)
- Produces: 40+ sample records per table (mix of facturas and notas de crédito)

**Steps:**

- [ ] **Step 1: Write data.sql with sample inserts**

```sql
USE ProfitPlus;
GO

-- ========== SAMPLE DATA: COMPRAS (PURCHASES) ==========

-- Facturas (July 2026)
INSERT INTO dbo.compras (fecha, numero_comprobante, tipo_comprobante, ruc_proveedor, nombre_proveedor, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
    ('2026-07-01', 'F-001-0001', 'FACTURA', '1234567890001', 'Proveedor ABC S.A.', 10500.00, 1500.00, 9000.00, 'Compra de materiales'),
    ('2026-07-02', 'F-001-0002', 'FACTURA', '1234567890002', 'Distribuidora XYZ', 8250.00, 1250.00, 7000.00, 'Insumos de producción'),
    ('2026-07-03', 'F-001-0003', 'FACTURA', '1234567890001', 'Proveedor ABC S.A.', 5250.00, 750.00, 4500.00, 'Material adicional'),
    ('2026-07-05', 'F-001-0004', 'FACTURA', '1234567890003', 'Logística Global Ltd', 15750.00, 2250.00, 13500.00, 'Servicios de transporte'),
    ('2026-07-07', 'F-001-0005', 'FACTURA', '1234567890002', 'Distribuidora XYZ', 7875.00, 1125.00, 6750.00, 'Componentes electrónicos'),
    ('2026-07-10', 'F-001-0006', 'FACTURA', '1234567890004', 'Tech Solutions Co.', 21000.00, 3000.00, 18000.00, 'Software y licencias'),
    ('2026-07-12', 'F-001-0007', 'FACTURA', '1234567890001', 'Proveedor ABC S.A.', 3150.00, 450.00, 2700.00, 'Repuestos varios'),
    ('2026-07-15', 'F-001-0008', 'FACTURA', '1234567890005', 'Energía Norte S.A.', 6300.00, 900.00, 5400.00, 'Suministro de energía'),
    ('2026-07-18', 'F-001-0009', 'FACTURA', '1234567890002', 'Distribuidora XYZ', 9450.00, 1350.00, 8100.00, 'Materias primas'),
    ('2026-07-20', 'F-001-0010', 'FACTURA', '1234567890003', 'Logística Global Ltd', 12600.00, 1800.00, 10800.00, 'Consultoría y asesoría');

-- Notas de Crédito (matching facturas - separate rows)
INSERT INTO dbo.compras (fecha, numero_comprobante, tipo_comprobante, ruc_proveedor, nombre_proveedor, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
    ('2026-07-04', 'NC-001-0001', 'NOTA DE CREDITO', '1234567890001', 'Proveedor ABC S.A.', -1050.00, -150.00, -900.00, 'Devolución parcial de F-001-0001'),
    ('2026-07-08', 'NC-001-0002', 'NOTA DE CREDITO', '1234567890002', 'Distribuidora XYZ', -825.00, -125.00, -700.00, 'Ajuste por error en factura F-001-0002'),
    ('2026-07-22', 'NC-001-0003', 'NOTA DE CREDITO', '1234567890003', 'Logística Global Ltd', -1575.00, -225.00, -1350.00, 'Descuento por volumen en F-001-0004'),
    ('2026-07-25', 'NC-001-0004', 'NOTA DE CREDITO', '1234567890004', 'Tech Solutions Co.', -2100.00, -300.00, -1800.00, 'Devolución parcial de licencias F-001-0006');

-- Additional facturas (June 2026 for date range testing)
INSERT INTO dbo.compras (fecha, numero_comprobante, tipo_comprobante, ruc_proveedor, nombre_proveedor, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
    ('2026-06-28', 'F-001-9998', 'FACTURA', '1234567890001', 'Proveedor ABC S.A.', 4200.00, 600.00, 3600.00, 'Compra de materiales junio'),
    ('2026-06-30', 'F-001-9999', 'FACTURA', '1234567890002', 'Distribuidora XYZ', 5250.00, 750.00, 4500.00, 'Insumos junio');

-- ========== SAMPLE DATA: VENTAS (SALES) ==========

-- Facturas (July 2026)
INSERT INTO dbo.ventas (fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
    ('2026-07-01', 'V-001-0001', 'FACTURA', '2345678901001', 'Cliente Retail Corp', 15750.00, 2250.00, 13500.00, 'Venta de productos'),
    ('2026-07-02', 'V-001-0002', 'FACTURA', '2345678901002', 'Comercial Estratégica', 12600.00, 1800.00, 10800.00, 'Servicio consultoría'),
    ('2026-07-04', 'V-001-0003', 'FACTURA', '2345678901003', 'Industria Moderna Ltda', 21000.00, 3000.00, 18000.00, 'Equipamiento industrial'),
    ('2026-07-06', 'V-001-0004', 'FACTURA', '2345678901001', 'Cliente Retail Corp', 8400.00, 1200.00, 7200.00, 'Reorden de productos'),
    ('2026-07-08', 'V-001-0005', 'FACTURA', '2345678901004', 'Exportadora del Sur', 31500.00, 4500.00, 27000.00, 'Exportación de bienes'),
    ('2026-07-10', 'V-001-0006', 'FACTURA', '2345678901002', 'Comercial Estratégica', 9450.00, 1350.00, 8100.00, 'Servicios adicionales'),
    ('2026-07-12', 'V-001-0007', 'FACTURA', '2345678901005', 'Negocio Nuevo S.A.', 10500.00, 1500.00, 9000.00, 'Venta inicial cliente'),
    ('2026-07-15', 'V-001-0008', 'FACTURA', '2345678901003', 'Industria Moderna Ltda', 6300.00, 900.00, 5400.00, 'Repuestos'),
    ('2026-07-18', 'V-001-0009', 'FACTURA', '2345678901001', 'Cliente Retail Corp', 18900.00, 2700.00, 16200.00, 'Compra importante'),
    ('2026-07-20', 'V-001-0010', 'FACTURA', '2345678901004', 'Exportadora del Sur', 25200.00, 3600.00, 21600.00, 'Segunda exportación');

-- Notas de Crédito (matching facturas - separate rows)
INSERT INTO dbo.ventas (fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
    ('2026-07-05', 'NC-001-0001', 'NOTA DE CREDITO', '2345678901001', 'Cliente Retail Corp', -1575.00, -225.00, -1350.00, 'Devolución parcial de V-001-0001'),
    ('2026-07-09', 'NC-001-0002', 'NOTA DE CREDITO', '2345678901002', 'Comercial Estratégica', -2100.00, -300.00, -1800.00, 'Descuento especial V-001-0002'),
    ('2026-07-11', 'NC-001-0003', 'NOTA DE CREDITO', '2345678901003', 'Industria Moderna Ltda', -3150.00, -450.00, -2700.00, 'Ajuste por defecto V-001-0003'),
    ('2026-07-21', 'NC-001-0004', 'NOTA DE CREDITO', '2345678901004', 'Exportadora del Sur', -2520.00, -360.00, -2160.00, 'Rebaja por volumen V-001-0005'),
    ('2026-07-23', 'NC-001-0005', 'NOTA DE CREDITO', '2345678901005', 'Negocio Nuevo S.A.', -1050.00, -150.00, -900.00, 'Devolución inicial V-001-0007');

-- Additional facturas (June 2026 for date range testing)
INSERT INTO dbo.ventas (fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion)
VALUES
    ('2026-06-28', 'V-001-9998', 'FACTURA', '2345678901001', 'Cliente Retail Corp', 7000.00, 1000.00, 6000.00, 'Venta junio'),
    ('2026-06-30', 'V-001-9999', 'FACTURA', '2345678901002', 'Comercial Estratégica', 5600.00, 800.00, 4800.00, 'Venta junio');

GO
```

Save as `/Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/mssql/data.sql`

- [ ] **Step 2: Verify file created**

```bash
ls -la /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/mssql/data.sql
```

Expected: File exists, ~90 lines

- [ ] **Step 3: Commit**

```bash
git add docker/mssql/data.sql
git commit -m "feat: add sample data for compras and ventas with N/CR-FACT pairs"
```

---

## Task 4: Create Test Queries File

**Files:**
- Create: `tests/mssql/test-queries.sql`

**Interfaces:**
- Consumes: Stored procedures from Task 2, sample data from Task 3
- Produces: ~15 test scenarios covering date ranges, edge cases, N/CR matching

**Steps:**

- [ ] **Step 1: Create tests directory**

```bash
mkdir -p /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/tests/mssql
```

- [ ] **Step 2: Write test-queries.sql**

```sql
-- ========================================
-- TEST QUERIES FOR MSSQL MOCK ERP
-- ========================================
-- Use these to validate the ERP integration flow
-- Run via: sqlcmd -S localhost,1433 -U sa -P YourStr0ngP@ssw0rd -d ProfitPlus -i tests/mssql/test-queries.sql

USE ProfitPlus;
GO

PRINT '========== COMPRAS TESTS ==========';
GO

-- TEST 1: Full July 2026
PRINT 'TEST 1: All compras for July 2026';
EXEC sp_GetComprasByDateRange @startDate='2026-07-01', @endDate='2026-07-31';
GO

-- TEST 2: Week of July 1-7
PRINT 'TEST 2: Compras for week Jul 1-7 (should include 1 factura + 1 N/CR)';
EXEC sp_GetComprasByDateRange @startDate='2026-07-01', @endDate='2026-07-07';
GO

-- TEST 3: Single day (July 5 - no results expected)
PRINT 'TEST 3: Single day Jul 5 (no results)';
EXEC sp_GetComprasByDateRange @startDate='2026-07-05', @endDate='2026-07-05';
GO

-- TEST 4: Cross-month range (Jun 28 - Jul 10)
PRINT 'TEST 4: Cross-month Jun 28 - Jul 10 (includes June facturas)';
EXEC sp_GetComprasByDateRange @startDate='2026-06-28', @endDate='2026-07-10';
GO

-- TEST 5: Only June data
PRINT 'TEST 5: June only (2 facturas)';
EXEC sp_GetComprasByDateRange @startDate='2026-06-01', @endDate='2026-06-30';
GO

-- TEST 6: Empty result (future date)
PRINT 'TEST 6: Future date range (no results)';
EXEC sp_GetComprasByDateRange @startDate='2026-08-01', @endDate='2026-08-31';
GO

-- TEST 7: Verify N/CR rows are separate (manually locate N/CR entries)
PRINT 'TEST 7: Identify N/CR matching to facturas for manual verification';
SELECT 'FACT' AS [Type], numero_comprobante, fecha, ruc_proveedor, monto_total 
FROM dbo.compras 
WHERE tipo_comprobante = 'FACTURA' 
  AND fecha BETWEEN '2026-07-01' AND '2026-07-31'
UNION ALL
SELECT 'N/CR', numero_comprobante, fecha, ruc_proveedor, monto_total 
FROM dbo.compras 
WHERE tipo_comprobante = 'NOTA DE CREDITO' 
  AND fecha BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY ruc_proveedor, fecha;
GO

PRINT '';
PRINT '========== VENTAS TESTS ==========';
GO

-- TEST 8: Full July 2026
PRINT 'TEST 8: All ventas for July 2026';
EXEC sp_GetVentasByDateRange @startDate='2026-07-01', @endDate='2026-07-31';
GO

-- TEST 9: Week of July 1-7
PRINT 'TEST 9: Ventas for week Jul 1-7 (should include facturas + 1 N/CR)';
EXEC sp_GetVentasByDateRange @startDate='2026-07-01', @endDate='2026-07-07';
GO

-- TEST 10: Single day (July 2)
PRINT 'TEST 10: Single day Jul 2 (1 factura)';
EXEC sp_GetVentasByDateRange @startDate='2026-07-02', @endDate='2026-07-02';
GO

-- TEST 11: Cross-month range (Jun 28 - Jul 10)
PRINT 'TEST 11: Cross-month Jun 28 - Jul 10 (includes June facturas)';
EXEC sp_GetVentasByDateRange @startDate='2026-06-28', @endDate='2026-07-10';
GO

-- TEST 12: Only June data
PRINT 'TEST 12: June only (2 facturas)';
EXEC sp_GetVentasByDateRange @startDate='2026-06-01', @endDate='2026-06-30';
GO

-- TEST 13: Empty result (past date)
PRINT 'TEST 13: Past date range (no results)';
EXEC sp_GetVentasByDateRange @startDate='2026-01-01', @endDate='2026-02-28';
GO

-- TEST 14: Verify N/CR rows are separate (manually locate N/CR entries for matching)
PRINT 'TEST 14: Identify N/CR matching to facturas for manual verification';
SELECT 'FACT' AS [Type], numero_comprobante, fecha, ruc_cliente, monto_total 
FROM dbo.ventas 
WHERE tipo_comprobante = 'FACTURA' 
  AND fecha BETWEEN '2026-07-01' AND '2026-07-31'
UNION ALL
SELECT 'N/CR', numero_comprobante, fecha, ruc_cliente, monto_total 
FROM dbo.ventas 
WHERE tipo_comprobante = 'NOTA DE CREDITO' 
  AND fecha BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY ruc_cliente, fecha;
GO

-- TEST 15: Count totals by type (verification)
PRINT '';
PRINT 'TEST 15: Summary counts by type (compras)';
SELECT tipo_comprobante, COUNT(*) AS [Count], SUM(monto_total) AS [Total Monto]
FROM dbo.compras
GROUP BY tipo_comprobante;
GO

PRINT 'TEST 16: Summary counts by type (ventas)';
SELECT tipo_comprobante, COUNT(*) AS [Count], SUM(monto_total) AS [Total Monto]
FROM dbo.ventas
GROUP BY tipo_comprobante;
GO

PRINT '';
PRINT '========== ALL TESTS COMPLETE ==========';
GO
```

Save as `/Users/eugenio/repos/new-york-venezuela/profitplus-exporter/tests/mssql/test-queries.sql`

- [ ] **Step 3: Verify file created**

```bash
ls -la /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/tests/mssql/test-queries.sql
```

Expected: File exists, ~100+ lines

- [ ] **Step 4: Commit**

```bash
git add tests/mssql/test-queries.sql
git commit -m "test: add comprehensive test queries for compras/ventas stored procedures"
```

---

## Task 5: Update .env.example with MSSQL Docker Credentials

**Files:**
- Modify: `.env.example`

**Interfaces:**
- Consumes: docker-compose MSSQL service config (host=localhost, port=1433)
- Produces: DB_* variables documented for docker MSSQL

**Steps:**

- [ ] **Step 1: Read current .env.example**

```bash
cat /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/.env.example
```

- [ ] **Step 2: Append MSSQL Docker config to .env.example**

Open `.env.example` and add these lines at the end:

```env
# ============================================
# MSSQL Docker Mock ERP (for local development)
# Run: docker-compose -f docker/docker-compose.yml up -d
# ============================================
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourStr0ngP@ssw0rd
DB_NAME=ProfitPlus
```

- [ ] **Step 3: Verify changes**

```bash
tail -n 10 /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/.env.example
```

Expected: New DB_* variables visible

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: add MSSQL docker connection variables to .env.example"
```

---

## Task 6: Create README for Docker Setup

**Files:**
- Create: `docker/README.md`

**Interfaces:**
- Consumes: docker-compose.yml, init.sql, data.sql, test-queries.sql
- Produces: Quick-start guide for developer

**Steps:**

- [ ] **Step 1: Write docker/README.md**

```markdown
# MSSQL Mock ERP Setup

This directory contains Docker configuration for a lightweight MSSQL 2019 container that simulates the ProfitPlus ERP.

## Quick Start

### 1. Start the Container

```bash
cd docker
docker-compose up -d
```

The container will:
- Initialize the `ProfitPlus` database
- Create `compras` and `ventas` tables
- Define `sp_GetComprasByDateRange` and `sp_GetVentasByDateRange` stored procedures
- Populate sample data (facturas and notas de crédito as separate rows)

Expected output: `profitplus-erp-mock` container running on `localhost:1433`

### 2. Verify Container is Ready

```bash
docker-compose logs -f mssql
```

Wait for message: `SQL Server 2019 (RTM-CU*) - 15.0.* on Linux`

Or run a quick health check:

```bash
docker-compose ps
```

Status should show `healthy` after ~30 seconds.

### 3. Run Test Queries

Connect using your SQL IDE (e.g., DBeaver, Azure Data Studio, SSMS) or use `sqlcmd`:

```bash
# Install sqlcmd if needed (macOS):
# brew install sqlcmd

sqlcmd -S localhost,1433 -U sa -P YourStr0ngP@ssw0rd -d ProfitPlus -i ../tests/mssql/test-queries.sql
```

## Connection Details

| Property        | Value                      |
|-----------------|----------------------------|
| **Host**        | `localhost`                |
| **Port**        | `1433`                     |
| **User**        | `sa`                       |
| **Password**    | `YourStr0ngP@ssw0rd`       |
| **Database**    | `ProfitPlus`               |
| **Collation**   | `Modern_Spanish_CI_AS`     |

## Schema Overview

### Tables

- **`compras`** — Purchases (Libro de Compras)
  - Columns: fecha, numero_comprobante, tipo_comprobante, ruc_proveedor, nombre_proveedor, monto_total, monto_impuesto, monto_neto, descripcion
  - Sample data: 10 facturas + 4 notas de crédito

- **`ventas`** — Sales (Libro de Ventas)
  - Columns: fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion
  - Sample data: 10 facturas + 5 notas de crédito

### Stored Procedures

- **`sp_GetComprasByDateRange`**
  ```sql
  EXEC sp_GetComprasByDateRange @startDate='2026-07-01', @endDate='2026-07-31'
  ```
  Returns all compras (facturas and N/CR as separate rows) within date range.

- **`sp_GetVentasByDateRange`**
  ```sql
  EXEC sp_GetVentasByDateRange @startDate='2026-07-01', @endDate='2026-07-31'
  ```
  Returns all ventas (facturas and N/CR as separate rows) within date range.

## Important Notes

1. **Separate Rows for N/CR:** Notas de crédito are returned as separate rows (not pre-joined to their matching facturas). Your integration code must handle the matching logic.

2. **Date Ranges:** The sample data includes:
   - June 2026: 2 facturas per table (for testing cross-month queries)
   - July 2026: 10 facturas + multiple N/CR per table

3. **Spanish Collation:** All text comparisons are case-insensitive and accent-aware (Modern_Spanish_CI_AS).

## Development Workflow

1. Start container: `docker-compose up -d`
2. Develop ERP integration code
3. Test against mock SPs using test queries
4. Once ready: update `DB_*` variables in `.env.local` to point to real ProfitPlus server
5. Stop container: `docker-compose down`

## Troubleshooting

**Container won't start:**
```bash
docker-compose logs mssql
```
Check for SA password issues or port conflicts (1433).

**Can't connect:**
- Ensure container is running: `docker ps`
- Wait 30+ seconds for MSSQL to initialize
- Verify credentials match `docker-compose.yml`

**Need to reset data:**
```bash
docker-compose down
docker volume rm docker_mssql-data
docker-compose up -d
```

---

**Next Step:** Update your app's `DB_*` environment variables in `.env.local` to match docker connection details, then test the integration.
```

Save as `/Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/README.md`

- [ ] **Step 2: Verify file created**

```bash
ls -la /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/README.md
wc -l /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/README.md
```

Expected: File exists, ~150+ lines

- [ ] **Step 3: Commit**

```bash
git add docker/README.md
git commit -m "docs: add Docker MSSQL setup guide and troubleshooting"
```

---

## Task 7: Verify All Files and Test Container Startup

**Files:**
- All files from Tasks 1-6

**Steps:**

- [ ] **Step 1: Verify directory structure**

```bash
tree -L 3 /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker/
```

Expected output:
```
docker/
├── README.md
├── docker-compose.yml
└── mssql/
    ├── data.sql
    └── init.sql
```

- [ ] **Step 2: Verify test queries file**

```bash
ls -la /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/tests/mssql/test-queries.sql
```

Expected: File exists

- [ ] **Step 3: Start container (dry run)**

```bash
cd /Users/eugenio/repos/new-york-venezuela/profitplus-exporter/docker
docker-compose config | head -30
```

Expected: Valid YAML output (no errors)

- [ ] **Step 4: Check git status**

```bash
cd /Users/eugenio/repos/new-york-venezuela/profitplus-exporter
git status
```

Expected: All docker/* and tests/mssql/* files staged/committed, `.env.example` updated

- [ ] **Step 5: Commit summary**

```bash
git log --oneline -7
```

Expected: 6 new commits (one per task)

---

## Next Steps

1. **Start the container:** 
   ```bash
   cd docker
   docker-compose up -d
   ```

2. **Update `.env.local`** with the MSSQL docker credentials from `.env.example`

3. **Test the connection** using test queries:
   ```bash
   sqlcmd -S localhost,1433 -U sa -P YourStr0ngP@ssw0rd -d ProfitPlus -i ../tests/mssql/test-queries.sql
   ```

4. **Next phase:** Integrate the app's `lib/db/mssql.ts` pool to connect to the docker container for ERP data retrieval
