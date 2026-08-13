# SP: pExportarActualizarRegistrosTipoDoc
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosTipoDoc
*DESCRIPCIÓN	:	Inserta un concepto de tipo documento
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosTipoDoc]
    (
      @sCo_Tipo_Doc			CHAR(6),
      @sCo_Tipo_DocOri		CHAR(6),
      @sDescrip				VARCHAR(60),
      @sTipo_Mov			CHAR(2),
      @bUsar_Ventas			BIT,
      @bUsar_Compras		BIT,
      @bRegistro_Sistema	BIT,
      @bNum_Fact_Fis_Venta	BIT,
      @bNum_Cont_Venta		BIT,
      @bSerial_Imp_Fis_Venta BIT,
      @bReng_Venta			BIT,
      @bNum_Iva_Venta		BIT,
      @bDoc_Prov_Compra		BIT,
      @bNum_Control_Compra	BIT,
      @bReng_Compra			BIT,
      @bNum_Iva_Compra		BIT,
      @bManual_Venta		BIT,
      @bManual_Compra		BIT,
      @bDoc_Asoc_Venta		BIT,
      @bDoc_Asoc_Compra		BIT,
      @bAct_Prog_Pago		BIT,
      @bReac_doc_Compra		BIT,
      @bReac_doc_Venta		BIT,
      @bAnul_doc_venta		BIT,
      @bAnul_doc_compra		BIT,
      @bAplica_dxpp_venta	BIT,
      @bAplica_dxpp_compra	BIT,
      @bAplica_riva_venta	BIT,
      @bAplica_riva_compra	BIT,
      @sTipo_imp			CHAR(1),
      @sCampo1			VARCHAR(60)			= NULL ,
      @sCampo2			VARCHAR(60)			= NULL ,
      @sCampo3			VARCHAR(60)			= NULL ,
      @sCampo4			VARCHAR(60)			= NULL ,
      @sCampo5			VARCHAR(60)			= NULL ,
      @sCampo6			VARCHAR(60)			= NULL ,
      @sCampo7			VARCHAR(60)			= NULL ,
      @sCampo8			VARCHAR(60)			= NULL ,
      @sCampos			VARCHAR(MAX),		
      @sCo_us_in		CHAR(6) ,
      @sCo_sucu_in		CHAR(6)				= NULL ,
      @dFe_us_in		VARCHAR(60)			= NULL ,
      @sCo_us_mo		CHAR(6)				= NULL ,
      @sCo_sucu_mo		CHAR(6)				= NULL ,
      @sRevisado		CHAR(1) = '',
      @sTrasnfe			CHAR(1) = '',
      @sEmpresa			VARCHAR(60),
      @sMaquina			VARCHAR(60),
      @gRowguid			UNIQUEIDENTIFIER	= NULL
    )
AS 
    BEGIN
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saTipoDocumento] WHERE Co_Tipo_Doc = @sCo_Tipo_Doc'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Tipo_Doc CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Tipo_Doc = @sCo_
```
