# SP: RepArticulosMasCompradosAProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-19-2010>
-- Description:   <Articulos mas Comprados a un Proveedor>
-- =============================================
CREATE PROCEDURE [RepArticulosMasCompradosAProveedor]
    @sCo_Prov CHAR(16) = NULL ,
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
              [cantidades] [int] ,
              [monto_neto] [decimal](18, 2) ,
              [co_prov] [char](30) ,
              [prov_des] [varchar](120) ,
              [co_art] [char](30) ,
              [art_des] [varchar](120) ,
              [co_uni] [char](30)
            )
        
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        SUM(A.cantidades) AS cantidades, SUM(A.monto_neto) AS monto_neto, A.co_prov, A.prov_des,
                        A.co_art, A.art_des, A.co_uni
                      FROM
                        ( SELECT
                            P.co_prov, P.prov_des, AR.co_art, AR.art_des, AU.co_uni,
                            ROUND(( dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, FCR.total_art) )
                                  * ( CASE WHEN FC.anulado = 1 THEN 0
                                           ELSE 1
                                      END ), 2) AS cantidades,
                            ROUND(CONVERT(DECIMAL(18, 2), ( FCR.cost_unit * FCR.total_art )) - FCR.monto_desc
                                  - FCR.monto_desc_glob + F
```
