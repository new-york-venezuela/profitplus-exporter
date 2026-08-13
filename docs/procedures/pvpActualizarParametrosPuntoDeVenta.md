# SP: pvpActualizarParametrosPuntoDeVenta
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpActualizarParametrosPuntoDeVenta
*CREACIÓN		: <2016-08-30>
*MODIFICACIÓN	: <2020-08-07>
*DESCRIPCIÓN	: Actualiza los parametros de Punto De Venta
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpActualizarParametrosPuntoDeVenta]
    (
      @sCod_Emp						CHAR(20) ,
      @sCod_EmpOri					CHAR(20) ,
      @sCod_usu						CHAR(6) ,
      @sCo_cta_ingr_egr				CHAR(20) ,
	  @sCo_cta_ingr_egr_facdev		CHAR(20) ,
	  @sco_cta_ingr_egr_banco		CHAR(20) ,
      @sCod_caja					CHAR(6) = NULL,
      @bTf_vendedor					BIT	,
      @bTf_num_turno				BIT	,
      @bTf_consecutivos				BIT	,
      @bTf_caja						BIT	,
      @bTf_sucursal					BIT	,
      @bTf_cajero					BIT	,
      @bTf_num_items				BIT	,
      @bMan_turno					BIT,
      @bManejo_identificadores		BIT	,
      @sCo_imagen					CHAR(6) = NULL,
      @sDescrip_imagen				VARCHAR(120) = NULL,
      @bUso_ncr						BIT ,
      @bFp_efectivo					BIT ,
      @bFp_vale						BIT ,
      @bFp_cheque					BIT ,
      @bFp_tarjd					BIT ,
      @bFp_tarjc					BIT ,
	  @bFp_deposito					BIT ,
	  @bFp_transferencia			BIT ,
      @deMonto_max_vuelto			DECIMAL(18,2) = NULL,
      @deMonto_min_cheque			DECIMAL(18,2) = NULL,
      @deMonto_min_tarjd			DECIMAL(18,2) = NULL,
      @deMonto_min_tarjc			DECIMAL(18,2) = NULL,
	  @deMonto_min_deposito			DECIMAL(18,2) = NULL,
	  @deMonto_min_transferencia	DECIMAL(18,2) = NULL,
      @bDev_efectivo				BIT ,
      @bDev_cheque					BIT ,
      @bDev_tarjeta					BIT ,
      @bDev_ncr						BIT ,
      @bDev_vale					BIT ,
      @sExpre_reg_telef_val VARCHAR(128) = NULL,
      @sExpre_reg_telef_ejm VARCHAR(64) = NULL,
      @sExpre_reg_email_val VARCHAR(128) = NULL,
      @sExpre_reg_email_ejm VARCHAR(64) = NULL,
      @sTipo_Cliente				CHAR(6) ,
      @sEtiqueta_Impuesto VARCHAR(12) = NULL ,
      @sLogo_Empresa VARCHAR (128) = NULL ,
      @bAutoriza_dev_efect BIT ,
      @iDias_max_dev      INT = NULL ,
      @deMonto_min_dev    DECIMAL(18,2)	= NULL,
      @deMonto_max_dev    DECIMAL(18,2)	= NULL,
      @sCampo1					  VARCHAR(60) = NULL,
      @sCampo2					  VARCHAR(60) = NULL,
      @sCampo3				  	VARCHAR(60) = NULL,
      @sCampo4			  		VARCHAR(60) = NULL,
      @sCampo5				  	VARCHAR(60) = NULL,
      @sCampo6			  		VARCHAR(60) = NULL,
      @sCampo7
```
