# Tabla: saComisionResultado
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_comiresult` | uniqueidentifier | NOT NULL | — | — |
| `co_generacion` | char(20) | NOT NULL | — | FK → `saComisionGeneracion.co_generacion` |
| `TablaOri` | varchar(32) | NOT NULL | — | — |
| `IdOri` | uniqueidentifier | NOT NULL | b'Identificador unico del registro en la tabla de origen' | — |
| `Monto_01` | decimal(18,2) | NULL | — | — |
| `Monto_02` | decimal(18,2) | NULL | — | — |
| `Monto_03` | decimal(18,2) | NULL | — | — |
| `Monto_04` | decimal(18,2) | NULL | — | — |
| `Monto_05` | decimal(18,2) | NULL | — | — |
| `Monto_06` | decimal(18,5) | NULL | — | — |
| `Monto_07` | decimal(18,5) | NULL | — | — |
| `Monto_08` | decimal(18,5) | NULL | — | — |
| `Monto_09` | decimal(18,5) | NULL | — | — |
| `Monto_10` | decimal(18,5) | NULL | — | — |
| `Aux_01` | varchar(128) | NULL | — | — |
| `Aux_02` | varchar(128) | NULL | — | — |
| `Aux_03` | varchar(128) | NULL | — | — |
| `Aux_04` | varchar(128) | NULL | — | — |
| `Aux_05` | varchar(128) | NULL | — | — |
| `fecha_01` | datetime(23,3) | NULL | — | — |
| `fecha_02` | datetime(23,3) | NULL | — | — |
| `fecha_03` | datetime(23,3) | NULL | — | — |
| `fecha_04` | datetime(23,3) | NULL | — | — |
| `fecha_05` | datetime(23,3) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saComisionResultado_saComisionGeneracion`: `co_generacion` → `saComisionGeneracion.co_generacion`
