# Tabla: saOrdenCompraReng
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `doc_num` | char(20) | NOT NULL | b'Numero de documento' | FK → `saOrdenCompra.doc_num` |
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArtUnidad.co_art` |
| `des_art` | varchar(120) | NULL | b'Descripcion adicional del articulo' | — |
| `co_uni` | char(6) | NOT NULL | b'Codigo de la unidad' | FK → `saArtUnidad.co_uni` |
| `sco_uni` | char(6) | NULL | b'Codigo de la unidad secundaria' | FK → `saArtUnidad.co_uni` |
| `co_alma` | char(6) | NOT NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |
| `tipo_imp` | char(1) | NOT NULL | b'Tipo de impuesto (1) aplicado' | — |
| `tipo_imp2` | char(1) | NULL | b'Tipo de impuesto (2) aplicado' | — |
| `tipo_imp3` | char(1) | NULL | b'Tipo de impuesto (3) aplicado' | — |
| `tipo_doc` | char(4) | NULL | b'Tipo documento de origen, FACT: Factura de Venta, NENT: Nota de Entrega, DCLI: Devolucion de Cliente, COMP: Factura de Compra, NREC: Nota de Recepcion, DPRO: Devolucion a Proveedor OCOM: Orden de Compra, CPRO: Cotizacion de Compra, PCOM: Plantilla de Compra, PCLI: Pedido de CLiente, CCLI: Cotizacion a Cliente,NDES: Nota de Despacho, PVEN: Plantilla de Venta, AJUE: Ajuste de Entrada, AJUS: Ajuste de Salida, TRAE: Traslado de Entrada, TRAS: Traslado de Salida, GCOM: Generacion de Compuesto, RGEN: Renglones de Compuesto' | — |
| `porc_desc` | varchar(15) | NULL | b'Porcentaje de descuento' | — |
| `num_doc` | varchar(20) | NULL | b'Numero de documento del cual fue importado (referencia, usar rowguid_doc)' | — |
| `rowguid_doc` | uniqueidentifier | NULL | — | — |
| `reng_neto` | decimal(18,2) | NOT NULL | b'Monto neto del renglon' | — |
| `cost_unit` | decimal(18,5) | NOT NULL | b'Costo unitario' | — |
| `cost_unit_om` | decimal(18,5) | NOT NULL | b'Costo unitario en otra moneda (reservado para futuras implementaciones)' | — |
| `total_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `stotal_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos (en unidad secundaria) del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `otros` | decimal(18,5) | NOT NULL | b'Monto correspondiente a otros' | — |
| `porc_imp` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (1) aplicado' | — |
| `porc_imp2` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (2) aplicado' | — |
| `porc_imp3` | decimal(18,5) | NOT NULL | b'Porcentaje de impuesto (3) aplicado' | — |
| `monto_imp` | decimal(18,5) | NOT NULL | b'Monto de impuesto (1) aplicado' | — |
| `monto_imp2` | decimal(18,5) | NOT NULL | b'Monto de impuesto (2) aplicado' | — |
| `monto_imp3` | decimal(18,5) | NOT NULL | b'Monto de impuesto (3) aplicado' | — |
| `porc_gas` | decimal(18,2) | NOT NULL | b'Porcentaje de arancel' | — |
| `total_dev` | decimal(18,5) | NOT NULL | b'Cantidad devuelta' | — |
| `monto_dev` | decimal(18,5) | NOT NULL | b'Reservado para futuras implementaciones' | — |
| `lote_asignado` | bit(1,0) | NOT NULL | b'Posee asignado informacion de lotes' | — |
| `monto_desc_glob` | decimal(18,5) | NOT NULL | b'Monto de descuento global' | — |
| `monto_reca_glob` | decimal(18,5) | NOT NULL | — | — |
| `otros1_glob` | decimal(18,5) | NOT NULL | — | — |
| `otros2_glob` | decimal(18,5) | NOT NULL | — | — |
| `otros3_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_imp_afec_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_imp2_afec_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_imp3_afec_glob` | decimal(18,5) | NOT NULL | — | — |
| `monto_desc` | decimal(18,5) | NOT NULL | b'Monto del descuento aplicado' | — |
| `pendiente` | decimal(18,5) | NOT NULL | b'Cantidad pendiente por exportar a otros documentos' | — |
| `pendiente2` | decimal(18,5) | NOT NULL | b'Reservado para futruras implementaciones' | — |
| `comentario` | varchar(max) | NULL | b'Comentario' | — |
| `costo_adi1` | decimal(18,5) | NOT NULL | b'Costo promedio unitario' | — |
| `costo_adi2` | decimal(18,5) | NOT NULL | b'Ultimo costo Otra moneda' | — |
| `costo_adi3` | decimal(18,5) | NOT NULL | b'Costo Promedio Otra Moneda' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saOrdenCompraReng_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saOrdenCompraReng_saArtUnidad`: `co_art` → `saArtUnidad.co_art`
- `FK_saOrdenCompraReng_saArtUnidad`: `co_uni` → `saArtUnidad.co_uni`
- `FK_saOrdenCompraReng_saArtUnidadSecundaria`: `co_art` → `saArtUnidad.co_art`
- `FK_saOrdenCompraReng_saArtUnidadSecundaria`: `sco_uni` → `saArtUnidad.co_uni`
- `FK_saOrdenCompraReng_saOrdenCompra`: `doc_num` → `saOrdenCompra.doc_num`
