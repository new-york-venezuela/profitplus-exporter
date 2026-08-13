# SP: pExportarActualizarRegistrosProcedencia
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saProcedencia`](../tables/saProcedencia.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosProcedencia
*DESCRIPCIÓN	:	Inserta una Procedencia
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosProcedencia]
    (
      @sCod_Proc		CHAR(6) ,
      @sCod_ProcOri		CHAR(6) ,
      @sDes_Proc		VARCHAR(60) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saProcedencia] WHERE Cod_Proc = @sCod_Proc'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCod_Proc CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCod_Proc = @sCod_Proc
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarProcedencia] 
																		@sCod_Proc,
																		@sCod_ProcOri,
																		@sDes_Proc,
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
	
	
		EXEC sp_executesql @query = @sSql, @params =	N'@sCod_Proc CHAR(6),		@sCod_ProcOri CHAR(6),	
														@sDes_Proc VARCHAR(60),	
														@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60),
```
