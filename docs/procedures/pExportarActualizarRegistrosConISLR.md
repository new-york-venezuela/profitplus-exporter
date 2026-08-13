# SP: pExportarActualizarRegistrosConISLR
**Tipo**: Procedimiento
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saConISLR`](../tables/saConISLR.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosConISLR
*DESCRIPCIÓN	:	Inserta un concepto de ISLR
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosConISLR]
    (
      @sCo_Islr			CHAR(6) ,
      @sCo_IslrOri		CHAR(6),
      @sIslr_Des		VARCHAR(60) ,
      @sIslr_DesLarga	VARCHAR(MAX) ,
      @sNumeral			CHAR(6) = NULL,
      @sLiteral			CHAR(6) = NULL,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saConISLR] WHERE Co_Islr = @sCo_Islr'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Islr CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Islr = @sCo_Islr
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarConceptoISLR] 
																		@sCo_Islr,
																		@sCo_IslrOri,
																		@sIslr_Des,
																		@sIslr_DesLarga,
																		@sNumeral,
																		@sLiteral,
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
	
	
		EXEC
```
