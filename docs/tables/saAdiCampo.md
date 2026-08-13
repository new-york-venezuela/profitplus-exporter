# Tabla: saAdiCampo
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_adigrupo` | char(8) | NOT NULL | b'Codigo de grupo de campos adicionales' | FK → `saAdiGrupo.co_adigrupo` |
| `co_adicampo` | char(8) | NOT NULL | b'Codigo de campo adicional' | — |
| `des_adicampo` | varchar(60) | NULL | b'Descripcion de campo adicional' | — |
| `tipo` | int(10,0) | NOT NULL | b'Tipo de dato 1: Alfanumerico, 2: Fecha, 3: Numerico, 4: Entero (fijo=TDA)' | — |
| `val_str` | varchar(254) | NULL | b'Valor tipo alfanumerico (string)' | — |
| `val_decimal` | decimal(18,5) | NULL | b'Valor tipo decimal' | — |
| `val_fecha` | smalldatetime(16,0) | NULL | b'Valor tipo fecha' | — |
| `val_entero` | int(10,0) | NULL | b'Valor tipo entero' | — |
| `fijo` | bit(1,0) | NOT NULL | b'Registro del sistema' | — |
| `observacion` | varchar(200) | NULL | b'Observacion' | — |
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

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saAdiCampo_saAdiGrupo`: `co_adigrupo` → `saAdiGrupo.co_adigrupo`
