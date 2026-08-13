# Tabla: saSubLinea
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_lin` | char(6) | NOT NULL | b'Codigo de Linea' | FK → `saLineaArticulo.co_lin` |
| `co_subl` | char(6) | NOT NULL | b'Codigo de Sub Linea' | — |
| `subl_des` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n de la l\xc3\xadnea' | — |
| `co_imun` | char(15) | NULL | b'C\xc3\xb3digo Impuesto Municipal' | — |
| `co_reten` | char(6) | NULL | b'Codigo de concepto de I.S.L.R.' | FK → `saConISLR.co_islr` |
| `i_subl_des` | varchar(60) | NULL | b'Descripci\xc3\xb3n otro idioma' | — |
| `movil` | bit(1,0) | NOT NULL | b'Registro proveniente de Profit M\xc3\xb3vil' | — |
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
- `FK_saSubLinea_saConISLR`: `co_reten` → `saConISLR.co_islr`
- `FK_saSubLinea_saLineaArticulo`: `co_lin` → `saLineaArticulo.co_lin`
