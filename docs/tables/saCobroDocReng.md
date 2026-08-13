# Tabla: saCobroDocReng
**Módulo**: Tesorería / Cuentas por Cobrar
**Descripción de Negocio**: Renglones de documentos cancelados por cada cobro. Une el encabezado `saCobro` con los documentos de `saDocumentoVenta` que se están pagando. Permite cobros parciales: `mont_cob` puede ser menor que el saldo del documento. También registra montos de retención IVA e ISLR para enlazar con los renglones de retención específicos.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón dentro del cobro | PK (con cob_num) |
| `cob_num` | char | NOT NULL | Número del cobro al que pertenece | FK → `saCobro.cob_num` |
| `co_tipo_doc` | char | NULL | Tipo del documento que se cancela (`FACT`, `N/CR`, etc.) | FK → `saDocumentoVenta.co_tipo_doc` |
| `nro_doc` | char | NULL | Número del documento que se cancela | FK → `saDocumentoVenta.nro_doc` |
| `mont_cob` | decimal | NULL | Monto cobrado/aplicado contra este documento en esta transacción | — |
| `monto_retencion_iva` | decimal | NULL | Monto de retención IVA deducido en este renglón | — |
| `monto_retencion` | decimal | NULL | Monto de retención ISLR deducido en este renglón | — |
| `dpcobro_porc_desc` | decimal | NULL | Porcentaje de descuento por pronto pago aplicado | — |
| `dpcobro_monto` | decimal | NULL | Monto del descuento por pronto pago | — |
| `rowguid` | uniqueidentifier | NULL | GUID del renglón — usado como FK desde `saCobroRetenIvaReng.rowguid_reng_cob` | — |
| `tipo_doc` | char | NULL | Tipo del documento de forma de pago (cheque, transferencia) | — |
| `num_doc` | varchar | NULL | Número del documento de forma de pago | — |
| `tipo_origen` | int | NULL | `0`=normal, `1`=anticipo, otros valores especiales | — |

## Recetario SQL de Negocio
```sql
-- Detalle completo de un cobro: qué facturas canceló y retenciones
SELECT
    r.reng_num, r.co_tipo_doc, r.nro_doc,
    r.mont_cob,
    r.monto_retencion_iva,
    r.monto_retencion  AS monto_retencion_islr,
    r.dpcobro_monto    AS desc_pronto_pago
FROM saCobroDocReng r
WHERE r.cob_num = 'COB000001'
ORDER BY r.reng_num;

-- Cobros que incluyen retención IVA (contribuyentes especiales)
SELECT c.cob_num, c.co_cli, c.fecha,
       SUM(r.monto_retencion_iva) AS total_reten_iva
FROM saCobro c
INNER JOIN saCobroDocReng r ON c.cob_num = r.cob_num
WHERE r.monto_retencion_iva > 0 AND c.anulado = 0
GROUP BY c.cob_num, c.co_cli, c.fecha
ORDER BY c.fecha DESC;
```
