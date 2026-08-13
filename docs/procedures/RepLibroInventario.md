# SP: RepLibroInventario
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <2016-07-08>
-- LastUpdate date <2018-02-01>
-- Description:   <Libro de Inventario>
-- =============================================
CREATE PROCEDURE [dbo].[RepLibroInventario]
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @dCo_fecha_d DATETIME = NULL ,
    @dCo_fecha_h DATETIME = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sTipo_Unidad CHAR(4) = NULL , -- (Si es primaria o secundaria)
    @sCo_Uni CHAR(6) = NULL ,
    @sCo_Movimiento CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0, 
       @sCriterio char(6) = NULL
AS 
BEGIN
    SET NOCOUNT ON;

    DECLARE @bObtenerUnidadPrincipal BIT;    

       IF ( @sTipo_Unidad IS NULL OR @sTipo_Unidad = 'UNPR') 
             SET @bObtenerUnidadPrincipal = 1
       ELSE 
             SET @bObtenerUnidadPrincipal = 0

       IF @dCo_fecha_h IS NOT NULL 
             SET @dCo_fecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dCo_fecha_h))

       IF @sCriterio IS NULL
             SET @sCriterio = '1'  

Select 
Art.co_art,ART.tipo,
Art.art_des,
AU.co_uni,
Case when @dCo_fecha_d is null then
0.00000 else
ISNULL(A.total_compra,0.00000) + ISNULL(A.total_entrada,0.00000) - ISNULL(A.total_venta,0.00000) -ISNULL(A.total_salida,0.00000) 
end as StockInic,
Case when @dCo_fecha_d is null then
0.00000 else
ROUND(ISNULL(A.total_compra,0.00000)    * ISNULL(A.total_compra_costo_uni,0.00000),2) + 
ROUND(ISNULL(A.total_entrada,0.00000)   * ISNULL(A.total_entrada_costo_uni,0.00000),2) - 
ROUND(ISNULL(A.total_venta,0.00000)            * ISNULL(A.total_venta_costo_uni,0.00000),2) -
ROUND(ISNULL(A.total_salida,0.00000)    * ISNULL(A.total_salida_costo_uni,0.00000),2)
end as CostoInical,

ISNULL(B.total_compra,0.00000) as total_compra, 
ISNULL(B.total_compra_costo_uni,0.00000) as total_compra_costo_uni,
ISNULL(B.total_entrada,0.00000) as total_entrada, 
ISNULL(B.total_entrada_costo_uni,0.00000) as total_entrada_costo_uni,
ISNULL(B.total_venta,0.00000) as total_venta, 
ISNULL(B.total_venta_costo_uni,0.00000) as total_venta_costo_uni,
ISNULL(B.total_salida,0.00000) as total_salida, 
ISNULL(B.total_salida_costo_uni,0.00
```
