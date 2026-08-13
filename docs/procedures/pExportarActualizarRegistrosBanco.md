# SP: pExportarActualizarRegistrosBanco
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosBanco
*DESCRIPCIÓN	:	Inserta un banco
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosBanco]
    (
      @sCo_Ban			CHAR(6) ,
      @sCo_BanOri		CHAR(6) ,
      @sDes_Ban			VARCHAR(60) ,
      @sTelefonos		VARCHAR(60) = NULL ,
      @iPlazo1			INT ,
      @iPlazo2			INT ,
      @iPlazo3			INT ,
      @iPlazo4			INT ,
      
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saBanco] WHERE co_Ban = @sco_Ban'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sco_Ban CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sco_Ban = @sco_Ban
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarBanco] @sco_Ban,
																		@sco_BanOri,
																		@sDes_Ban,
																		@sTelefonos,
																		@iPlazo1,
																		@iPlazo2,
																		@iPlazo3,
																		@iPlazo4,
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
																		@t
```
