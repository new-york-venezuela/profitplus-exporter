# Tabla: saFacturaVenta
**Módulo**: Ventas
**Descripción de Negocio**: Encabezado de facturas de venta. Cada fila representa un documento de venta emitido al cliente (facturas, notas de débito de venta, etc.). Es la tabla central del módulo de ventas — todos los libros de ventas, cuentas por cobrar y comisiones derivan de aquí.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `doc_num` | char | NOT NULL | Número interno del documento (PK correlativo) | Clave Primaria |
| `co_cli` | char | NULL | Código del cliente | FK Implícita → `saCliente.co_cli` |
| `co_ven` | char | NULL | Código del vendedor asignado | FK Implícita → `saVendedor.co_ven` |
| `co_mone` | char | NULL | Moneda del documento (ej: `USD`, `VES`) | FK Implícita → `saMoneda.co_mone` |
| `co_cond` | char | NULL | Condición de pago (crédito/contado) | FK Implícita → `saCondicionPago.co_cond` |
| `co_tran` | char | NULL | Tipo de transporte | FK Implícita → `saTransporte.co_tran` |
| `fec_emis` | smalldatetime | NULL | Fecha de emisión de la factura | — |
| `fec_venc` | smalldatetime | NULL | Fecha de vencimiento (para crédito) | — |
| `fec_reg` | smalldatetime | NULL | Fecha de registro en el sistema | — |
| `tasa` | decimal | NULL | Tasa de cambio a Bs al momento de emisión. Usar para convertir: `total_neto / tasa = USD` | Almacenada en el doc |
| `total_bruto` | decimal | NULL | Subtotal antes de impuestos y descuentos | — |
| `monto_imp` | decimal | NULL | Monto de IVA principal (alícuota 1) | — |
| `monto_imp2` | decimal | NULL | Monto de impuesto adicional (alícuota 2, ej: 8% suntuario) | — |
| `monto_imp3` | decimal | NULL | Monto de impuesto adicional (alícuota 3) | — |
| `total_neto` | decimal | NULL | Total a pagar: bruto - descuentos + recargos + impuestos | — |
| `saldo` | decimal | NULL | Saldo pendiente de cobro. `0` = cobrado completamente | — |
| `anulado` | bit | NULL | `1` = factura anulada; excluir de libros y reportes | — |
| `status` | char | NULL | Estado del documento: `A`=Abierto, `P`=Procesado, `C`=Cancelado | — |
| `n_control` | varchar | NULL | Número de control fiscal (SENIAT). Obligatorio para contribuyentes especiales | — |
| `contrib` | bit | NULL | `1` = cliente es contribuyente especial (aplica retención IVA) | — |
| `porc_desc_glob` | varchar | NULL | Porcentaje de descuento global aplicado | — |
| `monto_desc_glob` | decimal | NULL | Monto del descuento global | — |
| `otros1`/`otros2`/`otros3` | decimal | NULL | Cargos adicionales genéricos (fletes, seguros, etc.) | — |
| `impresa` | bit | NULL | `1` = factura ya impresa/enviada al cliente | — |
| `impfis` | varchar | NULL | Número fiscal de impresora fiscal (si aplica) | — |
| `imp_nro_z` | varchar | NULL | Número de reporte Z de la impresora fiscal | — |
| `co_us_in` | char | NULL | Usuario que creó el registro | FK → `saUsuario` (sistema) |
| `fe_us_in` | datetime | NULL | Fecha/hora de creación | — |
| `co_us_mo` | char | NULL | Último usuario que modificó | — |
| `fe_us_mo` | datetime | NULL | Fecha/hora de última modificación | — |
| `co_cta_ingr_egr` | char | NULL | Cuenta de ingresos/egresos para integración contable | FK Implícita → `saCuentaIngEgr` |
| `ven_ter` | bit | NULL | Venta a terceros (no cliente registrado) | — |
| `salestax` | char | NULL | Tipo de impuesto sobre ventas (EE.UU.; no usado en VE) | — |
| `campo1`-`campo8` | varchar | NULL | Campos personalizables libres para el cliente | — |

## Triggers Relacionados
- `TrigDelete_saFacturaVenta`: bloquea borrado físico; marca `anulado=1` en su lugar
- `TrigEstado_saFacturaVenta`: actualiza `status` y sincroniza saldo en `saDocumentoVenta`

## Relaciones Clave
- **Líneas**: `saFacturaVentaReng` (JOIN por `doc_num`)
- **Libro de ventas/CXC**: `saDocumentoVenta` (misma `doc_num`, `co_tipo_doc`)
- **Cobros**: `saCobroDocReng.nro_doc` donde `co_tipo_doc = 'FACT'`
- **Retenciones IVA**: `saCobroRetenIvaReng` ligado al `saCobroDocReng`

## Recetario SQL de Negocio
```sql
-- Libro de ventas del mes en USD (indexado a tasa del documento)
SELECT
    doc_num,
    n_control,
    co_cli,
    fec_emis,
    total_bruto,
    monto_imp,
    total_neto,
    tasa,
    total_neto / NULLIF(tasa, 0)   AS total_neto_usd,
    anulado
FROM saFacturaVenta
WHERE fec_emis BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY fec_emis, doc_num;

-- Facturas con saldo pendiente por cliente
SELECT co_cli, SUM(saldo) AS saldo_bs,
       SUM(saldo / NULLIF(tasa,0)) AS saldo_usd
FROM saFacturaVenta
WHERE anulado = 0 AND saldo > 0
GROUP BY co_cli
ORDER BY saldo_usd DESC;

-- Facturas de contribuyentes especiales (con retención IVA)
SELECT doc_num, co_cli, n_control, monto_imp, total_neto
FROM saFacturaVenta
WHERE contrib = 1 AND anulado = 0
  AND fec_emis >= '2024-01-01';
```
