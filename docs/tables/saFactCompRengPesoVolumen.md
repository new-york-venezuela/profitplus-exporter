# Tabla: saFactCompRengPesoVolumen
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguidDoc` | uniqueidentifier | NOT NULL | — | FK → `saFacturaCompraReng.rowguid` |
| `peso_comp` | decimal(18,2) | NOT NULL | — | — |
| `volumen_comp` | decimal(18,2) | NOT NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saFactCompRengPesoVolumen_saFacturaCompraReng`: `rowguidDoc` → `saFacturaCompraReng.rowguid`
