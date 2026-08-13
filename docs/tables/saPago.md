# Tabla: saPago
**Módulo**: Tesorería / Cuentas por Pagar
**Descripción de Negocio**: Encabezado de órdenes de pago a proveedores. Espejo de `saCobro` para el lado de compras. Cada fila es un pago emitido a un proveedor. Los renglones en `saPagoDocReng` detallan qué facturas de `saDocumentoCompra` se están cancelando. Puede incluir retenciones IVA (`saPagoRetenIvaReng`) e ISLR (`saPagoRentenReng`).

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `cob_num` | char | NOT NULL | Número de la orden de pago (PK) — la columna se llama `cob_num` por convención interna | Clave Primaria |
| `recibo` | char | NULL | Número del cheque o comprobante físico emitido | — |
| `co_prov` | char | NULL | Proveedor al que se paga | FK Implícita → `saProveedor.co_prov` |
| `co_mone` | char | NULL | Moneda del pago | FK Implícita → `saMoneda.co_mone` |
| `tasa` | decimal | NULL | Tasa de cambio al momento del pago | — |
| `fecha` | smalldatetime | NULL | Fecha del pago | — |
| `monto` | decimal | NULL | Monto total pagado en Bs | — |
| `anulado` | bit | NULL | `1` = pago anulado; los saldos se restauran en `saDocumentoCompra` | — |
| `descrip` | varchar | NULL | Descripción o concepto del pago | — |

## Triggers Relacionados
- `TrigEstado_saPago`: actualiza `saldo` en `saDocumentoCompra` al registrar el pago

## Relaciones Clave
- **Facturas canceladas**: `saPagoDocReng` (JOIN por `cob_num`)
- **Retención IVA pagada**: `saPagoRetenIvaReng`
- **Retención ISLR pagada**: `saPagoRentenReng`
- **Movimiento banco**: `saMovimientoBanco` (origen = este pago)

## Recetario SQL de Negocio
```sql
-- Pagos del mes con facturas canceladas
SELECT
    p.cob_num, p.fecha, p.co_prov, pr.prov_des,
    p.monto AS monto_bs,
    p.monto / NULLIF(p.tasa,0) AS monto_usd,
    r.nro_fact, r.co_tipo_doc, r.nro_doc, r.mont_cob
FROM saPago p
INNER JOIN saPagoDocReng r ON p.cob_num = r.cob_num
LEFT JOIN  saProveedor pr  ON p.co_prov = pr.co_prov
WHERE p.fecha BETWEEN '2024-01-01' AND '2024-01-31'
  AND p.anulado = 0
ORDER BY p.fecha, p.cob_num;
```
