# Profit Plus 2k12 — Business Workflows

## 1. Flujo de Venta (Factura → Cobro → Retenciones)

```
saFacturaVenta (encabezado)
  └── saFacturaVentaReng (líneas)
        ↓ genera
saDocumentoVenta (co_tipo_doc='FACT') ← saldo pendiente
        ↓ cancela
saCobro (recibo de cobro)
  └── saCobroDocReng (facturas que cancela)
        ├── monto_retencion_iva → saCobroRetenIvaReng (retención IVA SENIAT)
        └── monto_retencion     → saCobroRentenReng  (retención ISLR)
```

**Reglas críticas:**
- `saFacturaVenta.anulado = 0` SIEMPRE en reportes
- `saDocumentoVenta.saldo` es la fuente de verdad de CXC (nunca recalcular desde cobros)
- Notas de Crédito en `saDocumentoVenta` con `co_tipo_doc IN ('N/CR','NCR')`: `saldo > 0` = crédito sin aplicar
- La tasa de conversión USD está en el documento, NO es la tasa actual: `monto / NULLIF(tasa, 0)`

## 2. Flujo de Compra (Factura → Pago → Retenciones)

```
saFacturaCompra (encabezado)
  └── saFacturaCompraReng (líneas, actualiza inventario)
        ↓ genera
saDocumentoCompra (co_tipo_doc='FACT') ← saldo pendiente
        ↓ cancela
saPago (orden de pago)
  └── saPagoDocReng (facturas que cancela)
        ├── monto_retencion_iva → saPagoRetenIvaReng (retención IVA practicada)
        └── monto_retencion     → saPagoRentenReng   (retención ISLR practicada)
```

## 3. Multimoneda

Profit Plus soporta múltiples monedas. El esquema multimoneda funciona así:

| Campo | Tabla | Significado |
|---|---|---|
| `co_mone` | Documentos | Moneda del documento |
| `tasa` | Documentos | Bs por unidad de divisa **al momento de emisión** |
| `tasa_c` / `tasa_v` | `saTasa` | Historial de tasas (compra/venta) |
| `cambio` | `saMoneda` | Tasa base actual (no usar para histórico) |

**Fórmula de conversión histórica**: `monto_bs / NULLIF(tasa_documento, 0) = monto_usd`

## 4. Retenciones IVA (Contribuyentes Especiales SENIAT)

Solo cuando `saCliente.contrib = 1` (cliente contribuyente especial) o `saProveedor.rete_regis_doc = 1`:

**En cobros (IVA que nos retienen):**
- `saCobroDocReng.monto_retencion_iva` — monto retenido por el cliente
- `saCobroRetenIvaReng` — detalle legal por factura afectada (formato declaración SENIAT)

**En pagos (IVA que retenemos a proveedores):**
- `saPagoDocReng.monto_retencion_iva` — monto que retenemos al proveedor
- `saPagoRetenIvaReng` — detalle legal por factura del proveedor

Porcentaje típico: 75% del IVA de la factura. Para contribuyentes 100%: `alicuota × base_imponible`.

## 5. Retenciones ISLR

Aplica cuando el artículo/servicio tiene `saArticulo.co_reten` asignado:

- `saCobroRentenReng` — ISLR retenido por clientes al cobrar (servicios prestados)
- `saPagoRentenReng` — ISLR que retenemos a proveedores al pagar (servicios recibidos)
- Conceptos en `saConISLR` (numerales del Decreto de Retenciones)
- Porcentajes en `saTabuladorIslr` → `saTabuladorIslrReng` por tipo de persona (natural/jurídica)

## 6. Inventario

```
saAjuste / saFacturaCompraReng  →  actualiza  →  saStockAlmacen (stock en tiempo real)
saFacturaVentaReng              →  reduce     →  saStockAlmacen
saTraslado                      →  mueve      →  saStockAlmacen (entre almacenes)
```

**Artículos con serial**: `saArticulo.maneja_serial = 1` → cada entrada/salida registra en `saSeriales`
**Artículos con lote**: `saArticulo.maneja_lote = 1` → `saLoteEntrada` / `saLoteSalida`

## 7. Auditoría de Estados

Todos los documentos de Profit Plus son **inmutables**: no se borran, solo se anulan (`anulado = 1`). El trigger `TrigEstado_*` registra cada cambio de estado en `saHistoricoEstado`.

**Regla universal**: Siempre filtrar `WHERE anulado = 0` en consultas de reportes.

## 8. Punto de Venta (tablas `pv*`)

Las tablas con prefijo `pv` son extensiones del módulo Punto de Venta. Se sincronizan con las tablas `sa` principales:

- `pvFacturaVentaExt` → replica en `saFacturaVenta`
- `pvCobroExt` → replica en `saCobro`
- `pvMovimientoCajaExt` → replica en `saMovimientoCaja`

Las tablas `pv` son temporales/locales del terminal POS; las `sa` son el registro maestro.
