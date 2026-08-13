# Tabla: saArtIdentificadorReng
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArtUnidad.co_art` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_iden` | char(30) | NOT NULL | b'Codigo identificador auxiliar de articulo' | — |
| `co_uni` | char(6) | NOT NULL | b'Unidad equivalente del identificador auxiliar con respecto al articulo' | FK → `saArtUnidad.co_uni` |
| `des_iden` | varchar(60) | NULL | b'Descripcion identificador auxiliar de articulo' | — |
| `cantidad` | decimal(18,5) | NOT NULL | b'Cantidad equivalente del identificador auxiliar con respecto al articulo' | — |
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
- `FK_saArtIdentificadorReng_saArtUnidad`: `co_art` → `saArtUnidad.co_art`
- `FK_saArtIdentificadorReng_saArtUnidad`: `co_uni` → `saArtUnidad.co_uni`
