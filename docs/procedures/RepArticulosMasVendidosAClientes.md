# SP: RepArticulosMasVendidosAClientes
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-19-2010>
-- Description:   <Articulos mas Vendidos a un Cliente>
-- =============================================
CREATE PROCEDURE [RepArticulosMasVendidosAClientes]
    @sCo_Cli CHAR(16) = NULL ,
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
              [art_des] [varchar](120) ,
              [co_art] [char](30) ,
              [monto_neto] [decimal](18, 2) ,
              [cantidades] [decimal](18, 2) ,
              [co_cli] [char](30) ,
              [cli_des] [varchar](120) ,
              [co_uni] [char](30)
            )
        
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        art_des, co_art, SUM(monto_neto) AS monto_neto, SUM(cantidades) AS cantidades, co_cli, cli_des,
                        co_uni
                      FROM
                        ( SELECT
                            AR.art_des, FVR.co_art,
                            ROUND(( ( FVR.prec_vta * FVR.total_art ) - FVR.monto_desc - FVR.monto_desc_glob
                                    + FVR.monto_reca_glob ), 2) AS monto_neto,
                            ROUND(( dbo.ArtUnidadBase(FVR.co_art, FVR.co_uni, FVR.total_art) )
                                  * ( CASE WHEN FV.anulado = 1 THEN 0
                                           ELSE 1
                                      END ), 5) AS cantidades, C.co_cli, C.cli_des, AU.co_u
```
