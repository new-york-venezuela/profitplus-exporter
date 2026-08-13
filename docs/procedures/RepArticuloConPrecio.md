# SP: RepArticuloConPrecio
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saColor`](../tables/saColor.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <30-04-10>
-- Description:	<Reporte de Artículos con sus Precios>
-- =============================================
CREATE PROCEDURE  [dbo].[RepArticuloConPrecio]
	-- Add the parameters for the stored procedure here
	@sCo_Art_d CHAR(30) = NULL,
	@sCo_Art_h CHAR(30) = NULL,
	@sCo_Linea_d char(6) = NULL,
	@sCo_Linea_h char(6) = NULL,
	@sCo_SubLinea_d char(6) = NULL,
	@sCo_SubLinea_h char(6) = NULL,
	@sCo_Categoria_d char(6) = NULL,
	@sCo_Categoria_h char(6) = NULL,
	@sCo_Color_d char(6) = NULL,
	@sCo_Color_h char(6) = NULL,
	@sCo_Almacen char(6) = NULL,
	@sCo_NivelStock CHAR(4) = NULL ,
	@sCo_FechaHasta datetime = NULL,
	@sCo_Precio01 char(6) = NULL,
	@sCo_Precio02 char(6) = NULL,
	@sCo_Precio03 char(6) = NULL,
	@sCo_Precio04 char(6) = NULL,
	@sCo_Precio05 char(6) = NULL,
	@sCo_Clasificado char(4)= NULL,	----->Filtro Clasificado por
	@bIncluirImpuesto char(2) = NULL,
	@sCo_Sucursal char(6) = NULL,
	@sCampOrderBy varchar(16) = NULL,
	@sDir varchar(6) = NULL,
	@bHeaderRep bit = 0
AS
BEGIN
	SET NOCOUNT ON;

	 IF (@sCo_Precio01 IS NULL AND @sCo_Precio02 IS NULL AND @sCo_Precio03 IS NULL AND @sCo_Precio04 IS NULL AND @sCo_Precio05 IS NULL)
	    BEGIN
		  RAISERROR('Debe seleccionar un Tipo de Precio',16, 1);
		  RETURN -1
		END  
	
	
	DECLARE @bIncluirImpuestoCalculo bit

--------------Valores por Defecto---------------- 
	IF @sCo_NivelStock IS NULL 
		SET @sCo_NivelStock = 'TODO' 
		
	IF @sCo_FechaHasta IS NULL
		SET @sCo_FechaHasta = getdate();

	SET @sCo_FechaHasta = dbo.FechaConMinutos(@sCo_FechaHasta)

	IF (@sCo_Clasificado IS NULL)
		SET @sCo_Clasificado = ''

	IF (@bIncluirImpuesto IS NULL or @bIncluirImpuesto = 'NO' )
		SET @bIncluirImpuestoCalculo = 0
	else
		SET @bIncluirImpuestoCalculo = 1
--------------Fin Valores por Defecto---------------- 


Select A.co_art, A.art_des, UP.co_uni, UP.des_uni, 
	AL.co_alma, AL.des_alma, ISNULL(B.STOCK,0.00000) AS StockActual,
	A.co_lin, D.lin_des, 
	A.co_subl, E.subl_des, 
	T.co_cat, T.cat_des,
	@sCo_FechaHasta as FechaPrecio,
	PRE01.co_precio as co_precio01, PRE01.des_precio as des_precio01, 
	CASE when PRE01.co_precio is not null then
	dbo.PrecioAUnaFecha(A.co_art,dbo.FechaSimple(@sCo_FechaHasta),PRE01.co_precio,AL.co_alma,NULL,@bIncluirImpuestoCalculo,NULL,NULL) 
	else null END as Precio01,

	PRE02.co_precio as co_precio02, PRE02.des_precio as des_
```
