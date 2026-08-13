# SP: pExportarActualizarRegistrosAlmacen
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosAlmacen
*DESCRIPCIÓN	:	Inserta un Almacen
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosAlmacen]
    (
	  @sCo_Alma			CHAR(6) ,
      @sCo_AlmaOri		CHAR(6) ,
      @sDes_Alma		VARCHAR(60) ,
      @sCo_Sucur		CHAR(6) ,
      @bNoVenta			BIT ,
      @bNoCompra		BIT ,
      @bMateriales		BIT ,
      @bProduccion		BIT ,
      @bAlm_Temp		BIT ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saAlmacen] WHERE Co_Alma = @sCo_Alma'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Alma CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Alma = @sCo_Alma
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarAlmacen] 
																		@sCo_Alma,
																		@sCo_AlmaOri,
																		@sDes_Alma,
																		@sCo_Sucur,
																		@bNoVenta,
																		@bNoCompra,
																		@bMateriales,
																		@bProduccion,
																		@bAlm_Temp,
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
																		@s
```
