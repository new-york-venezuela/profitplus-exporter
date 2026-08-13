# Tabla: saArtCrearAut
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_artCrearAut` | char(30) | NOT NULL | — | — |
| `fecha_reg` | smalldatetime(16,0) | NOT NULL | — | — |
| `ArtCrearAut_des` | varchar(120) | NULL | — | — |
| `art_des` | varchar(120) | NULL | — | — |
| `tipo` | char(1) | NOT NULL | — | — |
| `co_lin_desde` | char(6) | NULL | — | FK → `saSubLinea.co_lin` |
| `co_lin_hasta` | char(6) | NULL | — | FK → `saSubLinea.co_lin` |
| `co_subl_desde` | char(6) | NULL | — | FK → `saSubLinea.co_subl` |
| `co_subl_hasta` | char(6) | NULL | — | FK → `saSubLinea.co_subl` |
| `co_cat_desde` | char(6) | NULL | — | FK → `saCatArticulo.co_cat` |
| `co_cat_hasta` | char(6) | NULL | — | FK → `saCatArticulo.co_cat` |
| `co_color_desde` | char(6) | NULL | — | FK → `saColor.co_color` |
| `co_color_hasta` | char(6) | NULL | — | FK → `saColor.co_color` |
| `co_ubicacion_desde` | char(6) | NULL | — | FK → `saUbicacion.co_ubicacion` |
| `co_ubicacion_hasta` | char(6) | NULL | — | FK → `saUbicacion.co_ubicacion` |
| `co_proc_desde` | char(6) | NULL | — | FK → `saProcedencia.cod_proc` |
| `co_proc_hasta` | char(6) | NULL | — | FK → `saProcedencia.cod_proc` |
| `item_desde` | char(10) | NULL | — | — |
| `item_hasta` | char(10) | NULL | — | — |
| `co_uni` | char(6) | NOT NULL | — | FK → `saUnidad.co_uni` |
| `usar_Cod_artLin` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artLin` | int(10,0) | NULL | — | — |
| `Orden_Cod_artLin` | int(10,0) | NULL | — | — |
| `usar_Cod_artSubl` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artSubl` | int(10,0) | NULL | — | — |
| `Orden_Cod_artSubl` | int(10,0) | NULL | — | — |
| `usar_Cod_artCat` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artCat` | int(10,0) | NULL | — | — |
| `Orden_Cod_artCat` | int(10,0) | NULL | — | — |
| `usar_Cod_artColor` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artColor` | int(10,0) | NULL | — | — |
| `Orden_Cod_artColor` | int(10,0) | NULL | — | — |
| `usar_Cod_artUbicacion` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artUbicacion` | int(10,0) | NULL | — | — |
| `Orden_Cod_artUbicacion` | int(10,0) | NULL | — | — |
| `usar_Cod_artProc` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artProc` | int(10,0) | NULL | — | — |
| `Orden_Cod_artProc` | int(10,0) | NULL | — | — |
| `usar_Cod_artItem` | bit(1,0) | NOT NULL | — | — |
| `Long_Cod_artItem` | int(10,0) | NULL | — | — |
| `Orden_Cod_artItem` | int(10,0) | NULL | — | — |
| `maneja_serial` | bit(1,0) | NULL | — | — |
| `maneja_lote` | bit(1,0) | NULL | — | — |
| `maneja_lote_venc` | bit(1,0) | NULL | — | — |
| `tipo_imp` | char(1) | NULL | — | — |
| `tipo_imp2` | char(1) | NULL | — | — |
| `tipo_imp3` | char(1) | NULL | — | — |
| `co_reten` | char(6) | NULL | — | FK → `saConISLR.co_islr` |
| `garantia` | varchar(30) | NULL | — | — |
| `volumen` | decimal(18,5) | NULL | — | — |
| `peso` | decimal(18,5) | NULL | — | — |
| `stock_min` | decimal(18,5) | NULL | — | — |
| `stock_max` | decimal(18,5) | NULL | — | — |
| `stock_pedido` | decimal(18,5) | NULL | — | — |
| `desc_art_libre` | int(10,0) | NULL | — | — |
| `procesado` | bit(1,0) | NULL | — | — |
| `prec_om` | bit(1,0) | NULL | — | — |
| `comentario` | varchar(max) | NULL | — | — |
| `tipo_cos` | char(4) | NULL | — | — |
| `co_alma` | char(6) | NULL | — | FK → `saAlmacen.co_alma` |
| `reten_iva_tercero` | char(16) | NULL | — | FK → `saProveedor.co_prov` |
| `campo1` | varchar(60) | NULL | — | — |
| `campo2` | varchar(60) | NULL | — | — |
| `campo3` | varchar(60) | NULL | — | — |
| `campo4` | varchar(60) | NULL | — | — |
| `campo5` | varchar(60) | NULL | — | — |
| `campo6` | varchar(60) | NULL | — | — |
| `campo7` | varchar(60) | NULL | — | — |
| `campo8` | varchar(60) | NULL | — | — |
| `Artcampo1` | varchar(60) | NULL | — | — |
| `Artcampo2` | varchar(60) | NULL | — | — |
| `Artcampo3` | varchar(60) | NULL | — | — |
| `Artcampo4` | varchar(60) | NULL | — | — |
| `Artcampo5` | varchar(60) | NULL | — | — |
| `Artcampo6` | varchar(60) | NULL | — | — |
| `Artcampo7` | varchar(60) | NULL | — | — |
| `Artcampo8` | varchar(60) | NULL | — | — |
| `co_us_in` | char(6) | NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NULL | — | — |
| `co_us_mo` | char(6) | NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NULL | — | — |
| `rowguid` | uniqueidentifier | NULL | — | — |

## Triggers Relacionados
- `ValidarsaArtCrearAut`

## Foreign Keys (explícitas)
- `FK_saArtCrearAut_Alma`: `co_alma` → `saAlmacen.co_alma`
- `FK_saArtCrearAut_saCatArticulo`: `co_cat_desde` → `saCatArticulo.co_cat`
- `FK_saArtCrearAut_saCatArticulo_Hasta`: `co_cat_hasta` → `saCatArticulo.co_cat`
- `FK_saArtCrearAut_saColor_Desde`: `co_color_desde` → `saColor.co_color`
- `FK_saArtCrearAut_saColor_Hasta`: `co_color_hasta` → `saColor.co_color`
- `FK_saArtCrearAut_saConISLR`: `co_reten` → `saConISLR.co_islr`
- `FK_saArtCrearAut_saProcedencia_Desde`: `co_proc_desde` → `saProcedencia.cod_proc`
- `FK_saArtCrearAut_saProcedencia_Hasta`: `co_proc_hasta` → `saProcedencia.cod_proc`
- `FK_saArtCrearAut_saProveedor`: `reten_iva_tercero` → `saProveedor.co_prov`
- `FK_saArtCrearAut_saSubLinea_Desde`: `co_lin_desde` → `saSubLinea.co_lin`
- `FK_saArtCrearAut_saSubLinea_Desde`: `co_subl_desde` → `saSubLinea.co_subl`
- `FK_saArtCrearAut_saSubLinea_Hasta`: `co_lin_hasta` → `saSubLinea.co_lin`
- `FK_saArtCrearAut_saSubLinea_Hasta`: `co_subl_hasta` → `saSubLinea.co_subl`
- `FK_saArtCrearAut_saUbicacion_Desde`: `co_ubicacion_desde` → `saUbicacion.co_ubicacion`
- `FK_saArtCrearAut_saUbicacion_Hasta`: `co_ubicacion_hasta` → `saUbicacion.co_ubicacion`
- `FK_saArtCrearAut_Uni`: `co_uni` → `saUnidad.co_uni`
