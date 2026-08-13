# SP: RepArticuloConPrecioOM
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTasa`](../tables/saTasa.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2013-10-07>
-- Last Update date: <2021-04-30>
-- Description:	<Reporte de Artículos con sus Precios en Otra Moneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepArticuloConPrecioOM]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Color_d CHAR(6) = NULL ,
    @sCo_Color_h CHAR(6) = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
    @sCo_Precio01 CHAR(6) = NULL ,
    @sCo_Precio02 CHAR(6) = NULL ,
    @sCo_Precio03 CHAR(6) = NULL ,
    @sCo_Precio04 CHAR(6) = NULL ,
    @sCo_Precio05 CHAR(6) = NULL ,
    @sCo_FechaHasta SMALLDATETIME = NULL ,
    @sCo_NivelStock CHAR(4) = NULL ,
    @sCo_Clasificado CHAR(4) = NULL ,	----->Filtro Clasificado por
    @sCo_Tasa CHAR(18) = NULL ,
    @sCo_MonedaFiltro CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
       DECLARE @deTasaMonedaFiltro DECIMAL(21, 8);	
       DECLARE @sMonedaBase CHAR(6);
        SET NOCOUNT ON;
        -- Chequea tipo de de precio
	    IF (@sCo_Precio01 IS NULL AND @sCo_Precio02 IS NULL AND @sCo_Precio03 IS NULL AND @sCo_Precio04 IS NULL AND @sCo_Precio05 IS NULL)
	    BEGIN
		  RAISERROR('Debe seleccionar un Tipo de Precio',16, 1);
		  RETURN -1
		END  
        -- Chequea si se ha pasado el codigo del almacén el cual es requerido.
        IF (@sCo_Almacen IS NULL)
        BEGIN
          RAISERROR('Debe seleccionar un Almacén', 16, 1)
		  RETURN -1
		END  
/*********Valores por defecto*********/
		IF (@sCo_FechaHasta IS NULL)
		  SET @sCo_FechaHasta = GETDATE();
 
        IF ( @sCo_NivelStock IS NULL ) 
            SET @sCo_NivelStock = 'TODO'
 
        IF ( @sCo_Clasificado IS NULL ) 
            SET @sCo_Clasificado = ''
        SET @sMonedaBase = ( SELECT g_moneda FROM par_emp )
        -- Tasa de la Moneda Filtro (Si se especifico alguna)
        IF @sCo_MonedaFiltro IS NOT NULL 
			SET @deTasaMonedaFiltro = ( ISNULL( ( SELECT TOP 1 tasa_v 
							  FROM saTasa 
							  WHERE  fecha <= @sCo_FechaHasta
```
