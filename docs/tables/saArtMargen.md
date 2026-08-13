# Tabla: saArtMargen
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `co_precio` | char(6) | NOT NULL | b'Codigo del tipo de precio' | FK → `saTipoPrecio.co_precio` |
| `monto_min` | decimal(18,5) | NOT NULL | b'Porcentaje minimo' | — |
| `monto_max` | decimal(18,5) | NOT NULL | b'Porcentaje maximo' | — |
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
- `FK_saArtMargen_saArticulo`: `co_art` → `saArticulo.co_art`
- `FK_saArtMargen_saTipoPrecio`: `co_precio` → `saTipoPrecio.co_precio`
