# SP: RepVendedoresMasVentaXArticulo
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
-- Author:		SOFTECH SISTEMAS
-- Create date: <18-10-10>
-- Description:	<Vendedores con más Ventas para un Artículo>
-- =============================================
CREATE PROCEDURE [RepVendedoresMasVentaXArticulo]
	-- Add the parameters for the stored procedure here
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_art_d CHAR(30) = NULL ,
    @sCo_art_h CHAR(30) = NULL ,
    @sCo_ven_d CHAR(6) = NULL ,
    @sCo_ven_h CHAR(6) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
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

        DECLARE @temp TABLE
            (
              [co_ven] [char](16) ,
              [ven_des] [varchar](100) ,
              [anulado] [bit] ,
              [co_art] [char](30) ,
              [co_uni] [char](30) ,
              [cantidad] [decimal](18, 2) ,
              [art_des] [varchar](120) ,
              [monto_base] [decimal](18, 2)
            )
        
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT
                        co_ven, ven_des, anulado, co_art, co_uni, SUM(cantidad) AS cantidad, art_des,
                        SUM(monto_base) AS monto_base
                      FROM
                        ( SELECT
                            C.co_ven, C.ven_des, F.anulado, FR.co_art, AU.co_uni,
                            ROUND(dbo.ArtUnidadBase(FR.co_art, FR.co_uni, FR.total_art), 2) - FR.total_dev AS cantidad, A.art_des,
                            ROUND(( CONVERT(DECIMAL(18, 2), ( FR.prec_vta * (FR.total_art - FR.total_dev))) - FR.monto_desc
                                    - FR.monto_desc_glob + FR.monto_reca_glob ), 2) AS monto_base
                          FROM
                            saVendedor AS C
                            INNER JOIN saFacturaVenta AS F ON C.co_ven = F.co_ven
                            INNER JOIN saFacturaVentaReng AS FR ON F.doc_num = FR.doc_num
                            INNER JOIN saArticulo AS A ON FR.co_art = A.co_art
                            LEFT JOIN saArtUnidad AS AU ON AU.co_art
```
