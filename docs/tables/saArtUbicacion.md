# Tabla: saArtUbicacion
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'C\xc3\xb3digo del art\xc3\xadculo' | FK → `saArticulo.co_art` |
| `co_alma` | char(6) | NOT NULL | b'C\xc3\xb3digo del almac\xc3\xa9n' | FK → `saAlmacen.co_alma` |
| `co_ubicacion` | char(6) | NOT NULL | b'C\xc3\xb3digo de la ubicaci\xc3\xb3n principal' | FK → `saUbicacion.co_ubicacion` |
| `co_ubicacion2_calculado` | char(6) | NOT NULL | b'Codigo de ubicaci\xc3\xb3n2 o NOTAPPLY cuando no aplica para ninguna ubicaci\xc3\xb3n (Campo calculado)' | — |
| `co_ubicacion3_calculado` | char(6) | NOT NULL | b'Codigo de ubicaci\xc3\xb3n3 o NOTAPPLY cuando no aplica para ninguna ubicaci\xc3\xb3n (Campo calculado)' | — |
| `orden` | int(10,0) | NOT NULL | b'Orden del art\xc3\xadculo en referencia a la ubicaci\xc3\xb3n dentro de almac\xc3\xa9n' | — |
| `co_ubicacion2` | char(6) | NULL | b'C\xc3\xb3digo de la ubicaci\xc3\xb3n respecto a la ubicaci\xc3\xb3n principal' | FK → `saUbicacion.co_ubicacion` |
| `co_ubicacion3` | char(6) | NULL | b'C\xc3\xb3digo de la ubicaci\xc3\xb3n respecto a co_ubicacion2' | FK → `saUbicacion.co_ubicacion` |
| `des_ubicacion` | varchar(120) | NULL | b'Descripci\xc3\xb3n de la ubicaci\xc3\xb3n del art\xc3\xadculo' | — |
| `co_us_in` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que ingres\xc3\xb3 el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de inserci\xc3\xb3n del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que hizo la \xc3\xbaltima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue modificado por \xc3\xbaltima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la \xc3\xbaltima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NULL | b'Identificador \xc3\x9anico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saArtUbicacion_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saArtUbicacion_saArticulo`: `co_art` → `saArticulo.co_art`
- `FK_saArtUbicacion_saUbicacion`: `co_ubicacion` → `saUbicacion.co_ubicacion`
- `FK_saArtUbicacion_saUbicacion_2`: `co_ubicacion2` → `saUbicacion.co_ubicacion`
- `FK_saArtUbicacion_saUbicacion_3`: `co_ubicacion3` → `saUbicacion.co_ubicacion`
