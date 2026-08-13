# Tabla: saPedidoVenta
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `doc_num` | char(20) | NOT NULL | b'Numero de documento' | — |
| `descrip` | varchar(60) | NULL | b'Descripci\xc3\xb3n del registro o documento' | — |
| `co_cli` | char(16) | NOT NULL | b'Codigo de Cliente' | FK → `saCliente.co_cli` |
| `co_tran` | char(6) | NOT NULL | b'Codigo de transporte' | FK → `saTransporte.co_tran` |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `co_ven` | char(6) | NOT NULL | b'Codigo de vendedor' | FK → `saVendedor.co_ven` |
| `co_cond` | char(6) | NULL | b'Codigo de Condicion de Pago' | FK → `saCondicionPago.co_cond` |
| `fec_emis` | smalldatetime(16,0) | NOT NULL | b'Fecha de emision' | — |
| `fec_venc` | smalldatetime(16,0) | NOT NULL | b'Fecha de vencimiento' | — |
| `fec_reg` | smalldatetime(16,0) | NOT NULL | b'Fecha de registro' | — |
| `anulado` | bit(1,0) | NOT NULL | b'Indica si el registro7documento esta anulado' | — |
| `status` | char(1) | NULL | b'0: no procesada, 1: parcialmente procesada: 2: procesada totalmente' | — |
| `n_control` | varchar(20) | NULL | b'Numero de control' | — |
| `ven_ter` | bit(1,0) | NOT NULL | b'Venta realizada por un tercero (usado en libro de venta)' | — |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `porc_desc_glob` | varchar(15) | NULL | b'Porcentaje de descuento global' | — |
| `monto_desc_glob` | decimal(18,2) | NOT NULL | b'Monto de descuento global' | — |
| `porc_reca` | varchar(15) | NULL | b'Porcentaje de recargo' | — |
| `monto_reca` | decimal(18,2) | NOT NULL | b'Monto de recargo' | — |
| `total_bruto` | decimal(18,2) | NOT NULL | b'Monto total bruto del documento' | — |
| `monto_imp` | decimal(18,2) | NOT NULL | b'Monto de impuesto (1) aplicado' | — |
| `monto_imp2` | decimal(18,2) | NOT NULL | b'Monto de impuesto (2) aplicado' | — |
| `monto_imp3` | decimal(18,2) | NOT NULL | b'Monto de impuesto (3) aplicado' | — |
| `otros1` | decimal(18,2) | NOT NULL | b'Monto otro 1' | — |
| `otros2` | decimal(18,2) | NOT NULL | b'Monto otro 2' | — |
| `otros3` | decimal(18,2) | NOT NULL | b'Monto otro 3' | — |
| `total_neto` | decimal(18,2) | NOT NULL | b'Monto total neto del documento' | — |
| `saldo` | decimal(18,2) | NOT NULL | b'Monto del saldo del documento' | — |
| `dir_ent` | varchar(max) | NULL | b'Direccion de entrega' | — |
| `comentario` | varchar(max) | NULL | b'Comentario' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `contrib` | bit(1,0) | NOT NULL | b'Indica si el documento fue emitido a un contibuyente' | — |
| `impresa` | bit(1,0) | NOT NULL | b'Marca que identifica si el documento fue impreso' | — |
| `seriales_s` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
| `salestax` | char(8) | NULL | b'Reservado para futuras implementaciones' | FK → `saTax.tax_id` |
| `impfis` | varchar(20) | NULL | b'Serial de la impresora por la que se emitio la factura (reservado para futuras imlpementaciones)' | — |
| `impfisfac` | varchar(20) | NULL | b'Numero de factura fiscal' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
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
| `co_cta_ingr_egr` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |

## Triggers Relacionados
- `TrigEstado_saPedidoVenta`

## Foreign Keys (explícitas)
- `FK_saPedidoVenta_saCliente`: `co_cli` → `saCliente.co_cli`
- `FK_saPedidoVenta_saCondicionPago`: `co_cond` → `saCondicionPago.co_cond`
- `FK_saPedidoVenta_saMoneda`: `co_mone` → `saMoneda.co_mone`
- `FK_saPedidoVenta_saTax`: `salestax` → `saTax.tax_id`
- `FK_saPedidoVenta_saTransporte`: `co_tran` → `saTransporte.co_tran`
- `FK_saPedidoVenta_saVendedor`: `co_ven` → `saVendedor.co_ven`
- `FK_saPedidoVenta_saCuentaIngEgr`: `co_cta_ingr_egr` → `saCuentaIngEgr.co_cta_ingr_egr`
