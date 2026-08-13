# SP: RepArticulosMasVendidosAVendedor
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-19-2010>
-- Description:   <Articulos mas Vendidos a un Vendedor>
-- =============================================
CREATE PROCEDURE [RepArticulosMasVendidosAVendedor]
    @sCo_Ven CHAR(6) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Alma_d CHAR(6) = NULL ,
    @sCo_Alma_h CHAR(6) = NULL ,
    @sCo_Lin_d CHAR(6) = NULL ,
    @sCo_Lin_h CHAR(6) = NULL ,
    @sCo_Subl_d CHAR(6) = NULL ,
    @sCo_Subl_h CHAR(6) = NULL ,
    @sCo_Cat_d CHAR(6) = NULL ,
    @sCo_Cat_h CHAR(6) = NULL ,
    @iCantidad INT = NULL ,
    @sCo_Mone CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
      
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
      
        IF @iCantidad IS NULL 
            SET @iCantidad = 10
            
        DECLARE @temp TABLE
            (
              [co_ven] [char](30) ,
              [ven_des] [varchar](120) ,
              [co_art] [char](30) ,
              [art_des] [varchar](120) ,
              [co_uni] [char](30) ,
              [cantidades] [decimal](18, 2) ,
              [monto_neto] [decimal](18, 5)
            )
	            
	                    
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        co_ven, ven_des, co_art, art_des, co_uni, SUM(cantidades) AS cantidades,
                        SUM(monto_neto) AS monto_neto
                      FROM
                        ( SELECT
                            V.co_ven, V.ven_des, FVR.co_art, AR.art_des, AU.co_uni,
                            ROUND(( dbo.ArtUnidadBase(FVR.co_art, FVR.co_uni, FVR.total_art) )
                                  * ( CASE WHEN FV.anulado = 1 THEN 0
                                           ELSE 1
                                      END ), 5) AS cantidades,
                            ROUND(( ( FVR.prec_vta * FVR.total_art ) - FVR.monto_desc - FVR.monto_desc_glob
                                    + FVR.monto
```
