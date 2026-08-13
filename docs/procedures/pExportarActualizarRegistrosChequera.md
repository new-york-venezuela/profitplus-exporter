# SP: pExportarActualizarRegistrosChequera
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosChequera
*DESCRIPCIÓN	:	Inserta un concepto de chequera
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosChequera]
    (
      @sCo_Chra			CHAR(6) ,
      @sCo_ChraOri		CHAR(6) ,
      @sChra_Des		VARCHAR(60) ,
      @sCod_Cta			CHAR(6) ,
      @sStatus			CHAR(3) ,
      @iNum_Ch			INT ,
      @sdFecha_Re		SMALLDATETIME ,
      @sRespons			CHAR(6) ,
      @bLimUsoRe		BIT ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saChequera] WHERE Co_Chra = @sCo_Chra'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Chra CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT,@sCo_Chra = @sCo_Chra
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarChequera] @sCo_Chra,
																		@sCo_ChraOri,
																		@sChra_Des,
																		@sCod_Cta,
																		@sStatus,
																		@iNum_Ch,
																		@sdFecha_Re,
																		@sRespons,
																		@bLimUsoRe,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCampos,
																		@sCo_us_mo,
																		@sCo_sucu_mo,
```
