# Tabla: par_emp
**Módulo**: Sistema
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_emp` | char(20) | NOT NULL | b'C\xc3\xb3digo de la empresa' | — |
| `tab_num` | int(10,0) | NOT NULL | b'Compatibilidad con versiones anteriores' | — |
| `logo` | varbinary | NULL | b'Logo' | — |
| `fecha_res` | smalldatetime(16,0) | NOT NULL | b'Compatibilidad con versiones anteriores' | — |
| `temp_char1` | varchar(20) | NULL | b'Parametros Especiales Valor 1' | — |
| `temp_char2` | varchar(20) | NULL | b'Parametros Especiales Valor 2' | — |
| `temp_char3` | varchar(20) | NULL | b'Parametros Especiales Valor3' | — |
| `temp_char4` | varchar(20) | NULL | b'Parametros Especiales Valor 4' | — |
| `temp_char5` | varchar(20) | NULL | b'Parametros Especiales Valor 5' | — |
| `temp_char6` | varchar(20) | NULL | b'Parametros Especiales Valor 6' | — |
| `temp_char7` | varchar(20) | NULL | b'Parametros Especiales Valor 7' | — |
| `temp_char8` | varchar(20) | NULL | b'Parametros Especiales Valor 8' | — |
| `temp_fech` | smalldatetime(16,0) | NOT NULL | b'Parametros Especiales Fecha' | — |
| `temp_num` | int(10,0) | NOT NULL | b'Parametros Especiales Correlativo' | — |
| `emp_adm` | varchar(250) | NULL | b'Camino de la empresa, Integracion Administrativo' | — |
| `emp_cont` | varchar(250) | NULL | b'Camino de la empresa, Integracion Contabilidad' | — |
| `emp_nom` | varchar(250) | NULL | b'Camino de la empresa, Integracion Nomina' | — |
| `urlservidorweb_admin` | varchar(128) | NULL | b'Direcci\xc3\xb3n URL de Sistema Administrativo al cual se va a integrar' | — |
| `urlservidorweb_cont` | varchar(128) | NULL | b'Direcci\xc3\xb3n URL de Sistema de Contabilidad al cual se va a integrar' | — |
| `urlservidorweb_nom` | varchar(128) | NULL | b'Direcci\xc3\xb3n URL de Sistema de Nomina al cual se va a integrar' | — |
| `tipo_imp_prov_ext` | char(1) | NULL | b'Proveedor Extranjero (Tipo de I.V.A.)' | — |
| `netTcp_admin` | bit(1,0) | NOT NULL | b'Indica si el producto administrativo usa el protocolo nettcp para la transmisi\xc3\xb3n de mensajes con el servidor' | — |
| `netTcp_cont` | bit(1,0) | NOT NULL | b'Indica si el producto contabilidad usa el protocolo nettcp para la transmisi\xc3\xb3n de mensajes con el servidor' | — |
| `netTcp_nom` | bit(1,0) | NOT NULL | b'Indica si el producto n\xc3\xb3mina usa el protocolo nettcp para la transmisi\xc3\xb3n de mensajes con el servidor' | — |
| `login_admin` | char(32) | NULL | b'Usuario del WebService para la integraci\xc3\xb3n con Administrativo' | — |
| `password_admin` | char(128) | NULL | b'Contrase\xc3\xb1a del WebService para la integraci\xc3\xb3n con Administrativo' | — |
| `login_cont` | char(32) | NULL | b'Usuario del WebService para la integraci\xc3\xb3n con Contabilidad' | — |
| `password_cont` | char(128) | NULL | b'Contrase\xc3\xb1a del WebService para la integraci\xc3\xb3n con Contabilidad' | — |
| `login_nom` | char(32) | NULL | b'Usuario del WebService para la integraci\xc3\xb3n con Nomina' | — |
| `password_nom` | char(128) | NULL | b'Contrase\xc3\xb1a del WebService para la integraci\xc3\xb3n con Nomina' | — |
| `fec_cont` | smalldatetime(16,0) | NOT NULL | b'Fecha de la \xc3\xbaltima contabilizaci\xc3\xb3n' | — |
| `co_cue_aju` | char(20) | NULL | b'C\xc3\xb3digo de la cuenta de ajuste por diferencia' | — |
| `tempor1` | int(10,0) | NOT NULL | b'*' | — |
| `g_moneda` | char(6) | NOT NULL | b'Moneda Base del Sistema. Ant\xc3\xadguo moneda' | — |
| `g_mostrar_modelo` | bit(1,0) | NOT NULL | b'Indica si se va mostrar el campo modelo en los art\xc3\xadculos y reportes. (False No mostrar, True Si mostrar). Ant\xc3\xadguo p_para1 (obsoleto no se usa)' | — |
| `g_alerta_f` | int(10,0) | NOT NULL | b'Declaraci\xc3\xb3n de Planilla fiscal (Permitir = 0, mostrar mensaje de advertencia = 1, no permitir = 2)' | — |
| `p_desc_art` | bit(1,0) | NOT NULL | — | — |
| `p_desc_cat` | bit(1,0) | NOT NULL | — | — |
| `p_desc_glo` | bit(1,0) | NOT NULL | — | — |
| `p_desc_lin` | bit(1,0) | NOT NULL | — | — |
| `v_redondeo` | bit(1,0) | NOT NULL | b'Permite redondeo en las ventas' | — |
| `v_tipo_redondeo` | int(10,0) | NOT NULL | b'Tiop de redondeo en ventas (Equitativo = 0, Superior = 1, Inferior = 2)' | — |
| `v_valor_redondeo` | char(4) | NULL | — | — |
| `c_redondeo` | bit(1,0) | NOT NULL | b'Permite redondeo en las compras' | — |
| `c_tipo_redondeo` | int(10,0) | NOT NULL | b'Tipo de redondeo en compras(Equitativo = 0, Superior = 1, Inferior = 2)' | — |
| `c_valor_redondeo` | char(4) | NULL | — | — |
| `v_maneja_sucursales` | bit(1,0) | NOT NULL | b'Indica si la empresa maneja sucursales  (False No maneja, True Si maneja). Ant\xc3\xadguo p_sucursal' | — |
| `v_concepto_despacho` | bit(1,0) | NOT NULL | — | — |
| `v_manejo_direccion_entrega` | bit(1,0) | NOT NULL | — | — |
| `v_tip_cli` | char(6) | NULL | b'Tipo de Cliente por defecto para cliente generico' | FK → `saTipoCliente.tip_cli` |
| `v_co_ven` | char(6) | NULL | b'Codigo del Vendedor por defecto para cliente generico' | FK → `saVendedor.co_ven` |
| `v_cond_pago` | char(6) | NULL | b'Codigo de la condicion de pago por defecto para cliente generico' | FK → `saCondicionPago.co_cond` |
| `v_cta_ing_egr` | char(20) | NULL | b'Cuenta de ingreso egreso por defecto para cliente generico' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `v_co_seg` | char(6) | NULL | b'Codigo del segmento por defecto para cliente generico' | FK → `saSegmento.co_seg` |
| `v_co_zon` | char(6) | NULL | b'codigo de la Zona por defecto para cliente generico' | FK → `saZona.co_zon` |
| `v_tipo_per` | char(1) | NULL | b'Tipo de persona por defecto para cliente generico' | — |
| `i_stock_negativo_advertencia` | bit(1,0) | NOT NULL | — | — |
| `i_stock_negativo` | bit(1,0) | NOT NULL | b'Indica si la empresa maneja stock negativo. (False No maneja, True Si maneja). Ant\xc3\xadguo p_stock_neg' | — |
| `i_dec_stock` | int(10,0) | NOT NULL | b'Cantidad de D\xc3\xa9cimales en existencia. Ant\xc3\xadguo cant_art' | — |
| `i_dec_costo` | int(10,0) | NOT NULL | b'Cantidad de D\xc3\xa9cimales en Costos. Ant\xc3\xadguo dec_cost' | — |
| `i_dec_precio` | int(10,0) | NOT NULL | b'Cantidad de D\xc3\xa9cimales en Precios. Ant\xc3\xadguo dec_prec' | — |
| `i_multiple_moneda` | bit(1,0) | NOT NULL | b'Indica si maneja m\xc3\xbaltiples monedas. (False No maneja, True Si maneja). Ant\xc3\xadguo p_cyf_dol' | — |
| `i_moneda_articulo` | char(6) | NULL | b'Moneda adicional para costos/precios. Ant\xc3\xadguo mone_art' | — |
| `i_seriales_articulo` | bit(1,0) | NOT NULL | b'No permitir el mismo serial en diferentes art\xc3\xadculos. (False No lo permite, True Si lo permite). Ant\xc3\xadguo p_ser_art' | — |
| `i_licores` | bit(1,0) | NOT NULL | b'Indica si maneja impuesto a licores. (False No manjea, True Si maneja). Ant\xc3\xadguo p_licores' | — |
| `i_tipo_cost_dev` | int(10,0) | NOT NULL | b'Tipo de costo para devoluciones. (0.Tradicional, 1.Afecta Promedio). Ant\xc3\xadguo tipcosdev' | — |
| `i_maneja_lotes_vencidos` | bit(1,0) | NOT NULL | b'Indica si maneja lote vencido. (False No maneja, True Si maneja). p_lotefec' | — |
| `i_costo_inventario` | int(10,0) | NOT NULL | b'Determina el tipo de costo para inventario. 3-UEPS, 2-PEPS, 1-Costo Promedio y Ultimo Costo' | — |
| `i_permitir_fec_menor_ult_inv` | bit(1,0) | NOT NULL | — | — |
| `i_manejo_art_comp` | int(10,0) | NULL | b'Permiso para modificar definiciones de art\xc3\xadculos compuestos con movimientos (0: Permitir, 1: Advertir, 2: Denegar)' | — |
| `c_margen_costo_precio` | bit(1,0) | NOT NULL | b'Indica si el margen de ganancia se calcula de costo a precio' | — |
| `c_tip_pro` | char(6) | NULL | b'Tipo de Proveedor por defecto para proveedor gen\xc3\xa9rico' | FK → `saTipoProveedor.tip_pro` |
| `c_cond_pago` | char(6) | NULL | b'Condicion de pago por defecto para proveedor gen\xc3\xa9rico' | FK → `saCondicionPago.co_cond` |
| `c_cta_ing_egr` | char(20) | NULL | b'Cuenta de Ingreso y Egreso por defecto para proveedor gen\xc3\xa9rico' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `c_co_seg` | char(6) | NULL | b'Codigo de Segmento por defecto para proveedor gen\xc3\xa9rico' | FK → `saSegmento.co_seg` |
| `c_co_zon` | char(6) | NULL | b'Codigo de Zona por defecto para proveedor gen\xc3\xa9rico' | FK → `saZona.co_zon` |
| `c_tipo_per` | char(1) | NULL | b'Tipo de persona por defecto para proveedor gen\xc3\xa9rico' | — |
| `cb_canc_comp_ord_pag` | bit(1,0) | NOT NULL | b'Pertenece al modulo Caja y Banco. Indica si se permite cancelar s\xc3\xb3lo compras y \xc3\xb3rdenes de pago programadas.' | — |
| `cb_manej_imp_tran` | bit(1,0) | NOT NULL | b'Pertenece al modulo Caja y Banco. Indica si se realiza el manejo del impuesto a las transacciones financieras (I.T.F.)' | — |
| `cb_impre_fis` | bit(1,0) | NOT NULL | b'Pertenece al modulo Caja y Banco. Indica si se activa el manejo de impresoras fiscales.' | — |
| `v_max_reng` | int(10,0) | NOT NULL | b'Cantidad de renglones por factura' | — |
| `v_max_reng_todos` | bit(1,0) | NOT NULL | b'Verificar para todos los documentos cantidad de renglones por factura' | — |
| `lotes_despacho` | bit(1,0) | NOT NULL | — | — |
| `seriales_despacho` | bit(1,0) | NOT NULL | — | — |
| `format1` | char(2) | NULL | b'Campos Adicionales..................................' | — |
| `format2` | char(2) | NULL | b'Campos Adicionales.' | — |
| `format3` | char(2) | NULL | b'Campos Adicionales' | — |
| `format4` | char(2) | NULL | b'Campos Adicionales' | — |
| `format5` | char(2) | NULL | b'Campos Adicionales' | — |
| `co_sucur` | char(6) | NULL | — | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional.' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional.' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NULL | b'Identificador Unico' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `imp_vend` | bit(1,0) | NULL | — | — |
| `imp_turno` | bit(1,0) | NULL | — | — |
| `imp_numfac` | bit(1,0) | NULL | — | — |
| `imp_caja` | bit(1,0) | NULL | — | — |
| `imp_suc` | bit(1,0) | NULL | — | — |
| `imp_cajero` | bit(1,0) | NULL | — | — |
| `c_co_pais` | char(6) | NULL | — | — |
| `v_co_pais` | char(6) | NULL | — | — |
| `cb_sujt_reten` | bit(1,0) | NOT NULL | — | — |
| `cb_reten` | decimal(18,2) | NOT NULL | — | — |
| `tipo_imagen` | char(30) | NULL | — | — |
| `tamaño_imagen` | int(10,0) | NULL | — | — |
| `co_uni_peso` | char(6) | NULL | — | FK → `saUnidad.co_uni` |
| `co_uni_volumen` | char(6) | NULL | — | FK → `saUnidad.co_uni` |
| `c_reten_auto` | int(10,0) | NULL | b'0: No realiza retenci\xc3\xb3n autom\xc3\xa1ticamente, 1: Advierte por medio de un mensaje sobre si se realizara retenci\xc3\xb3n autom\xc3\xa1ticamente, 2: Realiza la retenci\xc3\xb3n autom\xc3\xa1ticamente' | — |
| `correoservidor` | char(512) | NULL | — | — |
| `correodir` | char(60) | NULL | — | — |
| `correossl` | bit(1,0) | NOT NULL | — | — |
| `correopuerto` | int(10,0) | NOT NULL | — | — |
| `correometodo_ent` | smallint(5,0) | NOT NULL | — | — |
| `correotiempo_exp` | smallint(5,0) | NOT NULL | — | — |
| `correocredencial_def` | bit(1,0) | NOT NULL | — | — |
| `correousuario` | varchar(128) | NULL | — | — |
| `correopass` | varchar(128) | NULL | — | — |
| `c_retenISLR_auto` | int(10,0) | NULL | b'0: No realiza retenci\xc3\xb3n autom\xc3\xa1ticamente, 1: Advierte por medio de un mensaje sobre si se realizara retenci\xc3\xb3n autom\xc3\xa1ticamente, 2: Realiza la retenci\xc3\xb3n autom\xc3\xa1ticamente' | — |
| `v_reconv` | bit(1,0) | NOT NULL | — | — |
| `v_maneja_ncf` | bit(1,0) | NOT NULL | — | — |
| `pto_emision` | char(3) | NULL | — | — |
| `area_imp` | char(3) | NULL | — | — |
| `cb_manej_imp_cuenta` | int(10,0) | NULL | b'(0)No maneja IGTF, (1) Maneja IGTF global, (2) Maneja IGTF por cuenta ' | — |
| `percepcion_igtf` | int(10,0) | NOT NULL | b'(0) No ejecuta el proceso de percepci\xc3\xb3n IGTF' | — |
| `v_asigna_tck` | bit(1,0) | NOT NULL | — | — |
| `v_validar_nro_control` | bit(1,0) | NOT NULL | b'Validar Nro de Control duplicados ( ventas) ' | — |
| `c_validar_nro_control` | bit(1,0) | NOT NULL | b'Validar Nro de Control duplicados ( compras) ' | — |
| `maneja_impdig` | bit(1,0) | NOT NULL | — | — |
| `imprentName` | varchar(16) | NULL | — | — |
| `fecha_desde` | datetime(23,3) | NOT NULL | — | — |
| `v_validar_total_reng_doc` | bit(1,0) | NOT NULL | — | — |
| `imp_cod_des` | int(10,0) | NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_par_emp_saUnidadPeso`: `co_uni_peso` → `saUnidad.co_uni`
- `FK_par_emp_saUnidadVolumen`: `co_uni_volumen` → `saUnidad.co_uni`
- `FK_par_emp_saCondicionPago_C`: `c_cond_pago` → `saCondicionPago.co_cond`
- `FK_par_emp_saCondicionPago_V`: `v_cond_pago` → `saCondicionPago.co_cond`
- `FK_par_emp_saCuentaIngEgr_C`: `c_cta_ing_egr` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_par_emp_saCuentaIngEgr_V`: `v_cta_ing_egr` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_par_emp_saSegmento_C`: `c_co_seg` → `saSegmento.co_seg`
- `FK_par_emp_saSegmento_V`: `v_co_seg` → `saSegmento.co_seg`
- `FK_par_emp_saTipoCliente`: `v_tip_cli` → `saTipoCliente.tip_cli`
- `FK_par_emp_saTipoProveedor`: `c_tip_pro` → `saTipoProveedor.tip_pro`
- `FK_par_emp_saVendedor`: `v_co_ven` → `saVendedor.co_ven`
- `FK_par_emp_saZona_C`: `c_co_zon` → `saZona.co_zon`
- `FK_par_emp_saZona_V`: `v_co_zon` → `saZona.co_zon`
