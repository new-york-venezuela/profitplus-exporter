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
PRINT 'TEST 2: Compras for week Jul 1-7 (should include facturas + N/CR)';
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
PRINT 'TEST 9: Ventas for week Jul 1-7 (should include facturas + N/CR)';
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

-- TEST 15: Count totals by type (verification) - COMPRAS
PRINT '';
PRINT 'TEST 15: Summary counts by type (compras)';
SELECT tipo_comprobante, COUNT(*) AS [Count], SUM(monto_total) AS [Total Monto]
FROM dbo.compras
GROUP BY tipo_comprobante;
GO

-- TEST 16: Count totals by type (verification) - VENTAS
PRINT 'TEST 16: Summary counts by type (ventas)';
SELECT tipo_comprobante, COUNT(*) AS [Count], SUM(monto_total) AS [Total Monto]
FROM dbo.ventas
GROUP BY tipo_comprobante;
GO

PRINT '';
PRINT '========== ALL TESTS COMPLETE ==========';
GO
