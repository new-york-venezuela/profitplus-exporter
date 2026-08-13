# Tabla: saComisionGeneracion
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_generacion` | char(20) | NOT NULL | b'Identificador de la generacion de comision' | — |
| `fecha` | datetime(23,3) | NOT NULL | b'Fecha de la ejecucion de la generacion de comision' | — |
| `co_comi` | char(6) | NOT NULL | b'Codigo del tipo de comision relacionada a la generacion' | FK → `saComisionTipo.co_comi` |
| `comentario` | varchar(max) | NULL | b'Comentarios' | — |
| `fecha_desde` | datetime(23,3) | NOT NULL | — | — |
| `fecha_hasta` | datetime(23,3) | NOT NULL | — | — |
| `co_ven_desde` | char(6) | NULL | — | FK → `saVendedor.co_ven` |
| `co_ven_hasta` | char(6) | NULL | — | FK → `saVendedor.co_ven` |
| `tipo_ven_desde` | char(4) | NULL | — | — |
| `tipo_ven_hasta` | char(4) | NULL | — | — |
| `co_art_desde` | char(30) | NULL | — | FK → `saArticulo.co_art` |
| `co_art_hasta` | char(30) | NULL | — | FK → `saArticulo.co_art` |
| `co_cat_desde` | char(6) | NULL | — | FK → `saCatArticulo.co_cat` |
| `co_cat_hasta` | char(6) | NULL | — | FK → `saCatArticulo.co_cat` |
| `co_lin_desde` | char(6) | NULL | — | FK → `saLineaArticulo.co_lin` |
| `co_lin_hasta` | char(6) | NULL | — | FK → `saLineaArticulo.co_lin` |
| `p_adicional` | varchar(max) | NULL | b'Parametro adicional. Comunmente empleado para anotar los filtros adicionales emlpeados en el calculo' | — |
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
- `FK_saComisionGeneracion_saArticulo_desde`: `co_art_desde` → `saArticulo.co_art`
- `FK_saComisionGeneracion_saArticulo_hasta`: `co_art_hasta` → `saArticulo.co_art`
- `FK_saComisionGeneracion_saCatArticulo_desde`: `co_cat_desde` → `saCatArticulo.co_cat`
- `FK_saComisionGeneracion_saCatArticulo_hasta`: `co_cat_hasta` → `saCatArticulo.co_cat`
- `FK_saComisionGeneracion_saComisionTipo`: `co_comi` → `saComisionTipo.co_comi`
- `FK_saComisionGeneracion_saLineaArticulo_desde`: `co_lin_desde` → `saLineaArticulo.co_lin`
- `FK_saComisionGeneracion_saLineaArticulo_hasta`: `co_lin_hasta` → `saLineaArticulo.co_lin`
- `FK_saComisionGeneracion_saVendedor_desde`: `co_ven_desde` → `saVendedor.co_ven`
- `FK_saComisionGeneracion_saVendedor_hasta`: `co_ven_hasta` → `saVendedor.co_ven`
