# SP: RepArticuloConCostoYPrecio
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saColor`](../tables/saColor.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Consultores>
-- Create date: <03-03-11>
-- Description:	<Reporte de Artículos con un Costo y todos sus Precios>
-- =============================================
CREATE PROCEDURE  [dbo].[RepArticuloConCostoYPrecio]
	-- Add the parameters for the stored procedure here
	@sCo_Art_d CHAR(30) = NULL,
	@sCo_Art_h CHAR(30) = NULL,
	@sCo_Linea_d char(6) = NULL,
	@sCo_Linea_h char(6) = NULL,
	@sCo_Categoria_d char(6) = NULL,
	@sCo_Categoria_h char(6) = NULL,
	@sCo_SubLinea_d char(6) = NULL,
	@sCo_SubLinea_h char(6) = NULL,
	@sCo_Color_d char(6) = NULL,
	@sCo_Color_h char(6) = NULL,
	@sCo_Almacen char(6) = NULL,
	@dCo_FechaHasta smalldatetime = NULL,
	@sCo_Precio01 char(6) = NULL,
	@sCo_Precio02 char(6) = NULL,
	@sCo_Precio03 char(6) = NULL,
	@sCo_Precio04 char(6) = NULL,
	@sCo_Precio05 char(6) = NULL,
	@sCo_TipoCosto char(2) = NULL,
	@sCo_Excluir char(2) = NULL,
	
	@sCo_Sucursal char(6) = NULL,
	
	@sCampOrderBy varchar(16) = NULL,
	@sDir varchar(6) = NULL,
	@bHeaderRep bit = 0
AS
BEGIN
	SET NOCOUNT ON;

IF @dCo_FechaHasta IS NOT NULL
  SET @dCo_FechaHasta = dbo.FechaSimple(@dCo_FechaHasta)

IF (@sCo_Almacen is NULL)
                       RAISERROR('Debe seleccionar un Almacén',16,1)


IF (@sCo_Precio01 IS NULL AND 		
	@sCo_Precio02 IS NULL AND 
	@sCo_Precio03 IS NULL AND 
	@sCo_Precio04 IS NULL AND 
	@sCo_Precio05 IS NULL)
BEGIN
		SET @sCo_Precio01 = 'PREC01' 
		SET @sCo_Precio02 = 'PREC02' 
		SET @sCo_Precio03 = 'PREC03' 
		SET @sCo_Precio04 = 'PREC04' 
		SET @sCo_Precio05 = 'PREC05' 
END

IF @sCo_TipoCosto IS NULL
  SET @sCo_TipoCosto = '1'

IF  @sCo_Excluir IS NULL 
SET @sCo_Excluir = 0
                 
SELECT * FROM(
			SELECT distinct tipo_costo,co_art,art_des,prec_om,co_lin,lin_des,co_uni,precio1,precio2,precio3,precio4,precio5,ultimo,pre01,pre02,pre03,pre04,pre05,
			(CASE WHEN (((precio1 + precio2 + precio3 + precio4 + precio5) = 0) AND ultimo = 0) THEN 1 ELSE 0 END) AS valido1,
			(CASE WHEN (ultimo = 0) THEN 1 ELSE 0 END) AS valido2,
			(CASE WHEN ((precio1 + precio2 + precio3 + precio4 + precio5) = 0) THEN 1 ELSE 0 END) AS valido3 FROM (
					SELECT 'tipo_costo' = @sCo_TipoCosto, A.co_art,A.art_des,A.prec_om,LA.co_lin,LA.lin_des,AU.co_uni,
					isnull(dbo.PrecioAUnaFecha(A.co_art,@dCo_FechaHasta,@sCo_Precio01,@sCo_Almacen,NULL,NULL,NULL,NULL),0) as precio1,
					isnull(dbo.PrecioAUnaFecha(A.co_art,@dCo_FechaHasta,@sC
```
