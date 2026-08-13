# Tabla: saDistribCosto
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `distrib_num` | char(20) | NOT NULL | b'Codigo de la distribucion de costos' | — |
| `anulado` | bit(1,0) | NOT NULL | b'Indica si el registro se encuentra o no anulado' | — |
| `fecha` | smalldatetime(16,0) | NOT NULL | b'Fecha del registro' | — |
| `descrip` | varchar(60) | NULL | b'Descripcion del registro' | — |
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
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `procesado` | bit(1,0) | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_
