# Tabla: saFacturaCompra
**Módulo**: Compras
**Descripción de Negocio**: Encabezado de facturas de compra recibidas de proveedores. Registra cada factura de proveedor ingresada al sistema. Genera movimientos de inventario (entradas) y cuentas por pagar (`saDocumentoCompra`). El campo `nro_fact` almacena el número externo del proveedor; `doc_num` es el número interno.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `doc_num` | char | NOT NULL | Número interno de la factura de compra (PK) | Clave Primaria |
| `nro_fact` | varchar | NULL | Número de factura del proveedor (externo) | — |
| `co_prov` | char | NULL | Proveedor emisor de la factura | FK Implícita → `saProveedor.co_prov` |
| `co_mone` | char | NULL | Moneda de la factura | FK Implícita → `saMoneda.co_mone` |
| `co_cond` | char | NULL | Condición de pago | FK Implícita → `saCondicionPago.co_cond` |
| `fec_emis` | smalldatetime | NULL | Fecha de emisión de la factura del proveedor | — |
| `fec_venc` | smalldatetime | NULL | Fecha de vencimiento para pago | — |
| `fec_reg` | smalldatetime | NULL | Fecha de registro en el sistema | — |
| `tasa` | decimal | NULL | Tasa de cambio al momento de ingreso | — |
| `total_bruto` | decimal | NULL | Subtotal antes de impuestos | — |
| `monto_imp` | decimal | NULL | Monto IVA | — |
| `total_neto` | decimal | NULL | Total a pagar | — |
| `saldo` | decimal | NULL | Saldo pendiente de pago | — |
| `anulado` | bit | NULL | `1` = factura anulada | — |
| `status` | char | NULL | Estado del documento | — |
| `n_control` | varchar | NULL | Número de control del proveedor | — |
| `nac` | bit | NULL | `1` = factura nacional; `0` = importación | — |
| `seriales_e` | int | NULL | Cantidad de seriales de entrada registrados | — |
| `co_cta_ingr_egr` | char | NULL | Cuenta de gastos para contabilidad | — |

## Triggers Relacionados
- `TrigEstado_saFacturaCompra`: sincroniza saldo y estado en `saDocumentoCompra`

## Recetario SQL de Negocio
```sql
-- Libro de compras del mes
SELECT
    fc.doc_num, fc.nro_fact, fc.co_prov, pr.prov_des,
    fc.fec_emis, fc.n_control,
    fc.total_bruto, fc.monto_imp, fc.total_neto,
    fc.tasa, fc.total_neto / NULLIF(fc.tasa,0) AS total_usd
FROM saFacturaCompra fc
LEFT JOIN saProveedor pr ON fc.co_prov = pr.co_prov
WHERE fc.fec_emis BETWEEN '2024-01-01' AND '2024-01-31'
  AND fc.anulado = 0
ORDER BY fc.fec_emis;

-- Compras pendientes de pago por proveedor
SELECT co_prov, SUM(saldo) AS saldo_bs,
       SUM(saldo / NULLIF(tasa,0)) AS saldo_usd
FROM saFacturaCompra
WHERE anulado = 0 AND saldo > 0
GROUP BY co_prov ORDER BY saldo_usd DESC;
```
