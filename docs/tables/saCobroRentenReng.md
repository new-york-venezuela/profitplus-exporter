# Tabla: saCobroRentenReng
**Módulo**: Fiscal / Tesorería
**Descripción de Negocio**: Renglones de retención ISLR en cobros. Registra las retenciones del Impuesto Sobre la Renta aplicadas al momento de cobrar facturas de servicios u honorarios. Vinculado a `saCobroDocReng` vía GUID. Alimenta el libro de retenciones ISLR y el ARC (Comprobante de Retención).

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón | PK |
| `rowguid_reng_cob` | uniqueidentifier | NOT NULL | GUID del renglón de cobro al que aplica | FK → `saCobroDocReng.rowguid` |
| `co_islr` | char | NULL | Código de concepto ISLR | FK → `saConISLR.co_islr` |
| `monto` | decimal | NULL | Monto base sobre el que se calcula la retención | — |
| `monto_reten` | decimal | NULL | **Monto retenido de ISLR** | — |
| `monto_obj` | decimal | NULL | Monto del enriquecimiento neto gravable | — |
| `sustraendo` | decimal | NULL | Sustraendo de la tabla ISLR para calcular el impuesto | — |
| `porc_retn` | decimal | NULL | Porcentaje de retención aplicado | — |
| `automatica` | bit | NULL | `1` = calculada automáticamente por el sistema | — |
| `rowguid_fact` | uniqueidentifier | NULL | GUID de la factura de compra relacionada | — |

## Recetario SQL de Negocio
```sql
-- Retenciones ISLR en cobros del período
SELECT
    c.fecha, c.co_cli,
    ri.co_islr,
    ci.islr_des         AS concepto,
    ri.monto            AS base_calculo,
    ri.porc_retn,
    ri.monto_reten      AS islr_retenido
FROM saCobroRentenReng ri
INNER JOIN saCobroDocReng cr ON ri.rowguid_reng_cob = cr.rowguid
INNER JOIN saCobro c         ON cr.cob_num = c.cob_num
LEFT JOIN  saConISLR ci      ON ri.co_islr = ci.co_islr
WHERE c.anulado = 0
  AND c.fecha BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY c.fecha;
```
