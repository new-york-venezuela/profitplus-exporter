# Tabla: saAjPrecioCostoM
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_ajuste` | char(20) | NOT NULL | b'Codigo del ajuste de precio/costo' | — |
| `des_ajuste` | varchar(60) | NULL | b'Descripcion del ajuste de precio/costo' | — |
| `co_alma` | char(6) | NULL | b'Codigo del almacen' | FK Implícita → `saAlmacen.co_alma` |
| `tipo_ajuste` | int(10,0) | NOT NULL | b'Tipo de Ajuste 0: Precio, 1: Costo' | — |
| `tipo_ajuste_precio` | char(6) | NULL | — | — |
| `tipo_ajuste_costo` | char(6) | NULL | — | — |
| `margen_superior` | char(6) | NULL | — | — |
| `margen_inferior` | char(6) | NULL | — | — |
| `co_art_desde` | char(30) | NULL | — | — |
| `co_art_hasta` | char(30) | NULL | — | — |
| `co_lin` | char(6) | NULL | b'Codigo de Linea' | FK Implícita → `saLineaArticulo.co_lin` |
| `co_subl` | char(6) | NULL | b'Codigo de Sub Linea' | FK Implícita → `saSubLinea.co_subl` |
| `co_cat` | char(6) | NULL | b'Codigo de Categoria' | FK Implícita → `saCatArticulo.co_cat` |
| `co_prov` | char(16) | NULL | b'Codigo de Proveedor' | FK Implícita → `saProveedor.co_prov` |
| `item` | char(10) | NULL | — | — |
| `procesado` | bit(1,0) | NOT NULL | — | — |
| `fecha` | datetime(23,3) | NULL | — | — |
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
| `co_mone` | char(6) | NULL | — | FK → `saMoneda.co_mone` |
| `tasa` | decimal(21,8) | NULL | — | — |

## Triggers Relacionados
- `TrigEstado_saAjPrecioCostoM`

## Foreign Keys (explícitas)
- `FK_saAjPrecioCostoM_saMoneda`: `co_mone` → `saMoneda.co_mone`
