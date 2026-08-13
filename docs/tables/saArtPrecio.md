# Tabla: saArtPrecio
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `co_precio` | char(6) | NOT NULL | b'Codigo del tipo de precio' | FK → `saTipoPrecio.co_precio` |
| `co_alma_calculado` | char(6) | NOT NULL | b'Codigo del almacen o TODOS cuando aplica a todos los almacenes (Campo calculado)' | — |
| `desde` | datetime(23,3) | NOT NULL | b'Fecha inicial de vigencia del precio' | — |
| `hasta` | datetime(23,3) | NULL | b'Fecha final de vigencia de precio' | — |
| `co_alma` | char(6) | NULL | b'Codigo del almacen (null equivale a todos los almacenes)' | FK → `saAlmacen.co_alma` |
| `monto` | decimal(18,5) | NOT NULL | b'Monto del precio' | — |
| `montoadi1` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `montoadi2` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `montoadi3` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `montoadi4` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `montoadi5` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `precioOm` | bit(1,0) | NOT NULL | b'Reservado para futuras implementaciones' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `co_mone` | char(6) | NULL | — | FK Implícita → `saMoneda.co_mone` |
| `Inactivo` | bit(1,0) | NOT NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saArtPrecio_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saArtPrecio_saTipoPrecio`: `co_precio` → `saTipoPrecio.co_precio`
- `FK_saArtPrecio_saArticulo`: `co_art` → `saArticulo.co_art`
