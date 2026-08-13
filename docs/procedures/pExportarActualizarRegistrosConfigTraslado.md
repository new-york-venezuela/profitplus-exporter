# SP: pExportarActualizarRegistrosConfigTraslado
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saConfigTraslado`](../tables/saConfigTraslado.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosConfigTraslado
*DESCRIPCIÓN	:	Actualiza la configuracion del proceso ConfigTraslado
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosConfigTraslado]
    (
      @sCo_Config		CHAR(6) ,
      @sCo_ConfigOri	VARCHAR(8) ,
      @sDes_Config		VARCHAR(60) ,
      @sCo_Usuario		CHAR(6)				= NULL ,
      @sCo_Mapa			CHAR(6)				= NULL ,
      @xXml_Squema		XML					= NULL ,
      @xXml_Data		XML					= NULL ,
      @xXml_Reglas		XML					= NULL ,
      
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saConfigTraslado] WHERE co_config = @sCo_Config'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Config CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Config = @sCo_Config
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarConfigTraslado]
																		@sCo_Config,
																		@sCo_ConfigOri,
																		@sDes_Config,
																		@sCo_Usuario,
																		@sCo_Mapa,
																		@xXml_Squema,
																		@xXml_Data,
																		@xXml_Reglas,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
```
