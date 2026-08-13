# SP: RepArticulosSinMovimientos
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-14-2010>
-- Description:   <Articulos sin Movimientos >
-- =============================================
CREATE PROCEDURE [RepArticulosSinMovimientos]
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Alma CHAR(6) = NULL ,
    @sCo_Lin_d CHAR(6) = NULL ,
    @sCo_Lin_h CHAR(6) = NULL ,
    @sCo_Subl_d CHAR(6) = NULL ,
    @sCo_Subl_h CHAR(6) = NULL ,
    @sCo_Color_d CHAR(6) = NULL ,
    @sCo_Color_h CHAR(6) = NULL ,
    @sCo_Cat_d CHAR(6) = NULL ,
    @sCo_Cat_h CHAR(6) = NULL ,
    @sCo_NivelStock CHAR(4) = NULL ,
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
      
        IF @sCo_NivelStock IS NULL 
            SET @sCo_NivelStock = 'TODO' 

        SELECT
            A.NivelStock, A.co_art, A.art_des, 
/*SUM(*/
            ( dbo.ConsultarStockActualxAlmacenxFechaxTipoDoc(A.co_art, @sCo_Alma, @dFecha_d - 1, NULL, NULL) )/*)*/ AS Stockart,
            A.co_uni
        FROM
            ( SELECT
                NivelStock = @sCo_NivelStock, AR.co_art, AR.art_des, U.co_uni
              FROM
                saArticulo AS AR
                LEFT JOIN saStockAlmacen SA ON ( ( SA.co_alma = @sCo_Alma )
                                                 AND ( SA.co_art = AR.co_art )
                                               )
                INNER JOIN saArtUnidad AS U ON AR.co_art = U.co_art
                                               AND U.uni_principal = 1
              WHERE
                AR.co_art NOT IN ( SELECT
                                    FCR.co_art
                                   FROM
                                    saFacturaCompraReng FCR
                                    INNER JOIN saFacturaCompra FC ON FC.doc_num = FCR.doc_num
                                   WHERE
                                    ( ( @dFecha_d IS NULL
                                        OR dbo.FechaSimple(FC.fec_emis) >= @dFecha_d
                                      )
```
