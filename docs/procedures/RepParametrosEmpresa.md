# SP: RepParametrosEmpresa
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saPais`](../tables/saPais.md)
- [`saSegmento`](../tables/saSegmento.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saTipoProveedor`](../tables/saTipoProveedor.md)
- [`saUnidad`](../tables/saUnidad.md)
- [`saVendedor`](../tables/saVendedor.md)
- [`saZona`](../tables/saZona.md)
- [`scCuenta`](../tables/scCuenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date:	<21/01/2015>
-- Description:   <Reporte de Parametros de la Empresa>
-- LAST DATE:	2022-03-25
-- =============================================
CREATE PROCEDURE [dbo].[RepParametrosEmpresa]

      @sCampOrderBy VARCHAR(16) = NULL ,
	  @sDir VARCHAR(6) = NULL,
      @sNombreDBMaestra VARCHAR(max) = NULL,
	  @bHeaderRep BIT = 0

AS 

    BEGIN


        SET NOCOUNT ON ;

            declare @query NVARCHAR(max)
            set @query = 'select co_fijo, co_grupo, desc_fijo, producto from '+ @sNombreDBMaestra +'.[dbo].[MpFijo]'

DECLARE @TablaFijos TABLE
            (
              co_fijo char(4) ,
                    co_grupo char(3),
              desc_fijo varchar(60),
                    producto char(6)
            )

insert into 
@TablaFijos
EXEC sp_executesql @query

        SELECT
      PE.cod_emp, PE.tab_num, PE.logo, PE.fecha_res, PE.temp_char1, PE.temp_char2, PE.temp_char3,
      PE.temp_char4, PE.temp_char5, PE.temp_char6, PE.temp_char7, PE.temp_char8, PE.temp_fech, PE.temp_num, PE.emp_adm, PE.emp_cont,
      PE.emp_nom, PE.urlservidorweb_admin, PE.urlservidorweb_cont, PE.urlservidorweb_nom, PE.tipo_imp_prov_ext, PE.netTcp_admin,
      PE.netTcp_cont, PE.netTcp_nom, PE.login_admin, PE.password_admin, PE.login_cont, PE.password_cont, PE.login_nom, PE.password_nom,
      PE.fec_cont, PE.co_cue_aju, PE.tempor1, PE.g_moneda, PE.g_mostrar_modelo,PE.g_alerta_f, PE.p_desc_art,PE.p_desc_cat, PE.p_desc_glo,
      PE.p_desc_lin, PE.v_redondeo, PE.v_tipo_redondeo, PE.v_valor_redondeo, PE.c_redondeo, PE.c_tipo_redondeo, PE.c_valor_redondeo,
      PE.v_maneja_sucursales, PE.correoservidor, PE.correopuerto, PE.correocredencial_def, PE.correousuario, PE.correopass,
	  PE.correodir, PE.correossl, PE.correometodo_ent, PE.correotiempo_exp, PE.v_concepto_despacho, PE.v_manejo_direccion_entrega, PE.v_tip_cli, PE.v_co_ven, PE.v_cond_pago, PE.v_cta_ing_egr,
      PE.v_co_seg, PE.v_co_zon, PE.v_tipo_per,PE.i_stock_negativo_advertencia, PE.i_stock_negativo, PE.i_dec_stock, PE.i_dec_costo, PE.i_dec_precio,
      PE.i_multiple_moneda, PE.i_moneda_articulo, PE.i_seriales_articulo, PE.i_licores, PE.i_tipo_cost_dev, PE.i_maneja_lotes_vencidos,
      PE.i_costo_inventario, PE.i_permitir_fec_menor_ult_inv, PE.c_margen_costo_precio, PE.c_tip_pro, PE.c_cond_pago, PE.c_cta_ing_egr,
      PE.c_co_seg, PE.c_co_zon, PE.c_tipo_per, PE.cb_c
```
