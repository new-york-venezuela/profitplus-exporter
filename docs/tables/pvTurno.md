# Tabla: pvTurno
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_turno` | char(6) | NOT NULL | b'C\xc3\xb3digo del turno' | — |
| `des_turno` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n del turno' | — |
| `hora_ini` | int(10,0) | NOT NULL | b'Hora de inicio' | — |
| `minu_ini` | int(10,0) | NOT NULL | b'Minuto de inicio' | — |
| `ampm_ini` | char(1) | NOT NULL | b'AM/PM inicio' | — |
| `hora_fin` | int(10,0) | NOT NULL | b'Hora de finalizaci\xc3\xb3n' | — |
| `minu_fin` | int(10,0) | NOT NULL | b'Minuto de finalizaci\xc3\xb3n' | — |
| `ampm_fin` | char(1) | NOT NULL | b'AM/PM finalizaci\xc3\xb3n' | — |
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
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la \xc3\xbaltima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador \xc3\xbanico' | — |

## Triggers Relacionados
_Ninguno_
