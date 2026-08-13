# Tabla: pvValeAlimentacionReng
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `reng_num` | int(10,0) | NOT NULL | b'N\xc3\xbamero del rengl\xc3\xb3n' | — |
| `co_vale` | char(6) | NOT NULL | b'C\xc3\xb3digo Vale Alimentaci\xc3\xb3n' | FK → `pvValeAlimentacion.co_vale` |
| `valor` | decimal(18,2) | NOT NULL | b'Valor del Vale Alimentaci\xc3\xb3n' | — |
| `inactivo` | bit(1,0) | NOT NULL | b'Indica si la denominacion del CestaTicket se encuentra o no activa' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que ingres\xc3\xb3 el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de inserci\xc3\xb3n del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que hizo la \xc3\xbaltima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue modificado por \xc3\xbaltima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de \xc3\xbaltima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado para el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado para el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Reservado para el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador \xc3\xbanico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_pvValeAlimentacionReng_pvValeAlimentacion`: `co_vale` → `pvValeAlimentacion.co_vale`
