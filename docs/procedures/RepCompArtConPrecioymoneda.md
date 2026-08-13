# SP: RepCompArtConPrecioymoneda
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:          <SOFTECH SISTEMA>
-- Create date: <2015-07-17>
-- Description:     <RepCompArtConPrecioymoneda>
-- LAST DATE:2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepCompArtConPrecioymoneda] 
       -- Add the parameters for the stored procedure here
       @dFecha_d SMALLDATETIME = NULL,
	   @dFecha_h SMALLDATETIME = NULL,
       @sCo_art1 CHAR(30) = NULL,
       @sCo_art2 CHAR(30) = NULL,
       @sCo_art3 CHAR(30) = NULL,
       @sCo_MonedaFiltro CHAR(6) = NULL,
       @sCo_Almacen CHAR(6) = NULL,
       @sCo_Precio CHAR(6) = NULL,
       @sCo_Escala CHAR (10) = NULL,
       @sCampOrderBy VARCHAR(16) = NULL ,
       @sDir VARCHAR(6) = NULL ,
       @bHeaderRep BIT = 0

AS
BEGIN
    DECLARE @MyTableVar table(
    Co_art CHAR(30),
    monto DECIMAL (18,2),
    desde SMALLDATETIME,
    column1 CHAR (10),
    art_des CHAR(120)); 
       
       SET NOCOUNT ON;
       
       IF (@sCo_art1 IS NULL AND @sCo_art2 IS NULL AND @sCo_art3 IS  NULL)    
        BEGIN
                    RAISERROR('No es posible ejecutar el reporte, debe seleccionar un artículo.',16,1);
                    RETURN
             END 

       
       IF (@sCo_Almacen IS NULL and exists (select * from @MyTableVar B where B.co_art = @sCo_art1))
             BEGIN
                    RAISERROR ('Debe seleccionar un Almacén.',16,1)
                    RETURN
             END 

       
       IF (@sCo_Precio IS NULL)
             BEGIN
                    RAISERROR ('Debe seleccionar un Tipo de Precio.',16,1)
                    RETURN
             END
       
       
       IF (@sCo_Escala IS NULL)
             BEGIN
             SET @sCO_Escala = '1' 
             END

       Insert into @MyTableVar
       SELECT     dbo.saArticulo.co_art co_art, 
        round(dbo.saArtPrecio.monto * [dbo].[TasaAUnaFecha](dbo.saArtPrecio.co_mone, 1, dbo.saArtPrecio.desde),5)  as monto, 
        dbo.saArtPrecio.desde, @sCo_Escala, saArticulo.art_des
       FROM       dbo.saArticulo INNER JOIN
                dbo.saArtPrecio ON dbo.saArticulo.co_art = dbo.saArtPrecio.co_art 
        WHERE (saArtPrecio.desde >= @dFecha_d AND saArtPrecio.desde <= @dFecha_h) AND
                (saArticulo.co_art = @sCo_art1 OR saArticulo.co_art = @sCo_art2 OR saArticulo.co_art= @sCo_art3) AND
                (saArtPrecio.Co_Precio = @sCo_Precio) AND (saArtPrecio.
```
