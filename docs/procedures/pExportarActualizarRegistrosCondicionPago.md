# SP: pExportarActualizarRegistrosCondicionPago
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCondicionPago
*DESCRIPCIÓN	:	Inserta un CondicionPago
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCondicionPago]
    (
      @sCo_Cond			CHAR(6) ,
      @sCo_CondOri		CHAR(6) ,
      @sCond_Des		VARCHAR(60) ,
      @iDias_Cred		INT ,
      @sDis_Cen			VARCHAR(MAX) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saCondicionPago] WHERE Co_Cond = @sCo_Cond'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Cond CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Cond = @sCo_Cond
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarCondicionPago] 
																		@sCo_Cond,
																		@sCo_CondOri,
																		@sCond_Des,
																		@iDias_Cred,
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
																		@sRevisado,
																		@tsValidador'
	
	
		EXEC sp_executesql @query = @sSql, @params =	N'@sCo_Cond			CHAR(6) ,
```
