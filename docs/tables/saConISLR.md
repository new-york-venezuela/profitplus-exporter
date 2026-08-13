# Tabla: saConISLR
**Módulo**: Fiscal
**Descripción de Negocio**: Catálogo de conceptos de retención ISLR (Impuesto Sobre la Renta). Define los conceptos establecidos por el SENIAT para retenciones: honorarios profesionales, servicios, comisiones, arrendamientos, etc. Cada concepto tiene un numeral y literal que corresponde al Decreto de Retenciones de ISLR vigente en Venezuela.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_islr` | char | NOT NULL | Código interno del concepto (PK) | Clave Primaria |
| `islr_des` | varchar | NULL | Descripción corta del concepto | — |
| `islr_deslarga` | varchar | NULL | Descripción larga para comprobantes oficiales | — |
| `numeral` | char | NULL | Numeral del decreto SENIAT (ej: `1`, `2`, `3`) | — |
| `literal` | char | NULL | Literal dentro del numeral (ej: `a`, `b`, `c`) | — |

## Relaciones Clave
- `saCobroRentenReng.co_islr` — retenciones ISLR recibidas de clientes
- `saPagoRentenReng.co_islr` — retenciones ISLR practicadas a proveedores
- `saArticulo.co_reten` — artículo cuya venta genera ISLR
- `saTabuladorIslr.co_tab` → `saTabuladorIslrReng` — tablas de porcentajes por concepto

## Recetario SQL de Negocio
```sql
-- Todos los conceptos ISLR disponibles
SELECT co_islr, islr_des, numeral, literal
FROM saConISLR
ORDER BY numeral, literal;

-- ISLR retenido por concepto en el año (pagos a proveedores)
SELECT ri.co_islr, ci.islr_des,
       SUM(ri.monto)       AS base_total,
       SUM(ri.monto_reten) AS islr_retenido
FROM saPagoRentenReng ri
INNER JOIN saPagoDocReng r ON ri.rowguid_reng_cob = r.rowguid
INNER JOIN saPago p        ON r.cob_num = p.cob_num
LEFT JOIN  saConISLR ci    ON ri.co_islr = ci.co_islr
WHERE p.anulado = 0 AND YEAR(p.fecha) = 2024
GROUP BY ri.co_islr, ci.islr_des
ORDER BY islr_retenido DESC;
```
