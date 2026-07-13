#!/bin/bash

# Start SQL Server in background
/opt/mssql/bin/sqlservr &
PID=$!

# Wait for SQL Server to be ready
echo "Waiting for SQL Server to be ready..."
for i in {1..120}; do
    if /opt/mssql/bin/sqlservr -v 2>&1 | head -1 | grep -q "SQL Server"; then
        # Give it more time to fully initialize
        sleep 5
        break
    fi
    sleep 1
done

# Create init script that will run SQL commands
cat > /tmp/init.sql << 'SQLEOF'
-- Create database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ProfitPlus')
BEGIN
    CREATE DATABASE ProfitPlus COLLATE Modern_Spanish_CI_AS;
END
GO

USE ProfitPlus;
GO

-- Create compras table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'compras' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.compras (
        id INT PRIMARY KEY IDENTITY(1,1),
        fecha DATE NOT NULL,
        numero_comprobante NVARCHAR(50) NOT NULL,
        tipo_comprobante NVARCHAR(50) NOT NULL,
        ruc_proveedor NVARCHAR(50) NOT NULL,
        nombre_proveedor NVARCHAR(255) NOT NULL,
        monto_total DECIMAL(15, 2) NOT NULL,
        monto_impuesto DECIMAL(15, 2) NOT NULL,
        monto_neto DECIMAL(15, 2) NOT NULL,
        descripcion NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

-- Create ventas table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ventas' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ventas (
        id INT PRIMARY KEY IDENTITY(1,1),
        fecha DATE NOT NULL,
        numero_comprobante NVARCHAR(50) NOT NULL,
        tipo_comprobante NVARCHAR(50) NOT NULL,
        ruc_cliente NVARCHAR(50) NOT NULL,
        nombre_cliente NVARCHAR(255) NOT NULL,
        monto_total DECIMAL(15, 2) NOT NULL,
        monto_impuesto DECIMAL(15, 2) NOT NULL,
        monto_neto DECIMAL(15, 2) NOT NULL,
        descripcion NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

-- Create indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_compras_fecha' AND object_id = OBJECT_ID('dbo.compras'))
BEGIN
    CREATE INDEX idx_compras_fecha ON dbo.compras(fecha);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_ventas_fecha' AND object_id = OBJECT_ID('dbo.ventas'))
BEGIN
    CREATE INDEX idx_ventas_fecha ON dbo.ventas(fecha);
END
GO

-- Create stored procedures
IF OBJECT_ID('dbo.sp_GetComprasByDateRange', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sp_GetComprasByDateRange;
END
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
        descripcion,
        created_at
    FROM dbo.compras
    WHERE fecha BETWEEN @startDate AND @endDate
    ORDER BY fecha DESC, numero_comprobante;
END
GO

IF OBJECT_ID('dbo.sp_GetVentasByDateRange', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sp_GetVentasByDateRange;
END
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
        descripcion,
        created_at
    FROM dbo.ventas
    WHERE fecha BETWEEN @startDate AND @endDate
    ORDER BY fecha DESC, numero_comprobante;
END
GO
SQLEOF

# Try to run init script via osql (native tool in MSSQL)
for i in {1..30}; do
    if /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -i /tmp/init.sql 2>/dev/null; then
        echo "Database initialized successfully"
        break
    fi
    sleep 1
done

# Keep SQL Server running
wait $PID
