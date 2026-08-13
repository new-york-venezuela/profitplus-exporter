# SP: pActualizarParametrosEmpresa
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarParametrosEmpresa
*DESCRIPCIÓN	: Actualiza los parametros de empresa
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarParametrosEmpresa]
    (
      @sCod_Emp CHAR(20) ,
      @sCod_EmpOri CHAR(20) ,
      @sEmp_Adm CHAR(250) = NULL ,
      @semp_cont CHAR(250) ,
      @baLogo VARBINARY(MAX) = NULL ,
      @sdfecha_res SMALLDATETIME ,
      @sTemp_Char1 CHAR(20) = NULL ,
      @sTemp_Char2 CHAR(20) = NULL ,
      @sTemp_Char3 CHAR(20) = NULL ,
      @sTemp_Char4 CHAR(20) = NULL ,
      @sTemp_Char5 CHAR(20) = NULL ,
      @sTemp_Char6 CHAR(20) = NULL ,
      @sTemp_Char7 CHAR(20) = NULL ,
      @sTemp_Char8 CHAR(20) = NULL ,
      @sdtemp_fech SMALLDATETIME ,
      @iTemp_Num INT ,
      @tsValidador TIMESTAMP = NULL ,
      @sUrlservidorweb_Cont VARCHAR(128) = NULL ,
      @sUrlservidorweb_Admin VARCHAR(128) = NULL ,
      @sTipo_imp_prov_ext CHAR(1) ,
      @slogin_cont CHAR(32) = NULL ,
      @spassword_cont CHAR(128) = NULL ,
      @sLogin_Admin CHAR(32) = NULL ,
      @sPassword_Admin CHAR(128) = NULL ,
      @sdfec_cont SMALLDATETIME ,
      @sco_Cue_Aju CHAR(20) = NULL ,
      @iTempor1 INT = NULL ,
      @sG_Moneda CHAR(6) ,
      @bG_Mostrar_Modelo BIT ,
      @ig_alerta_f INT ,
      @sv_tip_cli CHAR(6) ,
      @sV_Co_Ven CHAR(6) ,
      @sV_Cond_Pago CHAR(6) ,
      @sV_Cta_Ing_Egr CHAR(20) ,
      @sV_Co_Seg CHAR(6) ,
      @sV_Co_Zon CHAR(6) ,
      @sV_Tipo_Per CHAR ,
      @bv_redondeo BIT ,
      @iv_tipo_redondeo INT ,
      @sv_valor_redondeo CHAR(4) ,
      @bv_manejo_direccion_entrega BIT ,
      @bV_Maneja_Sucursales BIT ,
      @bV_Concepto_Despacho BIT ,
      @bseriales_despacho BIT ,
      @blotes_despacho BIT ,
      @bP_Desc_Art BIT ,
      @bP_Desc_Cat BIT ,
      @bP_Desc_Lin BIT ,
      @bP_Desc_Glo BIT ,
      @iv_max_reng INT ,
      @bv_max_reng_todos BIT ,
      @bI_Stock_Negativo_Advertencia BIT ,    --INVENTARIO
      @bI_Stock_Negativo BIT ,    --INVENTARIO
      @bI_Precio1_Iva BIT ,
      @bI_Precio2_Iva BIT ,
      @bI_Precio3_Iva BIT ,
      @bI_Precio4_Iva BIT ,
      @bI_Precio5_Iva BIT ,
      @iI_Dec_Stock INT ,  --INVENTARIO
      @iI_Dec_Costo INT ,  --INVENTARIO
      @iI_Dec_Precio INT ,    --INVENTARIO
      @bI_Talla_Articulo BIT ,
      @bI_Multipl
```
