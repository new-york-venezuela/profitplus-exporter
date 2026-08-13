# SP: RepArticulosMasVentas
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-14-2010>
-- Description:   <Articulos con mas Ventas>
-- =============================================
CREATE PROCEDURE [RepArticulosMasVentas]
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
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
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
              [monto_unidad] [decimal](18, 2) ,
              [monto_neto] [decimal](18, 2) ,
              [co_uni] [char](6)
            )
                  
                  
            
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        co_art, art_des, SUM(monto_unidad) AS monto_unidad, SUM(monto_neto) AS monto_neto, co_uni
                      FROM
                        ( SELECT
                            AR.co_art, AR.art_des, ( CASE WHEN @sDev = 1 THEN ( FVR.cantidades - FVR.devoluciones )
                                                          WHEN @sDev = 0 THEN FVR.cantidades
                                                          ELSE FVR.cantidades
```
