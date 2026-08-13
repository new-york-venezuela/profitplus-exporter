# SP: RepArticulosTodoStock
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saColor`](../tables/saColor.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<20-04-10>
 Description:	<Articulos con Todos sus Stocks>
 =============================================*/
CREATE PROCEDURE [dbo].[RepArticulosTodoStock]
	-- Add the parameters for the stored procedure here
    @sCo_Codigo_d CHAR(30) = NULL ,
    @sCo_Codigo_h CHAR(30) = NULL ,
	@sCo_Almacen CHAR(6) = NULL ,
	@sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
	@sCo_Color_d CHAR(6) = NULL ,
    @sCo_Color_h CHAR(6) = NULL ,
    @sTipo_Unidad CHAR(4) = NULL , -- (Si es primaria o secundaria)
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        DECLARE @bObtenerUnidadPrincipal BIT ;
		DECLARE @sTipoStockPrim char(4);
		DECLARE @sTipoStockSecun char(4);

---------------Valores por Defecto-------------------
        IF ( @sTipo_Unidad IS NULL OR @sTipo_Unidad = 'UNPR') 
            SET @bObtenerUnidadPrincipal = 1
        ELSE 
            SET @bObtenerUnidadPrincipal = 0

--------------Fin Valores por Defecto---------------- 
        SELECT A.co_art, 
            ISNULL(
			(select sum(SAL.stock) from saStockAlmacen SAL where 
							(@sCo_Almacen IS NULL OR SAL.co_alma = @sCo_Almacen) AND 
							A.co_art = SAL.co_art AND 
							SAL.tipo = CASE WHEN @bObtenerUnidadPrincipal = 1 then 'ACT' else 'SACT' end)
			,0.00000) as Stock_ACT, 
			ISNULL(
			(select sum(SAL.stock) from saStockAlmacen SAL where 
							(@sCo_Almacen IS NULL OR SAL.co_alma = @sCo_Almacen) AND 
							A.co_art = SAL.co_art AND 
							SAL.tipo = CASE WHEN @bObtenerUnidadPrincipal = 1 then 'LLE' else 'SLLE' end)
			,0.00000) as Stock_LLE, 
			ISNULL(
			(select sum(SAL.stock) from saStockAlmacen SAL where 
							(@sCo_Almacen IS NULL OR SAL.co_alma = @sCo_Almacen) AND 
							A.co_art = SAL.co_art AND 
							SAL.tipo = CASE WHEN @bObtenerUnidadPrincipal = 1 then 'COM' else 'SCOM' end)
			,0.00000) as Stock_COM, 
			ISNULL(
			(select sum(SAL.stock) from saStockAlmacen SAL where 
							(@sCo_Almacen IS NULL OR SAL.co_alma = @sCo_Almacen) AND 
							A.co_art = SAL.co_art AND 
							SAL.tipo = CASE WHEN @bObtenerUnidadPrincipal = 1 then 'DES' else 'SDES' end)
```
