# Tabla: saPagoRentenReng
**Módulo**: Fiscal / Tesorería
**Descripción de Negocio**: Renglones de retención ISLR en pagos a proveedores. Cuando se paga por servicios profesionales, honorarios o actividades gravadas con ISLR, la empresa retiene el porcentaje correspondiente al tabulador. Esta tabla registra el detalle por renglón de pago. Espejo de `saCobroRentenReng` para el lado de compras.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón | PK |
| `rowguid_reng_cob` | uniqueidentifier | NOT NULL | GUID del renglón de pago | FK → `saPagoDocReng.rowguid` |
| `co_islr` | char | NULL | Código de concepto ISLR | FK → `saConISLR.co_islr` |
| `monto` | decimal | NULL | Base de cálculo ISLR | — |
| `monto_reten` | decimal | NULL | **Monto retenido de ISLR** | — |
| `monto_obj` | decimal | NULL | Enriquecimiento neto gravable | — |
| `sustraendo` | decimal | NULL | Sustraendo del tabulador ISLR | — |
| `porc_retn` | decimal | NULL | Porcentaje de retención aplicado | — |
| `automatica` | bit | NULL | `1` = calculada automáticamente | — |
| `rowguid_fact` | uniqueidentifier | NULL | GUID de la factura de compra relacionada | — |

## Recetario SQL de Negocio
```sql
-- Retenciones ISLR practicadas a proveedores en el año
SELECT
    p.fecha, p.co_prov, pr.prov_des,
    ri.co_islr, ci.islr_des,
    ri.monto AS base, ri.porc_retn, ri.monto_reten
FROM saPagoRentenReng ri
INNER JOIN saPagoDocReng r ON ri.rowguid_reng_cob = r.rowguid
INNER JOIN saPago p        ON r.cob_num = p.cob_num
LEFT JOIN  saProveedor pr  ON p.co_prov = pr.co_prov
LEFT JOIN  saConISLR ci    ON ri.co_islr = ci.co_islr
WHERE p.anulado = 0
  AND YEAR(p.fecha) = 2024
ORDER BY p.fecha;
```
