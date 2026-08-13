# SP: pExportarActualizarRegistrosImpMun
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saImpMun`](../tables/saImpMun.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosImpMun
*DESCRIPCIÓN	:	Inserta un impuesto municipal
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosImpMun]
    (
      @sCo_Imun			CHAR(15) ,
      @sCo_Sucur		CHAR(6) ,
      @sCo_ImunOri		CHAR(15) ,
      @sCo_SucurOri		CHAR(6) ,
      @sImp_Des			VARCHAR(60),
      @sN_Act			CHAR(20),
      @deAlicuota		DECIMAL(6, 2),
      @deM_Trib			DECIMAL(18,2),
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saImpMun] WHERE Co_Imun = @sCo_Imun and Co_Sucur = @sCo_Sucur'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Imun CHAR(15), @sCo_Sucur CHAR(6)',
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Imun = @sCo_Imun, @sCo_Sucur = @sCo_Sucur
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarImpuestoMunicipal]
																		@sCo_Imun,
																		@sCo_Sucur,
																		@sCo_ImunOri,
																		@sCo_SucurOri,
																		@sImp_Des,
																		@sN_Act,
																		@deAlicuota,
																		@deM_Trib,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCampos,
```
