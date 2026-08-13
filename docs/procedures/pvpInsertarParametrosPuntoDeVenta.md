# SP: pvpInsertarParametrosPuntoDeVenta
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpInsertarParametrosPuntoDeVenta
*CREACION		: <2016-08-30>
*MODIFICACION	: <2020-08-07>
*DESCRIPCIÓN	: Inserta una Configuración de pto venta en la tabla pvparemp
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpInsertarParametrosPuntoDeVenta]
    (
      @sCod_Emp				      CHAR(20) ,
	  --@sCod_EmpOri CHAR(20) ,
      @scod_usu					  CHAR(6)  ,
      @sco_cta_ingr_egr		      CHAR(20) ,
	  @sCo_cta_ingr_egr_facdev    CHAR(20) ,
	  @sco_cta_ingr_egr_banco     CHAR(20) ,
      @scod_caja			      CHAR(6) ,
      @bCod_caja_habilitado		  BIT = NULL,
      @bCod_caja_vdefecto         BIT = NULL,
      @btf_vendedor				  BIT ,
      @btf_num_turno			  BIT ,
      @btf_consecutivos		      BIT ,
      @btf_caja				      BIT ,
      @btf_sucursal				  BIT ,
      @btf_cajero				  BIT ,
      @btf_num_items			  BIT ,
      @bmanejo_identificadores	  BIT ,
      @bman_turno				  BIT ,
      @sco_imagen				  CHAR(6)	= NULL,
      @sdescrip_imagen		      VARCHAR(120)= NULL,
      @buso_ncr					  BIT ,
      @bfp_efectivo				  BIT ,
      @bfp_vale					  BIT ,
      @bfp_cheque				  BIT ,
      @bfp_tarjd				  BIT ,
      @bfp_tarjc				  BIT ,
	  @bfp_deposito				  BIT ,
	  @bfp_transferencia		  BIT ,
      @demonto_max_vuelto		  DECIMAL(18,2)	= NULL,
      @demonto_min_cheque		  DECIMAL(18,2) = NULL,
      @demonto_min_tarjd		  DECIMAL(18,2) = NULL,
      @demonto_min_tarjc		  DECIMAL(18,2) = NULL,
	  @demonto_min_deposito		  DECIMAL(18,2) = NULL,
	  @demonto_min_transferencia  DECIMAL(18,2) = NULL,
      @bdev_efectivo			  BIT ,
      @bdev_cheque				  BIT ,
      @bdev_tarjeta				  BIT ,
      @bdev_ncr					  BIT ,
      @bdev_vale				  BIT ,
      @sExpre_reg_telef_val		  VARCHAR(128) = NULL,
      @sExpre_reg_telef_ejm		  VARCHAR(64) = NULL,
      @sExpre_reg_email_val		  VARCHAR(128) = NULL,
      @sExpre_reg_email_ejm		  VARCHAR(64) = NULL,
      @sTipo_Cliente			  CHAR(6) ,
      @sEtiqueta_Impuesto		  VARCHAR(12) = NULL,
      @sLogo_Empresa			  VARCHAR (128) = NULL ,
      @bautoriza_dev_efect		  BIT ,
      @idias_max_dev			  INT = NULL ,
      @demonto_min_dev			  DECIMAL(18,2)	= NULL,
      @demonto_max_dev			  DECIMAL(18,2)	= NULL,
      @sCampo1					  VARCHAR(60)	= NULL ,
      @sCampo2					  VARCHAR(60)	= NULL ,
      @sCampo3
```
