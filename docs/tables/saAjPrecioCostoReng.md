# Tabla: saAjPrecioCostoReng
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_ajuste` | char(20) | NOT NULL | b'Codigo del ajuste de precio/costo' | FK → `saAjPrecioCostoM.cod_ajuste` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK Implícita → `saArticulo.co_art` |
| `co_alma` | char(6) | NULL | b'Codigo del almacen' | FK Implícita → `saAlmacen.co_alma` |
| `monto` | decimal(18,5) | NOT NULL | — | — |
| `desde` | datetime(23,3) | NOT NULL | — | — |
| `hasta` | datetime(23,3) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `rowguid_ArtPrecio` | uniqueidentifier | NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saAjPrecioCostoRenglon_saAjPrecioCostotM`: `cod_ajuste` → `saAjPrecioCostoM.cod_ajuste`
