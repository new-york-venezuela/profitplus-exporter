# Patrón: TrigEstado_* (Audit Trail de Estados)

## Tablas afectadas
`saFacturaVenta`, `saDocumentoVenta`, `saDocumentoCompra`, `saFacturaCompra`, `saPago`, `saAjuste`, `saArtCompuestoGen`, y otras.

## Lógica de Negocio
Todos los triggers `TrigEstado_*` siguen el mismo patrón (código generado por Softech):

1. **FOR INSERT, UPDATE** — se disparan en inserts y updates.
2. Comparan el campo `anulado` entre `inserted` y `deleted`.
3. Si cambió (nueva fila, o cambió de `0→1` o `1→0`), insertan un registro en `saHistoricoEstado` con:
   - `doc_orig` = GUID del documento (`rowguid`)
   - `tipo_doc` = nombre de la tabla (ej: `'saFacturaVenta'`)
   - `Estado` = valor de `anulado` como char (`'0'` o `'1'`)
   - `fecha` = `GETDATE()`

## Implicaciones para consultas
- `saHistoricoEstado` es una tabla de auditoría pura — no usarla para lógica de negocio.
- Los triggers **no actualizan saldos ni stock** — eso lo hacen los stored procedures.
- El cursor `FAST_FORWARD` es eficiente para filas individuales (el caso típico de Profit Plus que opera fila a fila desde la UI).

## Documentos con este patrón
| Trigger | Tabla | Audita |
|---|---|---|
| `TrigEstado_saFacturaVenta` | `saFacturaVenta` | Anulación de facturas de venta |
| `TrigEstado_saDocumentoVenta` | `saDocumentoVenta` | Anulación de documentos CXC |
| `TrigEstado_saDocumentoCompra` | `saDocumentoCompra` | Anulación de documentos CXP |
| `TrigEstado_saFacturaCompra` | `saFacturaCompra` | Anulación de facturas de compra |
| `TrigEstado_saPago` | `saPago` | Anulación de pagos |
| `TrigEstado_saAjuste` | `saAjuste` | Anulación de ajustes de inventario |
