# SP: RepArticuloConCosto
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
-- Author:		<Softech Sistemas>
-- Create date: <03-03-11>
-- Description:	<Reporte de Artículos con todos sus Costos>
-- =============================================
CREATE PROCEDURE  [RepArticuloConCosto]
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
	@sCo_Excluir char(2) = NULL,
	@sCo_Sucursal char(6) = NULL,
	
	
	@sCampOrderBy varchar(16) = NULL,
	@sDir varchar(6) = NULL,
	@bHeaderRep bit = 0
AS
BEGIN
	SET NOCOUNT ON;
	
IF @sCo_Excluir IS NULL
   SET @sCo_Excluir = 1
   
IF @dCo_FechaHasta IS NOT NULL 
   SET @dCo_FechaHasta = dbo.FechaSimple(@dCo_FechaHasta)

SELECT * FROM ( 
SELECT co_art, art_des, co_uni, ultimo, promedio, reposicion, proveedor, 
(CASE WHEN ((ultimo + promedio + reposicion + proveedor) = 0) THEN 1 ELSE 0 END) AS valido  FROM(
SELECT A.co_art, A.art_des, AU.co_uni,
ROUND(dbo.ConsultarCostoxAlmacenxFecha(A.co_art,@sCo_Almacen,@dCo_FechaHasta,AU.co_uni,'1',NULL,1),2) AS ultimo,
ROUND(dbo.ConsultarCostoxAlmacenxFecha(A.co_art,@sCo_Almacen,@dCo_FechaHasta,AU.co_uni,'2',NULL,1),2) AS promedio,
ROUND(dbo.ConsultarCostoxAlmacenxFecha(A.co_art,@sCo_Almacen,@dCo_FechaHasta,AU.co_uni,'5',NULL,1),2) AS reposicion,
ROUND(dbo.ConsultarCostoxAlmacenxFecha(A.co_art,@sCo_Almacen,@dCo_FechaHasta,AU.co_uni,'6',NULL,1),2) AS proveedor

FROM saArticulo AS A
		
		--CROSS JOIN saAlmacen AS AL 
		INNER JOIN saLineaArticulo AS LA ON LA.co_lin = A.co_lin
		INNER JOIN saSubLinea AS SL ON SL.co_subl = A.co_subl AND LA.co_lin = SL.co_lin
		INNER JOIN saCatArticulo AS CA ON CA.co_cat = A.co_cat
		INNER JOIN saColor AS CO ON CO.co_color = A.co_color
		LEFT JOIN saArtUnidad AS AU ON AU.co_art = A.co_art AND AU.uni_principal = 1
					
WHERE 
	((@sCo_art_d IS NULL OR A.co_art >= @sCo_art_d)AND(@sCo_art_h IS NULL OR A.co_art <= @sCo_art_h))
	AND
	((@sCo_Linea_d IS NULL OR A.co_lin >= @sCo_Linea_d)AND(@sCo_Linea_h IS NULL OR A.co_lin <= @sCo_Linea_h))
	AND
	((@sCo_SubLinea_d IS NULL OR A.co_subl >= @sCo_SubLinea_d) AND (@sCo_SubLinea_h IS NULL OR A.co_subl <= @sCo_SubLinea_h))
	AN
```
