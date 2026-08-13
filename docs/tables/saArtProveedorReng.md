# Tabla: saArtProveedorReng
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_prov` | char(16) | NOT NULL | b'Codigo de Proveedor' | FK → `saProveedor.co_prov` |
| `fecha` | datetime(23,3) | NOT NULL | b'Fecha de registro' | — |
| `observacion` | varchar(max) | NULL | b'Informaci\xc3\xb3n adicional u observaciones sobre el proveedor' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saArtProveedorReng_saArticulo`: `co_art` → `saArticulo.co_art`
- `FK_saArtProveedorReng_saProveedor`: `co_prov` → `saProveedor.co_prov`
