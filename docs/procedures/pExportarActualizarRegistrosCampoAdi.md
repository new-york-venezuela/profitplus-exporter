# SP: pExportarActualizarRegistrosCampoAdi
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosCampoAdi
*DESCRIPCIÓN	:	Inserta un concepto de campo adicional
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCampoAdi]
    (
      @sCo_AdiCampo		CHAR(8) ,
      @sCo_AdiCampoOri	CHAR(8) ,
      @sCo_AdiGrupo		CHAR(8) ,
      @sDes_AdiCampo	VARCHAR(60) ,
      @iTipo			INT ,
      @sVal_Str			VARCHAR(254) ,
      @deVal_Decimal	DECIMAL(18, 5) ,
      @iVal_Entero		INT ,
      @sdVal_Fecha		SMALLDATETIME ,
      @bFijo			BIT ,
      @sObservacion		VARCHAR(200) ,
      
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saAdiCampo] WHERE Co_AdiCampo = @sCo_AdiCampo'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_AdiCampo CHAR(8)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_AdiCampo = @sCo_AdiCampo
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarAdiCampo]@sCo_AdiCampo,
																		@sCo_AdiCampoOri,
																		@sCo_AdiGrupo,
																		@sDes_AdiCampo,
																		@iTipo,
																		@sVal_Str,
																		@deVal_Decimal,
																		@iVal_Entero,
																		@sdVal_Fecha,
																		@bFijo,
																		@sObservacion,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
```
