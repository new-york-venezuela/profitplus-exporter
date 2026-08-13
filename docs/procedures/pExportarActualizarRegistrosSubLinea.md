# SP: pExportarActualizarRegistrosSubLinea
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosSubLinea
*DESCRIPCIÓN	:	Inserta una SubLinea
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosSubLinea]
    (
      @sCo_Subl			CHAR(6) ,
      @sCo_SublOri		CHAR(6) ,
      @sSubl_Des		VARCHAR(60) ,
      @sCo_Lin			CHAR(6) ,
      @sCo_LinOri		CHAR(6) ,
      
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
      @sCo_Imun			CHAR(15) ,
      @sCo_Reten		CHAR(6) ,
      @sI_Subl_Des		VARCHAR(60) ,
      @bMovil			BIT	,
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
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saSubLinea] WHERE Co_Subl = @sCo_Subl and Co_Lin = @sCo_Lin'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Subl CHAR(6), @sCo_Lin	CHAR(6) ',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Subl = @sCo_Subl, @sCo_Lin = @sCo_Lin
															
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarSubLinea] 
																		@sCo_Subl,
																		@sCo_SublOri,
																		@sSubl_Des,
																		@sCo_Lin,
																		@sCo_LinOri,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
```
