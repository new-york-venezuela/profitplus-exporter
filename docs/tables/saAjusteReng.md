# Tabla: saAjusteReng
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `ajue_num` | char(20) | NOT NULL | b'No. de Ajuste' | FK → `saAjuste.ajue_num` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_tipo` | char(6) | NOT NULL | b'Tipo de proveedor' | FK → `saTipoAjuste.co_tipo` |
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArtUnidad.co_art` |
| `co_alma` | char(6) | NOT NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |
| `co_uni` | char(6) | NOT NULL | b'Codigo de la unidad' | FK → `saArtUnidad.co_uni` |
| `sco_uni` | char(6) | NULL | b'Codigo de la unidad secundaria' | FK → `saArtUnidad.co_uni` |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `total_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `stotal_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos (en unidad secundaria) del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `cost_unit` | decimal(18,5) | NOT NULL | b'Costo unitario' | — |
| `lote_asignado` | bit(1,0) | NOT NULL | b'Posee asignado informacion de lotes' | — |
| `costo_adi1` | decimal(18,5) | NOT NULL | b'Costo promedio unitario' | — |
| `costo_adi2` | decimal(18,5) | NOT NULL | b'Ultimo costo Otra moneda' | — |
| `costo_adi3` | decimal(18,5) | NOT NULL | b'Costo Promedio Otra Moneda' | — |
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
- `FK_saAjusteReng_saTipoAjuste`: `co_tipo` → `saTipoAjuste.co_tipo`
- `FK_saAjusteReng_saAjuste`: `ajue_num` → `saAjuste.ajue_num`
- `FK_saAjusteReng_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saAjusteReng_saArtUnidad`: `co_art` → `saArtUnidad.co_art`
- `FK_saAjusteReng_saArtUnidad`: `co_uni` → `saArtUnidad.co_uni`
- `FK_saAjusteReng_saArtUnidadSec`: `co_art` → `saArtUnidad.co_art`
- `FK_saAjusteReng_saArtUnidadSec`: `sco_uni` → `saArtUnidad.co_uni`
