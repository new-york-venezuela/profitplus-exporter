# SP: pExportarActualizarRegistrosCuentaIngEgr
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCuentaIngEgr
*DESCRIPCIÓN	:	Inserta un CuentaIngEgr
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCuentaIngEgr]
    (
      @sCo_Cta_Ingr_Egr	CHAR(20) ,
      @sCo_Cta_Ingr_EgrOri	CHAR(20) ,
      @sDescrip			VARCHAR(60) ,
      @sCo_Islr			CHAR(6) ,
      @sDis_Cen			VARCHAR(MAX) = NULL ,
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
    if (@sCo_Islr = N'') 
    begin	
    set @sCo_Islr = null 
    end
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saCuentaIngEgr] WHERE Co_Cta_Ingr_Egr = @sCo_Cta_Ingr_Egr'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Cta_Ingr_Egr CHAR(20)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Cta_Ingr_Egr = @sCo_Cta_Ingr_Egr
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarCuentaIngreso] 
																		@sCo_Cta_Ingr_Egr,
																		@sCo_Cta_Ingr_EgrOri,
																		@sDescrip,
																		@sCo_Islr,
																		@sDis_Cen,
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
```
