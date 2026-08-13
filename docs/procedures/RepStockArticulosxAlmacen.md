# SP: RepStockArticulosxAlmacen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <05-04-10>
 Description:	<Articulos con su Stock por Almacen>
 =============================================*/
CREATE PROCEDURE [dbo].[RepStockArticulosxAlmacen]
	-- Add the parameters for the stored procedure here
    @sCo_Codigo_d CHAR(30) = NULL ,
    @sCo_Codigo_h CHAR(30) = NULL ,
    @sCo_Descripcion_d CHAR(120) = NULL ,
    @sCo_Descripcion_h CHAR(120) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Almacen_d CHAR(6) = NULL ,
    @sCo_Almacen_h CHAR(6) = NULL ,
    @sTipoStock CHAR(4) = NULL ,
    @sCo_NivelStock CHAR(4) = NULL ,
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

		IF @sTipoStock IS NULL 
            SET @sTipoStock = 'ACT'               

		if (@sTipoStock = 'DIS')
		Begin
			set @sTipoStockPrim = 'ACT';
			set @sTipoStockSecun = 'COM';
		End
		else
		Begin
			if (@sTipoStock = 'SDIS')
			Begin
				set @sTipoStockPrim = 'SACT';
				set @sTipoStockSecun = 'SCOM';
			End
			ELSE
			BEGIN
				set @sTipoStockPrim = @sTipoStock;
				set @sTipoStockSecun = null;
			END
		End

        IF @sCo_NivelStock IS NULL 
            SET @sCo_NivelStock = 'TODO' 


	IF (@sTipoStockPrim not like 'S%') 
            SET @bObtenerUnidadPrincipal = 1
       ELSE 
            SET @bObtenerUnidadPrincipal = 0
--------------Fin Valores por Defecto---------------- 
        SELECT A.co_art,
            ISNULL(B.STOCK,0.00000)  - ISNULL(B2.STOCK,0.00000) as StockActual, 
			AL.co_alma, AL.des_alma, 
			D.lin_des, E.subl_des, T.cat_des,
			@sTipoStock AS TipoStock,
			A.stock_max, A.stock_min, A.stock_pedido,
            'co_uni' = CASE WHEN @bObtenerUnidadPrincipal = 1 THEN AUP.co_uni ELSE AUS.Co_Uni END,
			'des_uni' = CASE WHEN @bObtenerUnidadPrincipal = 1 THEN UP.des_uni ELSE US.des_Uni END, 
			A.*,
				U2.co_uniP1,U2.equivalenciaP1,U2.relacionP1, U2.usoDecP1,U2.numDecP1,U2.decripcionP1,
		    U2.co_uniP1_1 , U2.equivalen
```
