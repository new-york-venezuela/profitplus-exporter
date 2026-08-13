# Tabla: saPlantillaCompra
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `doc_num` | char(20) | NOT NULL | b'Numero de documento' | — |
| `nro_fact` | varchar(20) | NULL | — | — |
| `descrip` | varchar(60) | NULL | b'Descripci\xc3\xb3n del registro o documento' | — |
| `co_prov` | char(16) | NOT NULL | b'Codigo de Proveedor' | FK → `saProveedor.co_prov` |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `co_cond` | char(6) | NULL | b'Codigo de Condicion de Pago' | FK → `saCondicionPago.co_cond` |
| `porc_desc_glob` | varchar(15) | NULL | b'Porcentaje de descuento global' | — |
| `porc_reca` | varchar(15) | NULL | b'Porcentaje de recargo' | — |
| `status` | char(1) | NULL | b'0: no procesada, 1: parcialmente procesada: 2: procesada totalmente' | — |
| `n_control` | varchar(20) | NULL | b'Numero de control' | — |
| `fec_emis` | smalldatetime(16,0) | NOT NULL | b'Fecha de emision' | — |
| `fec_venc` | smalldatetime(16,0) | NOT NULL | b'Fecha de vencimiento' | — |
| `fec_reg` | smalldatetime(16,0) | NOT NULL | b'Fecha de registro' | — |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `saldo` | decimal(18,2) | NOT NULL | b'Monto del saldo del documento' | — |
| `total_bruto` | decimal(18,2) | NOT NULL | b'Monto total bruto del documento' | — |
| `total_neto` | decimal(18,2) | NOT NULL | b'Monto total neto del documento' | — |
| `monto_desc_glob` | decimal(18,2) | NOT NULL | b'Monto de descuento global' | — |
| `monto_reca` | decimal(18,2) | NOT NULL | b'Monto de recargo' | — |
| `otros1` | decimal(18,2) | NOT NULL | b'Monto otro 1' | — |
| `otros2` | decimal(18,2) | NOT NULL | b'Monto otro 2' | — |
| `otros3` | decimal(18,2) | NOT NULL | b'Monto otro 3' | — |
| `monto_imp` | decimal(18,2) | NOT NULL | b'Monto de impuesto (1) aplicado' | — |
| `monto_imp2` | decimal(18,2) | NOT NULL | b'Monto de impuesto (2) aplicado' | — |
| `monto_imp3` | decimal(18,2) | NOT NULL | b'Monto de impuesto (3) aplicado' | — |
| `anulado` | bit(1,0) | NOT NULL | b'Indica si el registro7documento esta anulado' | — |
| `impresa` | bit(1,0) | NOT NULL | b'Marca que identifica si el documento fue impreso' | — |
| `seriales_e` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
| `salestax` | char(8) | NULL | b'Reservado para futuras implementaciones' | FK → `saTax.tax_id` |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `dir_ent` | varchar(max) | NULL | b'Direccion de entrega' | — |
| `comentario` | varchar(max) | NULL | b'Comentario' | — |
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
| `nac` | bit(1,0) | NULL | — | — |

## Triggers Relacionados
- `TrigEstado_saPlantillaCompra`

## Foreign Keys (explícitas)
- `FK_saPlantillaCompra_saCondicionPago`: `co_cond` → `saCondicionPago.co_cond`
- `FK_saPlantillaCompra_saMoneda`: `co_mone` → `saMoneda.co_mone`
- `FK_saPlantillaCompra_saProveedor`: `co_prov` → `saProveedor.co_prov`
- `FK_saPlantillaCompra_saTax`: `salestax` → `saTax.tax_id`
