# SP: RepArticulosMasCompras
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-14-2010>
-- Description:   <Articulos con mas Compras>
-- =============================================

CREATE PROCEDURE [RepArticulosMasCompras]
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
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @iCantidad INT = NULL ,
    @sCo_Mone CHAR(6) = NULL ,
    @sDev CHAR(3) = NULL ,
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
          
        IF @sDev = 'TODO'
            AND @sDev IS NULL 
            SET @sDev = NULL
                    
        IF @sDev = 'SI' 
            SET @sDev = '1'
          
        IF @sDev = 'NO' 
            SET @sDev = '0'
            
        DECLARE @temp TABLE
            (
              [co_art] [char](30) ,
              [art_des] [varchar](120) ,
              [co_uni] [char](6) ,
              [monto_unidad] [decimal](18, 2) ,
              [monto_neto] [decimal](18, 2)
            )
	            
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        co_art, art_des, co_uni, SUM(monto_unidad) AS monto_unidad, SUM(monto_neto) AS monto_neto
                      FROM
                        ( SELECT
                            FCR.co_art, AR.art_des, AU.co_uni,
                            ( CASE WHEN @sDev = '1' THEN ( FCR.cantidades - FCR.devoluciones )
                                   WHEN @sDev = '0' THEN FCR.cantidades
                                   ELSE FCR.cantidades
                              END ) AS monto_unidad,
```
