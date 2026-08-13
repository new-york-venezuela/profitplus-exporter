# SP: pExportarActualizarRegistrosTipoAjuste
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosTipoAjuste
*DESCRIPCIÓN	:	Inserta un TipoAjuste
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosTipoAjuste]
    (
      @sCo_Tipo			CHAR(6) ,
      @sCo_TipoOri		CHAR(6) ,
      @sDes_Tipo		VARCHAR(60) ,
      @sTipo_Trans		CHAR(1) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saTipoAjuste] WHERE Co_Tipo = @sCo_Tipo'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Tipo CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Tipo = @sCo_Tipo
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarTipoAjuste] 
																		@sCo_Tipo,
																		@sCo_TipoOri,
																		@sDes_Tipo,
																		@sTipo_Trans,
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
																		@sTrasnfe,
																		@sMaquina,
																		@sRevisado,
																		@tsValidador'
	
	
		EXEC sp_executesql @query = @sSql, @params =	N'@sCo_Tipo CHAR(6),		@sCo_TipoOri CHAR(6),	
														@sDes_Tipo VARCHAR(60),		@sTipo_Trans CHAR(1),
```
