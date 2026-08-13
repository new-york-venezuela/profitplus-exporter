# SP: RepProveedoresMasCompraXArticulo
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
-- Author:		SOFTECH SISTEMAS
-- Create date: <18-10-10>
-- Description:	<Proveedores con más Compras para un Artículo>
-- =============================================
CREATE PROCEDURE [RepProveedoresMasCompraXArticulo]
	-- Add the parameters for the stored procedure here
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_art_d CHAR(30) = NULL ,
    @sCo_art_h CHAR(30) = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
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
              [co_prov] [char](16) ,
              [prov_des] [varchar](100) ,
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
                        co_prov, prov_des, co_art, co_uni, SUM(cantidad) AS cantidad, art_des,
                        SUM(monto_base) AS monto_base
                      FROM
                        ( SELECT
                            P.co_prov, P.prov_des, FCR.co_art, AU.co_uni,
                            ROUND(dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, FCR.total_art), 2) AS cantidad, A.art_des,
                            ROUND(( ( FCR.cost_unit * FCR.total_art ) - FCR.monto_desc - FCR.monto_desc_glob
                                    + FCR.monto_reca_glob ), 2) AS monto_base
                          FROM
                            saProveedor AS P
                            INNER JOIN saFacturaCompra AS FC ON P.co_prov = FC.co_prov
                            INNER JOIN saFacturaCompraReng FCR ON FC.doc_num = FCR.doc_num
                            INNER JOIN saArticulo AS A ON FCR.co_art = A.co_art
                            LEFT JOIN saArtUnidad AS AU ON AU.co_art = FCR.co_art
```
