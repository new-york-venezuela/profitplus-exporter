# Tabla: saDocumentoVentaReng
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `co_tipo_doc` | char(6) | NOT NULL | b'Tipo documento de donde fu\xc3\xa9 importado' | FK → `saDocumentoVenta.co_tipo_doc` |
| `nro_doc` | char(20) | NOT NULL | b'N\xc3\xbamero del Documento' | FK → `saDocumentoVenta.nro_doc` |
| `co_art` | char(30) | NULL | b'Codigo del articulo' | FK → `saArtUnidad.co_art` |
| `co_uni` | char(6) | NULL | b'Codigo de la unidad' | FK → `saArtUnidad.co_uni` |
| `co_alma` | char(6) | NULL | — | FK Implícita → `saAlmacen.co_alma` |
| `des_art` | varchar(120) | NULL | b'Descripcion adicional del articulo' | — |
| `porc_desc` | varchar(15) | NULL | — | — |
| `monto_desc` | decimal(18,5) | NOT NULL | — | — |
| `monto_desc_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_imp_afec_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_imp2_afec_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_imp3_afec_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_reca_glob` | decimal(18,5) | NOT NULL | — | — |
| `otros` | decimal(18,5) | NOT NULL | — | — |
| `otros1_glob` | decimal(18,5) | NOT NULL | — | — |
| `otros2_glob` | decimal(18,5) | NOT NULL | — | — |
| `otros3_glob` | decimal(18,5) | NOT NULL | — | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `total_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `co_precio` | char(6) | NULL | — | — |
| `prec_vta` | decimal(18,5) | NOT NULL | b'Precio de venta o compra' | — |
| `reng_neto` | decimal(18,2) | NOT NULL | b'Monto neto del renglon' | — |
| `tipo_imp` | char(1) | NULL | b'Tipo de impuesto (1) aplicado' | — |
| `tipo_imp2` | char(1) | NULL | b'Tipo de impuesto (2) aplicado' | — |
| `tipo_imp3` | char(1) | NULL | b'Tipo de impuesto (3) aplicado' | — |
| `porc_imp` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (1) aplicado' | — |
| `porc_imp2` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (2) aplicado' | — |
| `porc_imp3` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (3) aplicado' | — |
| `monto_imp` | decimal(18,5) | NOT NULL | b'Monto de impuesto (1) aplicado' | — |
| `monto_imp2` | decimal(18,5) | NOT NULL | b'Monto de impuesto (2) aplicado' | — |
| `monto_imp3` | decimal(18,5) | NOT NULL | b'Monto de impuesto (3) aplicado' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saDocumentoVentaReng_saArtUnidad`: `co_art` → `saArtUnidad.co_art`
- `FK_saDocumentoVentaReng_saArtUnidad`: `co_uni` → `saArtUnidad.co_uni`
- `FK_saDocumentoVentaReng_saDocumentoVenta`: `co_tipo_doc` → `saDocumentoVenta.co_tipo_doc`
- `FK_saDocumentoVentaReng_saDocumentoVenta`: `nro_doc` → `saDocumentoVenta.nro_doc`
