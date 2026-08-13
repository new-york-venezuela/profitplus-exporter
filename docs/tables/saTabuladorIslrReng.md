# Tabla: saTabuladorIslrReng
**Módulo**: Fiscal
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_tab` | char(20) | NOT NULL | b'C\xc3\xb3digo Tabulador del I.S.L.R.' | FK → `saTabuladorIslr.co_tab` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_islr` | char(6) | NOT NULL | b'Concepto de I.S.L.R.' | FK → `saConISLR.co_islr` |
| `porc_ret` | decimal(18,5) | NOT NULL | b'Porcentaje de retenci\xc3\xb3n' | — |
| `porc_imp` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (1) aplicado' | — |
| `sustraen` | decimal(18,5) | NOT NULL | b'Sustraendo en Unidades Tributarias' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saTabuladorIslrReng_saConISLR`: `co_islr` → `saConISLR.co_islr`
- `FK_saTabuladorIslrReng_saTabuladorIslr`: `co_tab` → `saTabuladorIslr.co_tab`
