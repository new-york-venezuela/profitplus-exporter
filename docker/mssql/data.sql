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
