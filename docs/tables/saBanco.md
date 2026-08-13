# Tabla: saBanco
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_ban` | char(6) | NOT NULL | b'C\xc3\xb3digo del banco asociado al documento' | — |
| `des_ban` | varchar(60) | NOT NULL | b'Descripcion del banco' | — |
| `telefonos` | varchar(60) | NULL | b'Informaci\xc3\xb3n de los numeros telefonicos' | — |
| `plazo1` | int(10,0) | NOT NULL | b'D\xc3\xadas de diferimiento para cheques del mismo banco y misma plaza ' | — |
| `plazo2` | int(10,0) | NOT NULL | b'D\xc3\xadas de diferimiento para cheques del mismo banco y diferente plaza' | — |
| `plazo3` | int(10,0) | NOT NULL | b'D\xc3\xadas de diferimiento para cheques de diferente banco y misma plaza' | — |
| `plazo4` | int(10,0) | NOT NULL | b'D\xc3\xadas de diferimiento para cheques de diferente banco y diferente plaza' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `comisMismoBanco` | decimal(18,2) | NULL | — | — |
| `comisOtrosBancos` | decimal(18,2) | NULL | — | — |

## Triggers Relacionados
_Ninguno_
