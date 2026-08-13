# SP: pExportarActualizarRegistrosCategoria
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCatArticulo`](../tables/saCatArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCategoria
*DESCRIPCIÓN	:	Inserta una Categoria
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCategoria]
    (
      @sCo_Cat			CHAR(6) ,
      @sCo_CatOri		CHAR(6) ,
      @sCat_Des			VARCHAR(60) ,
      @sDis_Cen			VARCHAR(MAX) = NULL ,
      @sCo_Imun			CHAR(15) ,
      @sCo_Reten		CHAR(6) ,
      --@sCo_Sucu			CHAR(6) = NULL ,
      @bMovil			BIT ,
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
    if (@sCo_Imun = N'') 
    begin	
    set @sCo_Imun = null 
    end
    if (@sCo_Reten = N'') 
    begin	
    set @sCo_Reten = null 
    end
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saCatArticulo] WHERE Co_Cat = @sCo_Cat'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Cat CHAR(10)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Cat = @sCo_Cat
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarCategoriaArticulo]
																		@sCo_Cat,
																		@sCo_CatOri,
																		@sCat_Des,
																		@sDis_Cen,
																		@sCo_Imun,
																		@sCo_Reten,
																		@bMovil,
																		
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCam
```
