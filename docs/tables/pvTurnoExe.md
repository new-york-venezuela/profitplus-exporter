# Tabla: pvTurnoExe
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `num_turno` | char(20) | NOT NULL | b'Numero de Turno' | — |
| `co_turno` | char(6) | NOT NULL | b'C\xc3\xb3digo del turno asociado' | FK → `pvTurno.co_turno` |
| `cod_caja` | char(6) | NOT NULL | b'C\xc3\xb3digo de la caja asociada' | FK → `saCaja.cod_caja` |
| `user_caj` | char(6) | NOT NULL | b'C\xc3\xb3digo usuario Cajero' | — |
| `user_sup` | char(6) | NOT NULL | b'C\xc3\xb3digo usuario Supervisor' | — |
| `fecha_ini` | smalldatetime(16,0) | NOT NULL | b'Fecha de inicio ' | — |
| `fecha_fin` | smalldatetime(16,0) | NOT NULL | b'Fecha de finalizaci\xc3\xb3n' | — |
| `status` | char(2) | NOT NULL | b'C-->Cerrado / A-->Activo / E--> En espera / N-->No usado' | — |
| `restringe` | bit(1,0) | NOT NULL | b'Restringir el turno por horario' | — |
| `saldo` | decimal(18,2) | NOT NULL | b'Saldo del turno' | — |
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
| `cod_caja2` | char(6) | NULL | b'C\xc3\xb3digo de la caja adicional 2 ' | FK → `saCaja.cod_caja` |
| `cod_caja3` | char(6) | NULL | b'C\xc3\xb3digo de la caja adicional 3 ' | FK → `saCaja.cod_caja` |
| `saldo2` | decimal(18,2) | NOT NULL | b'Saldo inicial de la caja adicional 2 ' | — |
| `saldo3` | decimal(18,2) | NOT NULL | b'Saldo inicia de la caja adicional 3' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_pvTurnoExe_saCaja2`: `cod_caja2` → `saCaja.cod_caja`
- `FK_pvTurnoExe_saCaja3`: `cod_caja3` → `saCaja.cod_caja`
- `FK_pvTurnoExe_pvTurno`: `co_turno` → `pvTurno.co_turno`
- `FK_pvTurnoExe_saCaja`: `cod_caja` → `saCaja.cod_caja`
