# Tabla: saCobroRetenIvaReng
**Módulo**: Fiscal / Tesorería
**Descripción de Negocio**: Renglones de retención IVA en cobros. Registra el detalle legal exigido por el SENIAT para cada comprobante de retención IVA emitido por un contribuyente especial al cobrar. Cada fila corresponde a una factura afectada por retención en un cobro. Alimenta el Libro de Ventas (retenciones recibidas) y los comprobantes de retención.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón | PK (con rowguid_reng_cob) |
| `rowguid_reng_cob` | uniqueidentifier | NOT NULL | GUID del renglón de cobro (`saCobroDocReng.rowguid`) al que pertenece | FK → `saCobroDocReng.rowguid` |
| `rif_contribuyente` | char | NULL | RIF del agente de retención (el cliente que retiene) | — |
| `periodo_impositivo` | decimal | NULL | Período fiscal en formato YYYYMM | — |
| `fecha_documento` | smalldatetime | NULL | Fecha de la factura afectada | — |
| `tipo_operacion` | char | NULL | `1`=compra, `2`=venta | — |
| `tipo_documento` | char | NULL | Tipo de documento: `01`=factura, `02`=nota débito, `03`=nota crédito | — |
| `rif_comprador` | char | NULL | RIF del comprador (agente de retención) | — |
| `numero_documento` | char | NULL | Número del documento afectado (factura) | — |
| `numero_control_documento` | char | NULL | Número de control SENIAT de la factura afectada | — |
| `monto_documento` | decimal | NULL | Monto total del documento afectado | — |
| `base_imponible` | decimal | NULL | Base sobre la que se calcula la retención | — |
| `alicuota` | decimal | NULL | Porcentaje de IVA aplicado (ej: 16.00) | — |
| `monto_ret_imp` | decimal | NULL | **Monto retenido** = `base_imponible × alicuota × porcentaje_retención` | — |
| `numero_documento_afectado` | char | NULL | En N/CR: número de la factura que afecta | — |
| `num_comprobante` | char | NULL | Número del comprobante de retención emitido | — |
| `monto_excento` | decimal | NULL | Monto exento de IVA en el documento | — |
| `reten_tercero` | bit | NULL | `1` = retención en nombre de tercero | — |
| `numero_expediente` | char | NULL | Número de expediente para retenciones especiales | — |

## Recetario SQL de Negocio
```sql
-- Libro de Ventas (retenciones IVA recibidas) — formato SENIAT
SELECT
    r.periodo_impositivo,
    r.rif_contribuyente                AS rif_agente_retencion,
    r.numero_documento                 AS nro_factura,
    r.numero_control_documento         AS nro_control,
    r.fecha_documento,
    r.tipo_documento,
    r.monto_documento,
    r.base_imponible,
    r.alicuota,
    r.monto_ret_imp                    AS iva_retenido,
    r.num_comprobante
FROM saCobroRetenIvaReng r
INNER JOIN saCobroDocReng cr ON r.rowguid_reng_cob = cr.rowguid
INNER JOIN saCobro c         ON cr.cob_num = c.cob_num
WHERE c.anulado = 0
  AND r.periodo_impositivo = 202401
ORDER BY r.fecha_documento, r.numero_documento;

-- Total IVA retenido por período
SELECT r.periodo_impositivo,
       COUNT(*)                  AS num_documentos,
       SUM(r.base_imponible)     AS base_total,
       SUM(r.monto_ret_imp)      AS iva_retenido_total
FROM saCobroRetenIvaReng r
INNER JOIN saCobroDocReng cr ON r.rowguid_reng_cob = cr.rowguid
INNER JOIN saCobro c         ON cr.cob_num = c.cob_num
WHERE c.anulado = 0
GROUP BY r.periodo_impositivo
ORDER BY r.periodo_impositivo;
```
