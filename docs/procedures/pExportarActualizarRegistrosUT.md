# SP: pExportarActualizarRegistrosUT
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saUnidadTributaria`](../tables/saUnidadTributaria.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosUT
*DESCRIPCIÓN	:	Inserta un concepto de Unidad Tributaria
*AUTOR			:	SOFTECH SISTEMAS
*FECHA MODIFICACIÓN: <2020-02-18>
***************************************************************************/
CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosUT]
    (
      @sdCo_Fec			smalldatetime ,
      @sdCo_FecOri		smalldatetime ,
      @sUni_Gact		CHAR(20) = NULL ,
      @dUni_Fecp		DATETIME ,
      @deValor			DECIMAL(18, 5) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saUnidadTributaria] WHERE Co_Fec = @sdCo_Fec'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sdCo_Fec smalldatetime',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sdCo_Fec = @sdCo_Fec
													
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarUnidadTributaria] 
																		@sdCo_Fec,
																		@sdCo_FecOri,
																		@sUni_Gact,
																		@dUni_Fecp,
																		@deValor,
																		@sCo_sucu_mo,
																		@sCo_us_mo,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sMaquina,
																		@sCampos,
																		@sRevisado,
																		@sTrasnfe,
																		@gRowguid,
```
