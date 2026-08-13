# Tabla: saArtCaracteristica
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `co_lin01` | char(6) | NULL | b'Primera linea adicional de un articulo' | FK → `saLineaArticulo.co_lin` |
| `co_lin02` | char(6) | NULL | b'Segunda linea adicional de un articulo' | FK → `saLineaArticulo.co_lin` |
| `co_lin03` | char(6) | NULL | b'Tercera linea adicional de un articulo' | FK → `saLineaArticulo.co_lin` |
| `co_lin04` | char(6) | NULL | b'Cuarta  linea  adicional de un articulo' | FK → `saLineaArticulo.co_lin` |
| `co_lin05` | char(6) | NULL | b'Quinta  linea  adicional de un articulo' | FK → `saLineaArticulo.co_lin` |
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
| `transfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `sin_der_cre_fis` | bit(1,0) | NOT NULL | b'Sin derecho a credito fiscal' | — |
| `credito_fiscal` | int(10,0) | NOT NULL | b'Indica el tipo de cr\xc3\xa9dito fiscal para un determinado art\xc3\xadculo (0: No Deducible, 1: Totalmente Deducible, 2: Sujeto a Prorrateo, 3: Ninguno de los Anteriores)' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saArtCaracteristica_saLineaArticulo01`: `co_lin01` → `saLineaArticulo.co_lin`
- `FK_saArtCaracteristica_saLineaArticulo02`: `co_lin02` → `saLineaArticulo.co_lin`
- `FK_saArtCaracteristica_saLineaArticulo03`: `co_lin03` → `saLineaArticulo.co_lin`
- `FK_saArtCaracteristica_saLineaArticulo04`: `co_lin04` → `saLineaArticulo.co_lin`
- `FK_saArtCaracteristica_saLineaArticulo05`: `co_lin05` → `saLineaArticulo.co_lin`
- `FK_saArtCaracteristicas_saArticulo`: `co_art` → `saArticulo.co_art`
