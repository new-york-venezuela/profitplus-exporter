# Tabla: saPagoRetenIvaReng
**Módulo**: Fiscal / Tesorería
**Descripción de Negocio**: Renglones de retención IVA en pagos a proveedores. Cuando la empresa es contribuyente especial y paga a otro contribuyente, debe retener el 75% (o 100%) del IVA y enterarlo al SENIAT. Esta tabla registra el detalle legal de cada factura afectada. Alimenta el Libro de Compras (columna de retenciones practicadas) y los comprobantes de retención emitidos a proveedores.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón | PK |
| `rowguid_reng_cob` | uniqueidentifier | NOT NULL | GUID del renglón de pago (`saPagoDocReng.rowguid`) | FK → `saPagoDocReng.rowguid` |
| `rif_contribuyente` | char | NULL | RIF de la empresa que practica la retención (nosotros) | — |
| `periodo_impositivo` | decimal | NULL | Período fiscal YYYYMM | — |
| `fecha_documento` | smalldatetime | NULL | Fecha de la factura del proveedor | — |
| `tipo_operacion` | char | NULL | `1`=compra | — |
| `tipo_documento` | char | NULL | `01`=factura, `03`=nota crédito | — |
| `rif_comprador` | char | NULL | RIF del proveedor al que se le practica la retención | — |
| `numero_documento` | char | NULL | Número de la factura del proveedor | — |
| `numero_control_documento` | char | NULL | Número de control de la factura del proveedor | — |
| `monto_documento` | decimal | NULL | Monto total de la factura | — |
| `base_imponible` | decimal | NULL | Base gravable del IVA | — |
| `alicuota` | decimal | NULL | Alícuota de IVA (ej: 16.00) | — |
| `monto_ret_imp` | decimal | NULL | **IVA retenido al proveedor** | — |
| `numero_documento_afectado` | char | NULL | Factura original afectada (en caso de N/CR) | — |
| `num_comprobante` | char | NULL | Número del comprobante de retención emitido al proveedor | — |
| `monto_excento` | decimal | NULL | Monto exento de IVA | — |
| `reten_tercero` | bit | NULL | `1` = retención en nombre de tercero | — |

## Recetario SQL de Negocio
```sql
-- Libro de Compras — retenciones IVA practicadas a proveedores
SELECT
    r.periodo_impositivo,
    r.rif_comprador                    AS rif_proveedor,
    pr.prov_des,
    r.numero_documento                 AS nro_factura_proveedor,
    r.numero_control_documento         AS nro_control,
    r.fecha_documento,
    r.monto_documento,
    r.base_imponible,
    r.alicuota,
    r.monto_ret_imp                    AS iva_retenido_practicado,
    r.num_comprobante
FROM saPagoRetenIvaReng r
INNER JOIN saPagoDocReng pr_r  ON r.rowguid_reng_cob = pr_r.rowguid
INNER JOIN saPago p            ON pr_r.cob_num = p.cob_num
LEFT JOIN  saProveedor pr      ON p.co_prov = pr.co_prov
WHERE p.anulado = 0
  AND r.periodo_impositivo = 202401
ORDER BY r.fecha_documento;
```
