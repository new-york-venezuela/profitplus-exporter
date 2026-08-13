# Trigger: TrigDelete_saFacturaVenta
**Tabla**: `saFacturaVenta`
**Tipo**: INSTEAD OF DELETE

## Lógica de Negocio
Bloquea el borrado físico de facturas de venta. Ante cualquier `DELETE` sobre `saFacturaVenta`, el trigger cancela la operación con `RAISERROR` y hace `ROLLBACK`. En Profit Plus, las facturas **nunca se borran** — se anulan (`anulado = 1`). Esto garantiza integridad del libro de ventas y la auditoría fiscal.

**Implicación**: No confiar en que la tabla puede tener filas eliminadas. Todo documento existe para siempre; filtrar siempre por `anulado = 0` en reportes.
