# Tabla: pvArticuloExt
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | — | FK → `saArticulo.rowguid` |
| `descriprenglon` | bit(1,0) | NOT NULL | b'Indica si Posee Descripcion Adicional' | — |
| `descriprenglontxt` | varchar(32) | NOT NULL | b'Descripci\xc3\xb3n del Comentario Adicional si posee' | — |
| `campoobligatorio` | bit(1,0) | NOT NULL | — | — |
| `campo1` | varchar(60) | NULL | — | — |
| `campo2` | varchar(60) | NULL | — | — |
| `campo3` | varchar(60) | NULL | — | — |
| `campo4` | varchar(60) | NULL | — | — |
| `campo5` | varchar(60) | NULL | — | — |
| `campo6` | varchar(60) | NULL | — | — |
| `campo7` | varchar(60) | NULL | — | — |
| `campo8` | varchar(60) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NOT NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_pvArticuloExt_saArticulo`: `id` → `saArticulo.rowguid`
