# Tabla: saSeriales
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `co_alma` | char(6) | NOT NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |
| `serial` | varchar(40) | NOT NULL | b'Serial' | — |
| `doc_tip_e` | char(4) | NULL | b'Tipo de Documento de Entrada' | — |
| `doc_num_e` | uniqueidentifier | NULL | b'Identificador del documento de entrada (a nivel de renglon)' | — |
| `doc_tip_s` | char(4) | NULL | b'Tipo de Documento de Salida' | — |
| `doc_num_s` | uniqueidentifier | NULL | b'Identificador del documento de entrada (a nivel de renglon)' | — |
| `num_gara` | int(10,0) | NULL | b'Reservado para implementaciones futuras' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saSeriales_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saSeriales_saArticulo`: `co_art` → `saArticulo.co_art`
