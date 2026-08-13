# SP: pExportarActualizarRegistrosPlanFiscal
**Tipo**: Procedimiento
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saPlanillaFiscal`](../tables/saPlanillaFiscal.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosPlanFiscal
*DESCRIPCIÓN	:	Inserta un concepto de planilla fiscal
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosPlanFiscal]
    (
      @sCod_Plan		CHAR(6) ,
      @sCod_PlanOri		CHAR(6) ,
      @sDes_Plan		VARCHAR(60) ,
      @sTipo			CHAR(1) ,
      @iAno				INT ,
      @iMes				INT ,
      @sdFecha_Pago		DATETIME ,
      @sNumero_Plan		VARCHAR(30) ,
      @deMonto			DECIMAL(18, 2) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saPlanillaFiscal] WHERE Cod_Plan = @sCod_Plan'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCod_Plan CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCod_Plan = @sCod_Plan
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarPlanillaFiscal] 
																		@sCod_Plan,
																		@sCod_PlanOri,
																		@sDes_Plan,
																		@sTipo,
																		@iAno,
																		@iMes,
																		@sdFecha_Pago,
																		@sNumero_Plan,
																		@deMonto,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCampos,
																		@s
```
