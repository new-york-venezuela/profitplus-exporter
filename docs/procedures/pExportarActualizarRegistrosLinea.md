# SP: pExportarActualizarRegistrosLinea
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosLinea
*DESCRIPCIÓN	:	Inserta una Linea
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosLinea]
    (
      @sCo_Lin			CHAR(6) ,
      @sCo_LinOri		CHAR(6) ,
      @sLin_Des			VARCHAR(60) ,
      @sDis_Cen			VARCHAR(MAX)= NULL ,
      @sCo_Imun			CHAR(15) ,
      @sCo_Reten		CHAR(6) ,
      @deComi_Lin		DECIMAL(18, 2) ,
      @deComi_Lin2		DECIMAL(18, 2) ,
      @bVa				BIT ,
      @sI_Lin_Des		VARCHAR(60) ,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saLineaArticulo] WHERE Co_Lin = @sCo_Lin'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Lin CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Lin = @sCo_Lin
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarLineaArticulo] 
																		@sCo_Lin,
																		@sCo_LinOri,
																		@sLin_Des,
																		@sDis_Cen,
																		@sCo_Imun,
																		@sCo_Reten,
																		@deComi_Lin,
																		@deComi_Lin2,
																		@bVa,
																		@sI_Lin_Des,
																		@bMovil,
																		@sCampo1,
```
