# Tabla: saConcBanco
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_auto_con` | char(6) | NOT NULL | b'Codigo de la conciliacion automatica' | FK → `saConciliacionDetalle.co_auto_con` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon de conciliacion (FK)' | FK → `saConciliacionDetalle.reng_num` |
| `mov_num` | char(20) | NOT NULL | b'Numero de movimiento de bancario' | FK → `saMovimientoBanco.mov_num` |
| `fec_conc` | datetime(23,3) | NOT NULL | b'Fecha de la conciliacion bancaria' | — |
| `con_auto` | bit(1,0) | NOT NULL | b'Indica si fue conciliado de forma automatica' | — |
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
- `FK_saConcBanco_saConciliacionDetalle`: `reng_num` → `saConciliacionDetalle.reng_num`
- `FK_saConcBanco_saConciliacionDetalle`: `co_auto_con` → `saConciliacionDetalle.co_auto_con`
- `FK_saConcBanco_saMovimientoBanco`: `mov_num` → `saMovimientoBanco.mov_num`
