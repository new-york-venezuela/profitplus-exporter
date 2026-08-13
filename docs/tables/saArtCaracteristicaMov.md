# Tabla: saArtCaracteristicaMov
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguidDoc` | uniqueidentifier | NOT NULL | b'Rowguid del documento que origina el movimiento' | — |
| `tipo_doc` | char(4) | NOT NULL | b'Tipo de documento que origina el movimiento' | — |
| `co_lin01` | char(6) | NOT NULL | b'Primera linea adicional de un articulo' | FK → `saSubLinea.co_lin` |
| `co_subl01` | char(6) | NOT NULL | b'Primera sublinea adicional de un articulo' | FK → `saSubLinea.co_subl` |
| `co_lin02` | char(6) | NULL | b'Segunda  linea  adicional de un articulo' | FK → `saSubLinea.co_lin` |
| `co_subl02` | char(6) | NULL | b'Segunda sublinea adicional de un articulo' | FK → `saSubLinea.co_subl` |
| `co_lin03` | char(6) | NULL | b'Tercera  linea  adicional de un articulo' | FK → `saSubLinea.co_lin` |
| `co_subl03` | char(6) | NULL | b'Tercera  sublinea adicional de un articulo' | FK → `saSubLinea.co_subl` |
| `co_lin04` | char(6) | NULL | b'Cuarta   linea  adicional de un articulo' | FK → `saSubLinea.co_lin` |
| `co_subl04` | char(6) | NULL | b'Ciuarta sublinea adicional de un articulo' | FK → `saSubLinea.co_subl` |
| `co_lin05` | char(6) | NULL | b'Quinta  linea  adicional de un articulo' | FK → `saSubLinea.co_lin` |
| `co_subl05` | char(6) | NULL | b'Quinta sublinea adicional de un articulo' | FK → `saSubLinea.co_subl` |
| `cantidad` | decimal(18,5) | NOT NULL | b'cantidad de articulos' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico ' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saArtCaracteristicaMov_saSubLinea01`: `co_lin01` → `saSubLinea.co_lin`
- `FK_saArtCaracteristicaMov_saSubLinea01`: `co_subl01` → `saSubLinea.co_subl`
- `FK_saArtCaracteristicaMov_saSubLinea02`: `co_lin02` → `saSubLinea.co_lin`
- `FK_saArtCaracteristicaMov_saSubLinea02`: `co_subl02` → `saSubLinea.co_subl`
- `FK_saArtCaracteristicaMov_saSubLinea03`: `co_lin03` → `saSubLinea.co_lin`
- `FK_saArtCaracteristicaMov_saSubLinea03`: `co_subl03` → `saSubLinea.co_subl`
- `FK_saArtCaracteristicaMov_saSubLinea04`: `co_lin04` → `saSubLinea.co_lin`
- `FK_saArtCaracteristicaMov_saSubLinea04`: `co_subl04` → `saSubLinea.co_subl`
- `FK_saArtCaracteristicaMov_saSubLinea05`: `co_lin05` → `saSubLinea.co_lin`
- `FK_saArtCaracteristicaMov_saSubLinea05`: `co_subl05` → `saSubLinea.co_subl`
