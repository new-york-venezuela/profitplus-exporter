# SP: pExportarActualizarRegistrosPais
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saPais`](../tables/saPais.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosPais
*DESCRIPCIÓN	:	Inserta un Pais
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosPais]
    (
      @sCo_Pais			CHAR(6) ,
      @sCo_PaisOri		CHAR(6) ,
      @sCo_Mone			CHAR(6) ,
      @sPais_Des		VARCHAR(60) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saPais] WHERE Co_Pais = @sCo_Pais'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Pais CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Pais = @sCo_Pais
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarPais]	@sCo_Pais,
																		@sCo_PaisOri,
																		@sCo_Mone,
																		@sPais_Des,

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
	
	
		EXEC sp_executesql @query = @sSql, @params =	N'@sCo_Pais CHAR(6),		@sCo_PaisOri CHAR(6),	
														@sCo_Mone CHAR(6),			@sPais_Des VARCHAR(60),	
														@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR
```
