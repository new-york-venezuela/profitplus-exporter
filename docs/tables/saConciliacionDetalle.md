# Tabla: saConciliacionDetalle
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_auto_con` | char(6) | NOT NULL | b'Codigo de la conciliacion automatica' | FK → `saConciliacionAutoReng.co_auto_con` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `fec_mov` | datetime(23,3) | NOT NULL | b'Fecha en que se realizo el movimiento' | — |
| `doc_num` | char(20) | NOT NULL | b'Numero de documento' | — |
| `tipo_op` | char(15) | NULL | b'tipo de operacion' | — |
| `descrip` | varchar(60) | NULL | b'Descripcion de la operacion' | — |
| `monto_d` | decimal(18,5) | NOT NULL | b'Monto del debe' | — |
| `monto_h` | decimal(18,5) | NOT NULL | b'Monto del  Haber' | — |
| `idb` | decimal(18,5) | NOT NULL | b'Impuesto al debito bancario' | — |
| `origen` | char(10) | NULL | b'*' | — |
| `dep_con` | bit(1,0) | NOT NULL | b'indica si esta conciliado' | — |
| `repetido` | bit(1,0) | NOT NULL | b'Indica si el movimiento esta repetido (cargado mas de una vez desde el banco)' | — |
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
- `FK_saConciliacionDetalle_saConciliacionAutoReng`: `co_auto_con` → `saConciliacionAutoReng.co_auto_con`
