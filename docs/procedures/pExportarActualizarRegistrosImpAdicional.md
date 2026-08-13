# SP: pExportarActualizarRegistrosImpAdicional
**Tipo**: Procedimiento
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuesto`](../tables/saImpuesto.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosImpAdicional
*DESCRIPCIÓN	:	Inserta un concepto de Imp. adicional
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosImpAdicional]
    (
      @sCod_Impuesto	CHAR(6) ,
      @sCod_ImpuestoOri	CHAR(6) ,
      @sDes_Impuesto	VARCHAR(60) ,
      @bRegistro_Sist	BIT ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saImpuesto] WHERE Cod_Impuesto = @sCod_Impuesto'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCod_Impuesto CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCod_Impuesto = @sCod_Impuesto
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarImpuesto]
																		@sCod_Impuesto,
																		@sCod_ImpuestoOri,
																		@sDes_Impuesto,
																		@bRegistro_Sist,
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
	
	
		EXEC sp_executesql @query = @sSql, @params =	N'@sCod_Impuesto CHAR(6),	@sCod_I
```
