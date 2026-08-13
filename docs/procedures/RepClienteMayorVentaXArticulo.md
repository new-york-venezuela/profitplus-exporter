# SP: RepClienteMayorVentaXArticulo
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
-- Author:		SOFTECH SISTEMAS
-- Create date: <01-10-10>
-- Description:	<Clientes con más Ventas para un Artículo>
-- =============================================
CREATE PROCEDURE [RepClienteMayorVentaXArticulo]
	-- Add the parameters for the stored procedure here
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_art_d CHAR(30) = NULL ,
    @sCo_art_h CHAR(30) = NULL ,
    @sCo_cli_d CHAR(16) = NULL ,
    @sCo_cli_h CHAR(16) = NULL ,
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
              [co_cli] [char](16) ,
              [cli_des] [varchar](100) ,
              [co_art] [char](30) ,
              [co_uni] [char](6) ,
              [cantidad] [decimal](18, 2) ,
              [art_des] [varchar](120) ,
              [monto_base] [decimal](18, 2)
            )
			  
        
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT
                        co_cli, cli_des, co_art, co_uni, SUM(cantidad) AS cantidad, art_des,
                        SUM(monto_base) AS monto_base
                      FROM
                        ( SELECT
                            C.co_cli, C.cli_des, FR.co_art, AU.co_uni,
                            ROUND(dbo.ArtUnidadBase(FR.co_art, FR.co_uni, FR.total_art), 2) AS cantidad, A.art_des,
                            ROUND(( CONVERT(DECIMAL(18, 2), ( FR.prec_vta * FR.total_art )) - FR.monto_desc
                                    - FR.monto_desc_glob + FR.monto_reca_glob ), 2) AS monto_base
                          FROM
                            saCliente AS C
                            INNER JOIN saFacturaVenta AS F ON C.co_cli = F.co_cli
                            INNER JOIN saFacturaVentaReng AS FR ON F.doc_num = FR.doc_num
                            INNER JOIN saArticulo AS A ON FR.co_art = A.co_art
                            LEFT JOIN saArtUnidad AS AU ON AU.co_art = FR.co_art
                                                           AND AU.
```
