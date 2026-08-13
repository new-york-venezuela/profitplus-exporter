# SP: RepArticuloConMargen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saColor`](../tables/saColor.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <30-04-10>
-- Description:	<Reporte de Artículos con su Margen>
-- =============================================
CREATE PROCEDURE  [RepArticuloConMargen]
	-- Add the parameters for the stored procedure here
	@sCo_Art_d CHAR(30) = NULL,
	@sCo_Art_h CHAR(30) = NULL,
	@dCo_FechaHasta smalldatetime = NULL,
	@sCo_Linea_d char(6) = NULL,
	@sCo_Linea_h char(6) = NULL,
	@sCo_Categoria_d char(6) = NULL,
	@sCo_Categoria_h char(6) = NULL,
	@sCo_SubLinea_d char(6) = NULL,
	@sCo_SubLinea_h char(6) = NULL,
	@sCo_Color_d char(6) = NULL,
	@sCo_Color_h char(6) = NULL,
	@sCo_Almacen char(6) = NULL,
	@sCo_Prec char(6) = NULL,
	@sCo_TipoCosto char(2) = NULL,
	@sCo_Excluir char(2) = NULL,
	--@sCo_NivelStock char(4)= NULL,	
	--@sCo_Clasificado char(4)= NULL,	----->Filtro Clasificado por
	@sCo_Sucursal char(6) = NULL,
	@sCo_Mone char(6) = NULL,
	@sCampOrderBy varchar(16) = NULL,
	@sDir varchar(6) = NULL,
	@bHeaderRep bit = 0
AS
BEGIN
	SET NOCOUNT ON;

/*DECLARE @NombrePrecio1 char (6);

SET @NombrePrecio1 =(select co_precio from saTipoPrecio where co_precio = @sCo_Precio01)

/*********Valores por defecto********/*/

IF @sCo_TipoCosto IS NULL
  SET @sCo_TipoCosto = '1' 
  
IF @dCo_FechaHasta IS NOT NULL
  SET @dCo_FechaHasta = dbo.FechaSimple(@dCo_FechaHasta)

IF @sCo_Excluir IS NULL
  SET @sCo_Excluir = 0

IF ( @sCo_Prec IS NULL)
            BEGIN
                RAISERROR('Debe Colocar Un Tipo de Precio',16,1)
                RETURN
            END

SET @sCo_Mone = (CASE WHEN  @sCo_TipoCosto = '3' THEN (SELECT i_moneda_articulo FROM par_emp)
					  WHEN  @sCo_TipoCosto = '4' THEN (SELECT i_moneda_articulo FROM par_emp)
				 ELSE 'NULL' END) 
                 
DECLARE @c_margen_costo_precio BIT SET @c_margen_costo_precio = (SELECT c_margen_costo_precio FROM par_emp )


SELECT co_art, art_des, prec_om, co_uni, precio_uni, costo, margen, tipo_costo, almacen  FROM(
SELECT DISTINCT co_art, art_des, prec_om, co_uni, precio_uni, costo, margen, tipo_costo, almacen,
(CASE WHEN (precio_uni = 0 AND costo = 0) THEN 1 ELSE 0 END) AS valido1,
(CASE WHEN (costo = 0) THEN 1 ELSE 0 END) AS valido2,
(CASE WHEN (precio_uni = 0 ) THEN 1 ELSE 0 END) AS valido3 FROM (SELECT A.co_art, A.art_des, A.prec_om, AU.co_uni,
isnull(dbo.PrecioAUnaFecha(A.co_art,@dCo_FechaHasta,@sCo_Prec,@sCo_Almacen,NULL,NULL,NULL,NULL),0) as precio_uni,
ROUND(dbo.C
```
