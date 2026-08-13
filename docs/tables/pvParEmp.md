# Tabla: pvParEmp
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_emp` | char(20) | NOT NULL | b'C\xc3\xb3digo de la empresa' | — |
| `cod_usu` | char(6) | NOT NULL | b'C\xc3\xb3digo Superusuario' | — |
| `co_cta_ingr_egr` | char(20) | NOT NULL | b'C\xc3\xb3digo de la cuenta de ingreso/egreso a transferir (Tabla saCuentaIngEgr)' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_cta_ingr_egr_FacDev` | char(20) | NOT NULL | b'C\xc3\xb3digo de la cuenta de ingreso/egreso a Factura y Devoluci\xc3\xb3n' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `cod_caja` | char(6) | NOT NULL | b'C\xc3\xb3digo caja principal a transferir' | FK → `saCaja.cod_caja` |
| `tf_vendedor` | bit(1,0) | NOT NULL | b'Mostrar configuraci\xc3\xb3n Vendedor' | — |
| `tf_num_turno` | bit(1,0) | NOT NULL | b'Mostrar configuraci\xc3\xb3n N\xc3\xbamero de Turno' | — |
| `tf_consecutivos` | bit(1,0) | NOT NULL | b'Mostrar configuraci\xc3\xb3n Consecutivos' | — |
| `tf_caja` | bit(1,0) | NOT NULL | b'Mostrar configuraci\xc3\xb3n Caja' | — |
| `tf_sucursal` | bit(1,0) | NOT NULL | b'Mostrar configuraci\xc3\xb3n Sucursal' | — |
| `tf_cajero` | bit(1,0) | NOT NULL | b'Mostrar configuraci\xc3\xb3n Cajero' | — |
| `tf_num_items` | bit(1,0) | NOT NULL | b'Mostrar n\xc3\xbamero de items' | — |
| `man_turno` | bit(1,0) | NOT NULL | b'Punto de Venta Maneja turno' | — |
| `manejo_identificadores` | bit(1,0) | NOT NULL | b'Permitir manejo de identificadores' | — |
| `co_imagen` | char(6) | NULL | b'C\xc3\xb3digo de la imagen' | — |
| `descrip_imagen` | varchar(120) | NULL | b'Menor resoluci\xc3\xb3n de la imagen' | — |
| `uso_ncr` | bit(1,0) | NOT NULL | b'Permitir uso de notas de cr\xc3\xa9dito' | — |
| `fp_efectivo` | bit(1,0) | NOT NULL | b'Permitir efectivo como forma de paGO-' | — |
| `fp_vale` | bit(1,0) | NOT NULL | b'Permitir vale de alimentaci\xc3\xb3n como forma de pago' | — |
| `fp_cheque` | bit(1,0) | NOT NULL | b'Permitir cheque como forma de pago' | — |
| `fp_tarjd` | bit(1,0) | NOT NULL | b'Permitir tarjeta de d\xc3\xa9bito como forma de pago' | — |
| `fp_tarjc` | bit(1,0) | NOT NULL | b'Permitir tarjeta de cr\xc3\xa9dito como forma de pago' | — |
| `monto_max_vuelto` | decimal(18,2) | NULL | b'Monto m\xc3\xa1ximo para el vuelto' | — |
| `monto_min_cheque` | decimal(18,2) | NULL | b'Monto m\xc3\xadnimo aceptado para pagos efectuados con cheque' | — |
| `monto_min_tarjd` | decimal(18,2) | NULL | b'Monto m\xc3\xadnimo aceptado para pagos efectuados con tarjeta de d\xc3\xa9bito' | — |
| `monto_min_tarjc` | decimal(18,2) | NULL | b'Monto m\xc3\xadnimo aceptado para pagos efectuados con tarjeta de cr\xc3\xa9dito' | — |
| `dev_efectivo` | bit(1,0) | NOT NULL | b'Permitir devoluci\xc3\xb3n de dinero con cobros hechos en efectivo' | — |
| `dev_cheque` | bit(1,0) | NOT NULL | b'Permitir devoluci\xc3\xb3n de dinero con cobros hechos en cheque' | — |
| `dev_tarjeta` | bit(1,0) | NOT NULL | b'Permitir devoluci\xc3\xb3n de dinero con cobros hechos con tarjetas' | — |
| `dev_ncr` | bit(1,0) | NOT NULL | b'Permitir devoluci\xc3\xb3n de dinero con cobros hechos con notas de c\xc3\xa9dito' | — |
| `dev_vale` | bit(1,0) | NOT NULL | b'Permitir devoluci\xc3\xb3n de dinero con cobros hechos con vales de alimentaci\xc3\xb3n' | — |
| `expre_reg_telef_val` | varchar(128) | NULL | b'Indica la expresion regular usada para el campo tel\xc3\xa9fono' | — |
| `expre_reg_telef_ejm` | varchar(64) | NULL | b'ejemplo de expresion regular para telefono' | — |
| `expre_reg_email_val` | varchar(128) | NULL | b'Indica la expresion regular usada para el campo email' | — |
| `expre_reg_email_ejm` | varchar(64) | NULL | b'ejemplo de expresion regular para email' | — |
| `tipo_cliente` | char(6) | NOT NULL | b'Tipo de cliente usado como referencia para la consulta de precios' | — |
| `etiqueta_impuesto` | varchar(12) | NULL | b'Identificaci\xc3\xb3n del nombre del impuesto a mostrar, dependiendo de la configuraci\xc3\xb3n regional de la aplicaci\xc3\xb3n' | — |
| `logo_empresa` | varchar(128) | NULL | b'Logo Empresa' | — |
| `autoriza_dev_efect` | bit(1,0) | NOT NULL | b'Solicitar autorizaci\xc3\xb3n para devoluciones de dinero en efectivo' | — |
| `dias_max_dev` | int(10,0) | NULL | b'D\xc3\xadas m\xc3\xa1ximos para devoluci\xc3\xb3n' | — |
| `monto_min_dev` | decimal(18,2) | NULL | b'Monto m\xc3\xadnimo en devoluciones' | — |
| `monto_max_dev` | decimal(18,2) | NULL | b'Monto m\xc3\xa1ximo en devoluciones' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que ingres\xc3\xb3 el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de inserci\xc3\xb3n del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que hizo la \xc3\xbaltima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue modificado por \xc3\xbaltima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la \xc3\xbaltima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | nchar | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador \xc3\xbanico' | — |
| `fp_efectivo_moneda2` | bit(1,0) | NULL | — | — |
| `uso_ncr_moneda2` | bit(1,0) | NULL | — | — |
| `fp_cheque_moneda2` | bit(1,0) | NULL | — | — |
| `monto_min_cheque_moneda2` | decimal(18,2) | NULL | — | — |
| `fp_tarjd_moneda2` | bit(1,0) | NULL | — | — |
| `monto_min_tarjd_moneda2` | decimal(18,2) | NULL | — | — |
| `fp_deposito_moneda2` | bit(1,0) | NULL | — | — |
| `monto_min_deposito_moneda2` | decimal(18,2) | NULL | — | — |
| `fp_transferencia_moneda2` | bit(1,0) | NULL | — | — |
| `monto_min_transferencia_moneda2` | decimal(18,2) | NULL | — | — |
| `fp_tarjc_moneda2` | bit(1,0) | NULL | — | — |
| `monto_min_tarjc_moneda2` | decimal(18,2) | NULL | — | — |
| `fp_vale_moneda2` | bit(1,0) | NULL | — | — |
| `monto_max_vuelto_moneda2` | decimal(18,2) | NULL | — | — |
| `cod_caja_moneda2` | char(6) | NULL | — | FK → `saCaja.cod_caja` |
| `co_cta_ingr_egr_moneda2` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_cta_ingr_egr_facdev_moneda2` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_cta_ingr_egr_banco_moneda2` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_Mone_moneda2` | char(6) | NULL | — | — |
| `fp_efectivo_moneda3` | bit(1,0) | NULL | — | — |
| `uso_ncr_moneda3` | bit(1,0) | NULL | — | — |
| `fp_cheque_moneda3` | bit(1,0) | NULL | — | — |
| `monto_min_cheque_moneda3` | decimal(18,2) | NULL | — | — |
| `fp_tarjd_moneda3` | bit(1,0) | NULL | — | — |
| `monto_min_tarjd_moneda3` | decimal(18,2) | NULL | — | — |
| `fp_deposito_moneda3` | bit(1,0) | NULL | — | — |
| `monto_min_deposito_moneda3` | decimal(18,2) | NULL | — | — |
| `fp_transferencia_moneda3` | bit(1,0) | NULL | — | — |
| `monto_min_transferencia_moneda3` | decimal(18,2) | NULL | — | — |
| `fp_tarjc_moneda3` | bit(1,0) | NULL | — | — |
| `monto_min_tarjc_moneda3` | decimal(18,2) | NULL | — | — |
| `fp_vale_moneda3` | bit(1,0) | NULL | — | — |
| `monto_max_vuelto_moneda3` | decimal(18,2) | NULL | — | — |
| `cod_caja_moneda3` | char(6) | NULL | — | FK → `saCaja.cod_caja` |
| `co_cta_ingr_egr_moneda3` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_cta_ingr_egr_facdev_moneda3` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_cta_ingr_egr_banco_moneda3` | char(20) | NULL | — | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_Mone_moneda3` | char(6) | NULL | — | — |
| `fp_deposito` | bit(1,0) | NOT NULL | — | — |
| `fp_transferencia` | bit(1,0) | NOT NULL | — | — |
| `monto_min_deposito` | decimal(18,2) | NULL | — | — |
| `monto_min_transferencia` | decimal(18,2) | NULL | — | — |
| `co_cta_ingr_egr_banco` | char(20) | NULL | — | — |
| `manejo_stock_negativo` | bit(1,0) | NOT NULL | — | — |
| `conf_fp` | varchar(60) | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_pvParEmp_saCuentaIngEgrFacDev`: `co_cta_ingr_egr_FacDev` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmpA_saCaja`: `cod_caja` → `saCaja.cod_caja`
- `FK_pvParEmpA_saCuentaIngEgr`: `co_cta_ingr_egr` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmp_saCaja_Moneda2`: `cod_caja_moneda2` → `saCaja.cod_caja`
- `FK_pvParEmp_saCaja_Moneda3`: `cod_caja_moneda3` → `saCaja.cod_caja`
- `FK_pvParEmp_saCuentaIngEgr_Moneda2`: `co_cta_ingr_egr_moneda2` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmp_saCuentaIngEgr_Moneda3`: `co_cta_ingr_egr_moneda3` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmp_saCuentaIngEgrFacDev_Moneda2`: `co_cta_ingr_egr_facdev_moneda2` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmp_saCuentaIngEgrFacDev_Moneda3`: `co_cta_ingr_egr_facdev_moneda3` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmp_saCuentaIngEgrBanco_Moneda2`: `co_cta_ingr_egr_banco_moneda2` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_pvParEmp_saCuentaIngEgrBanco_Moneda3`: `co_cta_ingr_egr_banco_moneda3` → `saCuentaIngEgr.co_cta_ingr_egr`
